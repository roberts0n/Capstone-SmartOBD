begin;

-- compruebo la asignacion en la base, no el rol que me envie la pantalla
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
declare
  taller_usuario uuid := (select public.taller_actual());
  usuario uuid := (select auth.uid());
  estado_actual public.estado_caso;
begin
  if usuario is null or taller_usuario is null
    or (select public.rol_actual()) is distinct from 'mecanico'::public.rol_taller then
    raise exception 'Solo un mecanico habilitado puede usar esta operacion.';
  end if;

  if estado_nuevo is null or estado_nuevo not in ('en_revision', 'diagnosticado') then
    raise exception 'La transicion solicitada no esta permitida.';
  end if;

  -- bloqueo primero el caso, igual que al asignarlo, para mantener el mismo orden
  select caso.estado into estado_actual
  from public.casos_diagnosticos as caso
  where caso.id = caso_objetivo and caso.taller_id = taller_usuario
  for update;

  if not found then
    raise exception 'El caso no existe o no esta asignado al mecanico actual.';
  end if;

  perform 1 from public.asignaciones as asignacion
  where asignacion.caso_id = caso_objetivo
    and asignacion.taller_id = taller_usuario
    and asignacion.mecanico_id = usuario
    and asignacion.estado = 'activa'
  for update;

  if not found then
    raise exception 'El caso no existe o no esta asignado al mecanico actual.';
  end if;

  if estado_nuevo = 'en_revision' then
    if estado_actual not in ('asignado', 'en_revision') then
      raise exception 'La transicion a revision no esta permitida desde este estado.';
    end if;
    -- si se reintenta por una respuesta perdida, no cambio nada por segunda vez
    if estado_actual = 'en_revision' then return; end if;
    update public.casos_diagnosticos
    set estado = 'en_revision'
    where id = caso_objetivo;
  else
    if estado_actual not in ('en_revision', 'diagnosticado') then
      raise exception 'La transicion a diagnosticado no esta permitida desde este estado.';
    end if;
    update public.casos_diagnosticos
    set estado = 'diagnosticado',
        conclusion_tecnica = coalesce(nullif(trim(conclusion_nueva), ''), conclusion_tecnica)
    where id = caso_objetivo;
  end if;
end;
$$;

revoke all on function public.actualizar_diagnostico_mecanico(uuid, public.estado_caso, text)
from public, anon;
grant execute on function public.actualizar_diagnostico_mecanico(uuid, public.estado_caso, text)
to authenticated;

-- dejo una entrada pequena para la accion que tenemos ahora en la app
create function public.iniciar_revision_caso(caso_objetivo uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select public.actualizar_diagnostico_mecanico(caso_objetivo, 'en_revision', null);
$$;

revoke all on function public.iniciar_revision_caso(uuid) from public, anon;
grant execute on function public.iniciar_revision_caso(uuid) to authenticated;

commit;
