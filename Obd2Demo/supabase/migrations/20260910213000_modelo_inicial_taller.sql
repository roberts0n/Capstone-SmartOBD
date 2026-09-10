create extension if not exists pgcrypto;

create type public.rol_taller as enum (
  'administrador',
  'recepcion',
  'mecanico'
);

create type public.estado_caso as enum (
  'ingresado',
  'diagnostico_inicial',
  'asignado',
  'en_revision',
  'diagnosticado',
  'cerrado'
);

create type public.prioridad_caso as enum (
  'baja',
  'normal',
  'alta',
  'urgente'
);

create type public.estado_asignacion as enum (
  'activa',
  'finalizada',
  'cancelada'
);

create table public.talleres (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 2 and 120),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  taller_id uuid not null references public.talleres(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 2 and 120),
  rol public.rol_taller not null,
  especialidad text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, taller_id)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 2 and 160),
  telefono text,
  correo text,
  observaciones text,
  creado_por uuid not null default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, taller_id),
  foreign key (creado_por, taller_id)
    references public.perfiles(id, taller_id) on delete restrict
);

create table public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  cliente_id uuid not null,
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  patente text,
  marca text,
  modelo text,
  anio smallint check (anio is null or anio between 1886 and 2200),
  combustible text,
  observaciones text,
  creado_por uuid not null default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (id, taller_id),
  unique (taller_id, vin),
  foreign key (cliente_id, taller_id)
    references public.clientes(id, taller_id) on delete restrict,
  foreign key (creado_por, taller_id)
    references public.perfiles(id, taller_id) on delete restrict
);

create table public.casos_diagnosticos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  vehiculo_id uuid not null,
  motivo_ingreso text not null check (char_length(trim(motivo_ingreso)) >= 3),
  sintomas_informados text,
  estado public.estado_caso not null default 'ingresado',
  prioridad public.prioridad_caso not null default 'normal',
  recepcion_id uuid not null default auth.uid(),
  mecanico_asignado_id uuid,
  conclusion_tecnica text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cerrado_en timestamptz,
  unique (id, taller_id),
  foreign key (vehiculo_id, taller_id)
    references public.vehiculos(id, taller_id) on delete restrict,
  foreign key (recepcion_id, taller_id)
    references public.perfiles(id, taller_id) on delete restrict,
  foreign key (mecanico_asignado_id, taller_id)
    references public.perfiles(id, taller_id) on delete restrict
);

create table public.asignaciones (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  caso_id uuid not null,
  mecanico_id uuid not null,
  asignado_por uuid not null default auth.uid(),
  prioridad public.prioridad_caso not null default 'normal',
  estado public.estado_asignacion not null default 'activa',
  nota text,
  asignado_en timestamptz not null default now(),
  finalizado_en timestamptz,
  foreign key (caso_id, taller_id)
    references public.casos_diagnosticos(id, taller_id) on delete cascade,
  foreign key (mecanico_id, taller_id)
    references public.perfiles(id, taller_id) on delete restrict,
  foreign key (asignado_por, taller_id)
    references public.perfiles(id, taller_id) on delete restrict
);

create unique index asignacion_activa_por_caso
  on public.asignaciones (caso_id)
  where estado = 'activa';

create unique index vehiculo_patente_por_taller
  on public.vehiculos (taller_id, upper(patente))
  where patente is not null and trim(patente) <> '';

create index perfiles_taller_id_idx on public.perfiles (taller_id);
create index clientes_taller_id_idx on public.clientes (taller_id);
create index vehiculos_cliente_id_idx on public.vehiculos (cliente_id);
create index vehiculos_taller_id_idx on public.vehiculos (taller_id);
create index casos_vehiculo_id_idx on public.casos_diagnosticos (vehiculo_id);
create index casos_taller_estado_idx
  on public.casos_diagnosticos (taller_id, estado);
create index casos_mecanico_idx
  on public.casos_diagnosticos (mecanico_asignado_id);
create index asignaciones_mecanico_idx
  on public.asignaciones (mecanico_id, estado);

create function public.actualizar_marca_tiempo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger talleres_actualizar_marca_tiempo
before update on public.talleres
for each row execute function public.actualizar_marca_tiempo();

create trigger perfiles_actualizar_marca_tiempo
before update on public.perfiles
for each row execute function public.actualizar_marca_tiempo();

create trigger clientes_actualizar_marca_tiempo
before update on public.clientes
for each row execute function public.actualizar_marca_tiempo();

create trigger vehiculos_actualizar_marca_tiempo
before update on public.vehiculos
for each row execute function public.actualizar_marca_tiempo();

create trigger casos_actualizar_marca_tiempo
before update on public.casos_diagnosticos
for each row execute function public.actualizar_marca_tiempo();

create function public.taller_actual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select perfil.taller_id
  from public.perfiles as perfil
  where perfil.id = (select auth.uid())
    and perfil.activo
  limit 1
$$;

