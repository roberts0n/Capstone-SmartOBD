-- primero reviso los registros existentes; no borro ni corrijo datos desde aqui
do $$
begin
  if exists (
    select 1 from public.clientes
    where telefono is null or char_length(telefono) <> 12
      or telefono !~ '^[+]56([29][0-9]{8}|(32|33|34|35|41|42|43|45|51|52|53|55|57|58|61|63|64|65|67|71|72|73|75)[0-9]{7}|44[2-9][0-9]{6})$'
  ) then
    raise exception 'Hay telefonos pendientes de corregir antes de aplicar la migracion.';
  end if;

  if exists (
    select 1 from public.vehiculos
    where patente is null or char_length(patente) <> 6
      or patente !~ '^([A-Z]{2}[0-9]{4}|[BCDFGHJKLPRSTVWXYZ]{4}[0-9]{2})$'
  ) then
    raise exception 'Hay patentes pendientes de corregir antes de aplicar la migracion.';
  end if;
end;
$$;

alter table public.clientes
  alter column telefono set not null,
  add constraint clientes_telefono_chileno_check check (
    char_length(telefono) = 12
    and telefono ~ '^[+]56([29][0-9]{8}|(32|33|34|35|41|42|43|45|51|52|53|55|57|58|61|63|64|65|67|71|72|73|75)[0-9]{7}|44[2-9][0-9]{6})$'
  );

alter table public.vehiculos
  alter column patente set not null,
  add constraint vehiculos_patente_chilena_check check (
    char_length(patente) = 6
    and patente ~ '^([A-Z]{2}[0-9]{4}|[BCDFGHJKLPRSTVWXYZ]{4}[0-9]{2})$'
  );

-- dejo los telefonos compartidos y conservo la unicidad de patente por taller
-- no cambio permisos, vin, casos ni lecturas del escaner
