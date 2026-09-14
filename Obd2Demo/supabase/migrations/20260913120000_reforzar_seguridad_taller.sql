-- Esta migracion refuerza la autoria de los registros y limita lo que puede
-- modificar un mecanico. Se aplica despues del modelo inicial del taller.

begin;

-- Los perfiles nuevos se crean exclusivamente desde la Edge Function. Asi la
-- app movil no necesita una clave secreta ni puede insertar perfiles por fuera
-- del flujo de invitacion.
revoke insert, update on public.perfiles from authenticated;

drop policy if exists perfiles_crear_administrador on public.perfiles;
drop policy if exists perfiles_actualizar_administrador on public.perfiles;

-- Quien crea un registro debe quedar guardado como su autor real. El valor por
-- defecto ya es auth.uid(), pero la politica tambien impide enviar otro UUID.
drop policy if exists clientes_crear_recepcion on public.clientes;
create policy clientes_crear_recepcion
on public.clientes for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and creado_por = (select auth.uid())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

drop policy if exists vehiculos_crear_recepcion on public.vehiculos;
create policy vehiculos_crear_recepcion
on public.vehiculos for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and creado_por = (select auth.uid())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

drop policy if exists casos_crear_recepcion on public.casos_diagnosticos;
create policy casos_crear_recepcion
on public.casos_diagnosticos for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and recepcion_id = (select auth.uid())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

drop policy if exists asignaciones_crear_recepcion on public.asignaciones;
create policy asignaciones_crear_recepcion
on public.asignaciones for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and asignado_por = (select auth.uid())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

-- Los campos de autoria no pueden cambiar despues de crear la fila, ni siquiera
-- por accidente desde una futura pantalla de edicion.
create or replace function public.impedir_cambio_autoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) ->> tg_argv[0])
     is distinct from (to_jsonb(old) ->> tg_argv[0]) then
    raise exception 'El campo de autoria % no se puede modificar.', tg_argv[0];
  end if;

  return new;
end;
$$;

drop trigger if exists clientes_proteger_autoria on public.clientes;
create trigger clientes_proteger_autoria
before update on public.clientes
for each row execute function public.impedir_cambio_autoria('creado_por');

drop trigger if exists vehiculos_proteger_autoria on public.vehiculos;
create trigger vehiculos_proteger_autoria
before update on public.vehiculos
for each row execute function public.impedir_cambio_autoria('creado_por');

drop trigger if exists casos_proteger_autoria on public.casos_diagnosticos;
create trigger casos_proteger_autoria
before update on public.casos_diagnosticos
for each row execute function public.impedir_cambio_autoria('recepcion_id');

drop trigger if exists asignaciones_proteger_autoria on public.asignaciones;
create trigger asignaciones_proteger_autoria
before update on public.asignaciones
for each row execute function public.impedir_cambio_autoria('asignado_por');

revoke all on function public.impedir_cambio_autoria() from public, anon, authenticated;

-- Administracion y Recepcion conservan la actualizacion normal de casos. Un
-- mecanico ya no puede editar toda la fila directamente.
drop policy if exists casos_actualizar_segun_rol on public.casos_diagnosticos;
create policy casos_actualizar_recepcion
on public.casos_diagnosticos for update
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
)
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

-- Esta funcion entrega al mecanico una operacion pequena y controlada: solo
-- puede actualizar el estado tecnico y la conclusion de un caso asignado a el.
create or replace function public.actualizar_diagnostico_mecanico(
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

  update public.casos_diagnosticos
  set estado = estado_nuevo,
      conclusion_tecnica = nullif(trim(conclusion_nueva), '')
  where id = caso_objetivo
    and taller_id = (select public.taller_actual())
    and mecanico_asignado_id = (select auth.uid());

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

commit;
