create table if not exists public.preferencias_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  modo_tema text not null default 'claro'
    check (modo_tema in ('claro', 'oscuro')),
  actualizado_en timestamptz not null default now()
);

alter table public.preferencias_usuario enable row level security;

revoke all on table public.preferencias_usuario from anon, authenticated;
grant select, insert, update on table public.preferencias_usuario to authenticated;

create policy "usuario lee su preferencia"
on public.preferencias_usuario
for select
to authenticated
using ((select auth.uid()) = usuario_id);

create policy "usuario crea su preferencia"
on public.preferencias_usuario
for insert
to authenticated
with check ((select auth.uid()) = usuario_id);

create policy "usuario actualiza su preferencia"
on public.preferencias_usuario
for update
to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);
