-- El kilometraje pertenece a la visita u orden, no al vehiculo completo.
-- Se permite null para conservar los casos creados antes de esta migracion.
alter table public.casos_diagnosticos
  add column kilometraje_ingreso integer
  check (kilometraje_ingreso is null or kilometraje_ingreso >= 0);

comment on column public.casos_diagnosticos.kilometraje_ingreso is
  'Kilometraje informado al recibir el vehiculo para esta orden de trabajo.';
