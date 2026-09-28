begin;

-- primero retiro las reglas que dependen de los campos que voy a corregir.
-- asi puedo reconstruirlas despues con una sola fuente para cada dato.
drop policy if exists casos_leer_segun_rol on public.casos_diagnosticos;
drop policy if exists casos_crear_recepcion on public.casos_diagnosticos;
drop policy if exists mensajes_chatbot_leer_segun_caso on public.mensajes_chatbot;
drop policy if exists mensajes_chatbot_escribir_responsable on public.mensajes_chatbot;

drop trigger if exists casos_proteger_autoria on public.casos_diagnosticos;

drop function if exists public.actualizar_diagnostico_mecanico(
  uuid,
  public.estado_caso,
  text
);
drop function if exists public.asignar_mecanico_caso(
  uuid,
  uuid,
  public.prioridad_caso,
  text
);

drop index if exists public.casos_mecanico_idx;

alter table public.talleres
  drop column activo;

alter table public.clientes
  drop column observaciones;

alter table public.vehiculos
  rename column observaciones to antecedentes_vehiculo;

alter table public.casos_diagnosticos
  rename column recepcion_id to recepcion_responsable_id;

alter table public.casos_diagnosticos
  drop column mecanico_asignado_id;

alter table public.asignaciones
  drop column prioridad;

alter table public.asignaciones
  rename column finalizado_en to terminado_en;

-- conservamos quien recibio el vehiculo al abrir el caso. este dato no puede
-- cambiar por una edicion comun del formulario.
create trigger casos_proteger_autoria
before update on public.casos_diagnosticos
for each row execute function public.impedir_cambio_autoria(
  'recepcion_responsable_id'
);

-- dejamos que postgres complete las fechas ligadas a un cambio de estado. de
-- esta forma no dependemos de que cada pantalla recuerde hacerlo por su cuenta.
create or replace function public.normalizar_fecha_cierre_caso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'cerrado' then
    new.cerrado_en = coalesce(new.cerrado_en, now());
  else
    new.cerrado_en = null;
  end if;

  return new;
end;
$$;

revoke all on function public.normalizar_fecha_cierre_caso()
from public, anon, authenticated;

update public.casos_diagnosticos
set cerrado_en = coalesce(cerrado_en, actualizado_en, creado_en, now())
where estado = 'cerrado';

update public.casos_diagnosticos
set cerrado_en = null
where estado <> 'cerrado'
  and cerrado_en is not null;

create trigger casos_normalizar_fecha_cierre
before insert or update on public.casos_diagnosticos
for each row execute function public.normalizar_fecha_cierre_caso();

alter table public.casos_diagnosticos
  add constraint casos_fecha_cierre_coherente
  check (
    (estado = 'cerrado' and cerrado_en is not null)
    or (estado <> 'cerrado' and cerrado_en is null)
  );

create or replace function public.normalizar_fecha_termino_asignacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = 'activa' then
    new.terminado_en = null;
  else
    new.terminado_en = coalesce(new.terminado_en, now());
  end if;

  return new;
end;
$$;

revoke all on function public.normalizar_fecha_termino_asignacion()
from public, anon, authenticated;

update public.asignaciones
set terminado_en = null
where estado = 'activa'
  and terminado_en is not null;

update public.asignaciones
set terminado_en = coalesce(terminado_en, now())
where estado in ('finalizada', 'cancelada');

create trigger asignaciones_normalizar_fecha_termino
before insert or update on public.asignaciones
for each row execute function public.normalizar_fecha_termino_asignacion();

alter table public.asignaciones
  add constraint asignaciones_fecha_termino_coherente
  check (
    (estado = 'activa' and terminado_en is null)
    or (estado in ('finalizada', 'cancelada') and terminado_en is not null)
  );

-- la asignacion activa pasa a ser la fuente oficial del mecanico responsable.
-- el caso conserva su estado, pero ya no repite el identificador del mecanico.
create policy casos_leer_segun_rol
on public.casos_diagnosticos for select
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (
    (select public.rol_actual()) in ('administrador', 'recepcion')
    or exists (
      select 1
      from public.asignaciones as asignacion
      where asignacion.caso_id = casos_diagnosticos.id
        and asignacion.taller_id = casos_diagnosticos.taller_id
        and asignacion.mecanico_id = (select auth.uid())
        and asignacion.estado = 'activa'
    )
  )
);

create policy casos_crear_recepcion
on public.casos_diagnosticos for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and recepcion_responsable_id = (select auth.uid())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

create policy mensajes_chatbot_leer_segun_caso
on public.mensajes_chatbot for select
to authenticated
using (
  taller_id = (select public.taller_actual())
  and exists (
    select 1
    from public.casos_diagnosticos as caso
    where caso.id = mensajes_chatbot.caso_id
      and caso.taller_id = mensajes_chatbot.taller_id
      and (
        (select public.rol_actual()) = 'recepcion'
        or (
          (select public.rol_actual()) = 'mecanico'
          and exists (
            select 1
            from public.asignaciones as asignacion
            where asignacion.caso_id = caso.id
              and asignacion.taller_id = caso.taller_id
              and asignacion.mecanico_id = (select auth.uid())
              and asignacion.estado = 'activa'
          )
        )
      )
  )
);

