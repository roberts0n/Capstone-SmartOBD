-- Solo agrega el estado de primer acceso y conserva las protecciones previas.
-- No crea tablas, no cambia roles ni modifica políticas de datos del taller.
begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'perfiles'
      and column_name in (
        'primer_login', 'password_changed',
        'requiere_cambio_password', 'must_change_password'
      )
  ) then
    raise exception
      'Existe una columna equivalente de primer login en perfiles. Revisarla antes de aplicar esta migración.';
  end if;
end;
$$;

-- Las filas existentes reciben false, así no se bloquea al administrador ni a
-- las cuentas anteriores. Las cuentas futuras recibirán true por defecto.
alter table public.perfiles
  add column if not exists debe_cambiar_password boolean not null default false;

alter table public.perfiles
  alter column debe_cambiar_password set default true;

-- El propio usuario puede leer solo su perfil para saber que debe cambiar la
-- contraseña, incluso si aún no puede acceder a los datos del taller.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'perfiles'
      and policyname = 'perfiles_leer_propio'
  ) then
    create policy perfiles_leer_propio
    on public.perfiles for select
    to authenticated
    using (id = (select auth.uid()));
  end if;
end;
$$;

-- Las políticas existentes ya llaman a estas dos funciones. Mientras el
-- cambio sea obligatorio, ambas devuelven null y niegan acceso al taller sin
-- reescribir políticas de clientes, vehículos, casos o asignaciones.
create or replace function public.taller_actual()
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
    and not perfil.debe_cambiar_password
  limit 1
$$;

create or replace function public.rol_actual()
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
    and not perfil.debe_cambiar_password
  limit 1
$$;

-- Se mantienen los grants originales: nadie obtiene INSERT/UPDATE general en
-- perfiles desde la app. La marca se cambia solo desde la Edge Function.
commit;
