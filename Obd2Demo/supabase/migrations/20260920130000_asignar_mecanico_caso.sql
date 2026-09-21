begin;

revoke insert, update, delete on public.asignaciones from authenticated;

create or replace function public.asignar_mecanico_caso(
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
    and caso.recepcion_id = (select auth.uid())
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
    prioridad,
    nota
  )
  values (
    taller_usuario,
    caso_objetivo,
    mecanico_objetivo,
    (select auth.uid()),
    coalesce(prioridad_nueva, 'normal'),
    nullif(trim(nota_nueva), '')
  )
  returning id into asignacion_id;

  update public.casos_diagnosticos
  set mecanico_asignado_id = mecanico_objetivo,
      prioridad = coalesce(prioridad_nueva, 'normal'),
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
