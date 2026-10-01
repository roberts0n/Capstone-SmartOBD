begin;

create or replace function public.actualizar_caso_por_snapshot_ingreso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo = 'ingreso' then
    update public.casos_diagnosticos
    set estado = 'diagnostico_inicial'
    where id = new.caso_id
      and taller_id = new.taller_id
      and estado = 'ingresado';
  end if;

  return new;
end;
$$;

revoke all on function public.actualizar_caso_por_snapshot_ingreso()
from public, anon, authenticated;

drop trigger if exists snapshot_ingreso_actualiza_caso
on public.snapshots_diagnostico;

create trigger snapshot_ingreso_actualiza_caso
after insert on public.snapshots_diagnostico
for each row
execute function public.actualizar_caso_por_snapshot_ingreso();

commit;
