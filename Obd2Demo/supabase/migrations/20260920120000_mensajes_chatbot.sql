begin;

create type public.tipo_autor_chatbot as enum (
  'usuario',
  'asistente',
  'sistema',
  'herramienta'
);

create table public.mensajes_chatbot (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  caso_id uuid not null,
  autor_id uuid,
  tipo_autor public.tipo_autor_chatbot not null,
  rol_autor public.rol_taller,
  contenido text not null
    check (char_length(trim(contenido)) between 1 and 12000),
  metadatos jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadatos) = 'object'),
  creado_en timestamptz not null default now(),
  foreign key (caso_id, taller_id)
    references public.casos_diagnosticos(id, taller_id) on delete cascade,
  foreign key (autor_id, taller_id)
    references public.perfiles(id, taller_id) on delete restrict,
  check (
    (
      tipo_autor = 'usuario'
      and autor_id is not null
      and rol_autor in ('recepcion', 'mecanico')
    )
    or (
      tipo_autor in ('asistente', 'sistema', 'herramienta')
      and autor_id is null
      and rol_autor is null
    )
  )
);

create index mensajes_chatbot_caso_fecha_idx
  on public.mensajes_chatbot (caso_id, creado_en);

alter table public.mensajes_chatbot enable row level security;

revoke all on public.mensajes_chatbot from anon, authenticated;
grant select, insert on public.mensajes_chatbot to authenticated;

create policy mensajes_chatbot_leer_segun_caso
on public.mensajes_chatbot for select
to authenticated
using (
  taller_id = (select public.taller_actual())
  and exists (
    select 1
    from public.casos_diagnosticos as caso
    where caso.id = mensajes_chatbot.caso_id
      and caso.taller_id = mensajes_chatbot.taller_id
      and (
        (select public.rol_actual()) = 'recepcion'
        or (
          (select public.rol_actual()) = 'mecanico'
          and caso.mecanico_asignado_id = (select auth.uid())
        )
      )
  )
);

create policy mensajes_chatbot_escribir_responsable
on public.mensajes_chatbot for insert
to authenticated
with check (
  taller_id = (select public.taller_actual())
  and tipo_autor = 'usuario'
  and autor_id = (select auth.uid())
  and rol_autor = (select public.rol_actual())
  and exists (
    select 1
    from public.casos_diagnosticos as caso
    where caso.id = mensajes_chatbot.caso_id
      and caso.taller_id = mensajes_chatbot.taller_id
      and (
        (
          (select public.rol_actual()) = 'recepcion'
          and caso.recepcion_id = (select auth.uid())
          and caso.estado in ('ingresado', 'diagnostico_inicial')
        )
        or (
          (select public.rol_actual()) = 'mecanico'
          and caso.mecanico_asignado_id = (select auth.uid())
          and caso.estado in ('asignado', 'en_revision', 'diagnosticado')
        )
      )
  )
);

commit;