create policy mensajes_chatbot_escribir_responsable
on public.mensajes_chatbot for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and tipo_autor = 'usuario'
  and autor_id = (select auth.uid())
  and rol_autor = (select public.rol_actual())
  and exists (
    select 1
    from public.casos_diagnosticos as caso
    where caso.id = mensajes_chatbot.caso_id
      and caso.taller_id = mensajes_chatbot.taller_id
      and (
        (
          (select public.rol_actual()) = 'recepcion'
          and caso.recepcion_responsable_id = (select auth.uid())
          and caso.estado in ('ingresado', 'diagnostico_inicial')
        )
        or (
          (select public.rol_actual()) = 'mecanico'
          and caso.estado in ('asignado', 'en_revision', 'diagnosticado')
          and exists (
            select 1
            from public.asignaciones as asignacion
            where asignacion.caso_id = caso.id
              and asignacion.taller_id = caso.taller_id
              and asignacion.mecanico_id = (select auth.uid())
              and asignacion.estado = 'activa'
          )
        )
      )
  )
);

create function public.actualizar_diagnostico_mecanico(
  caso_objetivo uuid,
  estado_nuevo public.estado_caso,
  conclusion_nueva text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.rol_actual()) is distinct from 'mecanico'::public.rol_taller then
    raise exception 'Solo un mecanico puede usar esta operacion.';
  end if;

  if estado_nuevo not in ('en_revision', 'diagnosticado') then
    raise exception 'Estado no permitido para el mecanico.';
  end if;

  update public.casos_diagnosticos as caso
  set estado = estado_nuevo,
      conclusion_tecnica = nullif(trim(conclusion_nueva), '')
  where caso.id = caso_objetivo
    and caso.taller_id = (select public.taller_actual())
    and exists (
      select 1
      from public.asignaciones as asignacion
      where asignacion.caso_id = caso.id
        and asignacion.taller_id = caso.taller_id
        and asignacion.mecanico_id = (select auth.uid())
        and asignacion.estado = 'activa'
    );

  if not found then
    raise exception 'El caso no existe o no esta asignado al mecanico actual.';
  end if;
end;
$$;

revoke all on function public.actualizar_diagnostico_mecanico(
  uuid,
  public.estado_caso,
  text
) from public, anon;

grant execute on function public.actualizar_diagnostico_mecanico(
  uuid,
  public.estado_caso,
  text
) to authenticated;

create function public.asignar_mecanico_caso(
  caso_objetivo uuid,
  mecanico_objetivo uuid,
  prioridad_nueva public.prioridad_caso default 'normal',
  nota_nueva text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  taller_usuario uuid;
  asignacion_id uuid;
begin
  if (select public.rol_actual()) is distinct from 'recepcion'::public.rol_taller then
    raise exception 'Solo recepcion puede asignar un mecanico.';
  end if;

  taller_usuario := (select public.taller_actual());
  if taller_usuario is null then
    raise exception 'No se encontro el taller de la sesion.';
  end if;

  if char_length(coalesce(trim(nota_nueva), '')) > 1000 then
    raise exception 'La nota de asignacion supera el limite permitido.';
  end if;

  perform 1
  from public.casos_diagnosticos as caso
  where caso.id = caso_objetivo
    and caso.taller_id = taller_usuario
    and caso.recepcion_responsable_id = (select auth.uid())
    and caso.estado in ('ingresado', 'diagnostico_inicial')
  for update;

  if not found then
    raise exception 'El caso no existe, no pertenece a recepcion o ya fue entregado.';
  end if;

  if not exists (
    select 1
    from public.perfiles as perfil
    where perfil.id = mecanico_objetivo
      and perfil.taller_id = taller_usuario
      and perfil.rol = 'mecanico'
      and perfil.activo
  ) then
    raise exception 'El mecanico no existe, esta inactivo o pertenece a otro taller.';
  end if;

  if exists (
    select 1
    from public.asignaciones as asignacion
    where asignacion.caso_id = caso_objetivo
      and asignacion.estado = 'activa'
  ) then
    raise exception 'El caso ya tiene una asignacion activa.';
  end if;

  insert into public.asignaciones (
    taller_id,
    caso_id,
    mecanico_id,
    asignado_por,
    nota
  )
  values (
    taller_usuario,
    caso_objetivo,
    mecanico_objetivo,
    (select auth.uid()),
    nullif(trim(nota_nueva), '')
  )
  returning id into asignacion_id;

  update public.casos_diagnosticos
  set prioridad = coalesce(prioridad_nueva, 'normal'),
      estado = 'asignado'
  where id = caso_objetivo
    and taller_id = taller_usuario;

  return asignacion_id;
end;
$$;

revoke all on function public.asignar_mecanico_caso(
  uuid,
  uuid,
  public.prioridad_caso,
  text
) from public, anon;

grant execute on function public.asignar_mecanico_caso(
  uuid,
  uuid,
  public.prioridad_caso,
  text
) to authenticated;

commit;