create function public.rol_actual()
returns public.rol_taller
language sql
stable
security definer
set search_path = ''
as $$
  select perfil.rol
  from public.perfiles as perfil
  where perfil.id = (select auth.uid())
    and perfil.activo
  limit 1
$$;

revoke all on function public.taller_actual() from public;
revoke all on function public.rol_actual() from public;
grant execute on function public.taller_actual() to authenticated;
grant execute on function public.rol_actual() to authenticated;

alter table public.talleres enable row level security;
alter table public.perfiles enable row level security;
alter table public.clientes enable row level security;
alter table public.vehiculos enable row level security;
alter table public.casos_diagnosticos enable row level security;
alter table public.asignaciones enable row level security;

revoke all on public.talleres from anon, authenticated;
revoke all on public.perfiles from anon, authenticated;
revoke all on public.clientes from anon, authenticated;
revoke all on public.vehiculos from anon, authenticated;
revoke all on public.casos_diagnosticos from anon, authenticated;
revoke all on public.asignaciones from anon, authenticated;

grant select, update on public.talleres to authenticated;
grant select, insert, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update, delete on public.vehiculos to authenticated;
grant select, insert, update on public.casos_diagnosticos to authenticated;
grant select, insert, update, delete on public.asignaciones to authenticated;

create policy talleres_leer_mismo_taller
on public.talleres for select
to authenticated
using (id = (select public.taller_actual()));

create policy talleres_actualizar_administrador
on public.talleres for update
to authenticated
using (
  id = (select public.taller_actual())
  and (select public.rol_actual()) = 'administrador'
)
with check (
  id = (select public.taller_actual())
  and (select public.rol_actual()) = 'administrador'
);

create policy perfiles_leer_mismo_taller
on public.perfiles for select
to authenticated
using (taller_id = (select public.taller_actual()));

create policy perfiles_crear_administrador
on public.perfiles for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) = 'administrador'
);

create policy perfiles_actualizar_administrador
on public.perfiles for update
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) = 'administrador'
)
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) = 'administrador'
);

create policy clientes_leer_mismo_taller
on public.clientes for select
to authenticated
using (taller_id = (select public.taller_actual()));

create policy clientes_crear_recepcion
on public.clientes for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

create policy clientes_actualizar_recepcion
on public.clientes for update
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
)
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

create policy clientes_eliminar_administrador
on public.clientes for delete
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) = 'administrador'
);

create policy vehiculos_leer_mismo_taller
on public.vehiculos for select
to authenticated
using (taller_id = (select public.taller_actual()));

create policy vehiculos_crear_recepcion
on public.vehiculos for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

create policy vehiculos_actualizar_recepcion
on public.vehiculos for update
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
)
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

create policy vehiculos_eliminar_administrador
on public.vehiculos for delete
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) = 'administrador'
);

create policy casos_leer_segun_rol
on public.casos_diagnosticos for select
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (
    (select public.rol_actual()) in ('administrador', 'recepcion')
    or mecanico_asignado_id = (select auth.uid())
  )
);

create policy casos_crear_recepcion
on public.casos_diagnosticos for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

create policy casos_actualizar_segun_rol
on public.casos_diagnosticos for update
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (
    (select public.rol_actual()) in ('administrador', 'recepcion')
    or mecanico_asignado_id = (select auth.uid())
  )
)
with check (
  taller_id = (select public.taller_actual())
  and (
    (select public.rol_actual()) in ('administrador', 'recepcion')
    or mecanico_asignado_id = (select auth.uid())
  )
);

create policy asignaciones_leer_segun_rol
on public.asignaciones for select
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (
    (select public.rol_actual()) in ('administrador', 'recepcion')
    or mecanico_id = (select auth.uid())
  )
);

create policy asignaciones_crear_recepcion
on public.asignaciones for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

create policy asignaciones_actualizar_recepcion
on public.asignaciones for update
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
)
with check (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) in ('administrador', 'recepcion')
);

create policy asignaciones_eliminar_administrador
on public.asignaciones for delete
to authenticated
using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) = 'administrador'
);

create function public.configurar_primer_administrador(
  usuario_id uuid,
  nombre_usuario text,
  nombre_taller text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevo_taller_id uuid;
begin
  if exists (select 1 from public.perfiles) then
    raise exception 'El administrador inicial ya fue configurado.';
  end if;

  if not exists (select 1 from auth.users where id = usuario_id) then
    raise exception 'El usuario indicado no existe en Supabase Auth.';
  end if;

  insert into public.talleres (nombre)
  values (trim(nombre_taller))
  returning id into nuevo_taller_id;

  insert into public.perfiles (id, taller_id, nombre, rol)
  values (
    usuario_id,
    nuevo_taller_id,
    trim(nombre_usuario),
    'administrador'
  );

  return nuevo_taller_id;
end;
$$;

revoke all on function public.configurar_primer_administrador(uuid, text, text)
from public, anon, authenticated;
