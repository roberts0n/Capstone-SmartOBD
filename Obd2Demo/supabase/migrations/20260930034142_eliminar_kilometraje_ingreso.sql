-- Revierte el campo agregado para kilometraje y conserva el historial de
-- migraciones que ya fue compartido con el equipo.
alter table public.casos_diagnosticos
  drop column if exists kilometraje_ingreso;
