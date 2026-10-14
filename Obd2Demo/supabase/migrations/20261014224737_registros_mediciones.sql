begin;

create schema if not exists smartobd_interno;
revoke all on schema smartobd_interno from public, anon, authenticated;

create table public.registros_mediciones (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null,
  taller_id uuid not null default public.taller_actual(),
  guardado_por uuid not null default auth.uid(),
  titulo text check (titulo is null or char_length(trim(titulo)) between 1 and 100),
  inicio timestamptz not null check (isfinite(inicio)),
  duracion_solicitada_ms double precision not null check (duracion_solicitada_ms between 1000 and 600000),
  duracion_real_ms double precision not null check (duracion_real_ms > 0 and duracion_real_ms <= 660000),
  estado text not null check (estado in ('completo', 'parcial')),
  motivo_fin text not null check (char_length(trim(motivo_fin)) between 1 and 300),
  series jsonb not null check (jsonb_typeof(series) = 'array' and octet_length(series::text) <= 1500000),
  foreign key (caso_id, taller_id) references public.casos_diagnosticos(id, taller_id) on delete cascade,
  foreign key (guardado_por, taller_id) references public.perfiles(id, taller_id) on delete restrict,
  unique (caso_id, inicio),
  check (estado <> 'completo' or duracion_real_ms >= duracion_solicitada_ms)
);

create index registros_mediciones_caso_fecha_idx on public.registros_mediciones(caso_id, inicio desc, id desc);
create index registros_mediciones_autor_taller_idx on public.registros_mediciones(guardado_por, taller_id);
create index registros_mediciones_taller_idx on public.registros_mediciones(taller_id);
alter table public.registros_mediciones enable row level security;

create policy registros_mediciones_leer_mecanico on public.registros_mediciones
for select to authenticated using (
  taller_id = (select public.taller_actual())
  and (select public.rol_actual()) = 'mecanico'
  and exists (select 1 from public.asignaciones as asignacion
    where asignacion.caso_id = registros_mediciones.caso_id
      and asignacion.taller_id = registros_mediciones.taller_id
      and asignacion.mecanico_id = (select auth.uid()) and asignacion.estado = 'activa')
);

create policy registros_mediciones_crear_mecanico on public.registros_mediciones
for insert to authenticated with check (
  taller_id = (select public.taller_actual()) and guardado_por = (select auth.uid())
  and (select public.rol_actual()) = 'mecanico'
  and exists (select 1 from public.casos_diagnosticos as caso
    where caso.id = registros_mediciones.caso_id and caso.taller_id = registros_mediciones.taller_id
      and caso.estado = 'en_revision')
);

-- valido tambien las inserciones directas; no dependo de que se use nuestro boton
create function smartobd_interno.validar_registro_mediciones()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  estado_caso public.estado_caso;
  serie jsonb;
  muestra jsonb;
  pids text[] := '{}';
  tiempo_anterior double precision;
  tiempo double precision;
  validas integer;
  total_validas integer := 0;
begin
  if (select public.rol_actual()) is distinct from 'mecanico'::public.rol_taller
    or new.taller_id is distinct from (select public.taller_actual())
    or new.guardado_por is distinct from (select auth.uid()) then
    raise exception 'Se necesita un mecanico habilitado para guardar mediciones.';
  end if;
  -- mantengo el orden de bloqueo que ya usamos al asignar y comenzar la revision
  select caso.estado into estado_caso from public.casos_diagnosticos as caso
  where caso.id = new.caso_id and caso.taller_id = new.taller_id for update;
  if not found then raise exception 'El caso no esta disponible para este mecanico.'; end if;
  perform 1 from public.asignaciones as asignacion
  where asignacion.caso_id = new.caso_id and asignacion.taller_id = new.taller_id
    and asignacion.mecanico_id = (select auth.uid()) and asignacion.estado = 'activa' for update;
  if not found then raise exception 'El caso no esta disponible para este mecanico.'; end if;
  if estado_caso <> 'en_revision' then raise exception 'El caso debe estar en revision para guardar mediciones.'; end if;

  if new.series is null or jsonb_typeof(new.series) is distinct from 'array'
    or jsonb_array_length(new.series) not between 1 and 3
    or octet_length(new.series::text) > 1500000 then
    raise exception 'El registro debe contener de una a tres series dentro del limite permitido.';
  end if;
  for serie in select value from jsonb_array_elements(new.series) loop
    if jsonb_typeof(serie) is distinct from 'object' then raise exception 'Serie de mediciones no valida.'; end if;
    if not serie ?& array['pidCodigo','nombre','unidad','campo','ecu','estado','muestras']
      or serie - array['pidCodigo','nombre','unidad','campo','ecu','estado','muestras'] <> '{}'::jsonb
      or jsonb_typeof(serie->'pidCodigo') is distinct from 'string'
      or (serie->>'pidCodigo') !~ '^01[0-9A-F]{2}$'
      or jsonb_typeof(serie->'nombre') is distinct from 'string'
      or char_length(trim(serie->>'nombre')) not between 1 and 160
      or jsonb_typeof(serie->'unidad') is distinct from 'string'
      or char_length(trim(serie->>'unidad')) not between 1 and 24
      or jsonb_typeof(serie->'estado') is distinct from 'string'
      or (serie->>'estado') not in ('disponible','sin-lectura') then
      raise exception 'Serie de mediciones no valida.';
    end if;
    if (serie->>'pidCodigo') = any(pids) or not exists (
      select 1 from public.catalogo_pids where codigo = serie->>'pidCodigo'
    ) then raise exception 'PID repetido o inexistente en el catalogo.'; end if;
    pids := array_append(pids, serie->>'pidCodigo');
    if jsonb_typeof(serie->'campo') <> 'null' and
      (jsonb_typeof(serie->'campo') <> 'string' or char_length(trim(serie->>'campo')) not between 1 and 80) then
      raise exception 'Campo de medicion no valido.';
    end if;
    if jsonb_typeof(serie->'ecu') <> 'null' and
      (jsonb_typeof(serie->'ecu') <> 'string' or (serie->>'ecu') !~ '^[0-9A-F]{2,8}$') then
      raise exception 'Origen ECU no valido.';
    end if;
    if jsonb_typeof(serie->'muestras') is distinct from 'array' then raise exception 'Muestras no validas.'; end if;
    if jsonb_array_length(serie->'muestras') > 2400 then raise exception 'Demasiadas muestras en una serie.'; end if;
    tiempo_anterior := -1;
    validas := 0;
    for muestra in select value from jsonb_array_elements(serie->'muestras') loop
      if jsonb_typeof(muestra) is distinct from 'object' then raise exception 'Muestra no valida.'; end if;
      if not muestra ?& array['tiempoMs','valor'] or muestra - array['tiempoMs','valor'] <> '{}'::jsonb
        or jsonb_typeof(muestra->'tiempoMs') is distinct from 'number'
        or jsonb_typeof(muestra->'valor') not in ('number','null') then raise exception 'Muestra no valida.'; end if;
      tiempo := (muestra->>'tiempoMs')::double precision;
      if tiempo < 0 or tiempo > new.duracion_real_ms or tiempo < tiempo_anterior then
        raise exception 'Los tiempos de las muestras no son validos.';
      end if;
      tiempo_anterior := tiempo;
      if jsonb_typeof(muestra->'valor') = 'number' then
        if abs((muestra->>'valor')::numeric) > 1.7976931348623157e308::numeric then raise exception 'Valor numerico fuera de rango.'; end if;
        validas := validas + 1;
      end if;
    end loop;
    if new.estado = 'completo' and (validas = 0 or serie->>'estado' <> 'disponible') then
      raise exception 'Un registro completo requiere lecturas validas en cada serie.';
    end if;
    total_validas := total_validas + validas;
  end loop;
  if total_validas = 0 then raise exception 'No hay mediciones validas para guardar.'; end if;
  return new;
end;
$$;
revoke all on function smartobd_interno.validar_registro_mediciones() from public, anon, authenticated;
create trigger registros_mediciones_validar before insert on public.registros_mediciones
for each row execute function smartobd_interno.validar_registro_mediciones();

revoke all on public.registros_mediciones from public, anon, authenticated;
grant select on public.registros_mediciones to authenticated;
grant insert(caso_id, taller_id, guardado_por, titulo, inicio, duracion_solicitada_ms, duracion_real_ms, estado, motivo_fin, series)
on public.registros_mediciones to authenticated;

create function public.guardar_registro_mediciones(
  caso_objetivo uuid, inicio_registro timestamptz, duracion_solicitada double precision,
  duracion_real double precision, estado_registro text, motivo_finalizacion text,
  series_registro jsonb, titulo_registro text default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  existente public.registros_mediciones%rowtype;
  nuevo_id uuid;
begin
  if (select public.rol_actual()) is distinct from 'mecanico'::public.rol_taller then
    raise exception 'Se necesita un mecanico habilitado para guardar mediciones.';
  end if;
  -- inicio y caso identifican la misma captura aunque se haya perdido la respuesta
  select * into existente from public.registros_mediciones where caso_id = caso_objetivo and inicio = inicio_registro;
  if not found then
    insert into public.registros_mediciones(caso_id, titulo, inicio, duracion_solicitada_ms, duracion_real_ms, estado, motivo_fin, series)
    values(caso_objetivo, nullif(trim(titulo_registro),''), inicio_registro, duracion_solicitada,
      duracion_real, estado_registro, trim(motivo_finalizacion), series_registro)
    on conflict (caso_id, inicio) do nothing returning id into nuevo_id;
    if nuevo_id is not null then return nuevo_id; end if;
    select * into existente from public.registros_mediciones where caso_id = caso_objetivo and inicio = inicio_registro;
  end if;
  if existente.id is null or existente.guardado_por is distinct from (select auth.uid())
    or existente.titulo is distinct from nullif(trim(titulo_registro),'')
    or existente.duracion_solicitada_ms is distinct from duracion_solicitada
    or existente.duracion_real_ms is distinct from duracion_real
    or existente.estado is distinct from estado_registro
    or existente.motivo_fin is distinct from trim(motivo_finalizacion)
    or existente.series is distinct from series_registro then
    raise exception 'Esta captura ya fue guardada con otros datos; no se reemplaza.';
  end if;
  return existente.id;
end;
$$;
revoke all on function public.guardar_registro_mediciones(uuid,timestamptz,double precision,double precision,text,text,jsonb,text)
from public, anon;
grant execute on function public.guardar_registro_mediciones(uuid,timestamptz,double precision,double precision,text,text,jsonb,text)
to authenticated;

-- amplio la vista previa sin duplicar toda la limpieza que ya tenemos
alter function public.alcance_eliminacion_prueba(text,uuid) set schema smartobd_interno;
create function public.alcance_eliminacion_prueba(tipo_objetivo text, registro_objetivo uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  alcance jsonb := smartobd_interno.alcance_eliminacion_prueba(tipo_objetivo,registro_objetivo);
  filas jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',registro.id,'huella',md5(to_jsonb(registro)::text)) order by registro.id),'[]'::jsonb) into filas
  from public.registros_mediciones as registro
  where registro.caso_id in (select value::uuid from jsonb_array_elements_text(alcance->'casosIds'))
    and registro.taller_id = (select public.taller_actual());
  if jsonb_array_length(filas) = 0 then return alcance; end if;
  return alcance || jsonb_build_object(
    'cantidades', (alcance->'cantidades') || jsonb_build_object('registrosMediciones',jsonb_array_length(filas)),
    'huella', md5((alcance->>'huella') || filas::text));
end;
$$;
revoke all on function public.alcance_eliminacion_prueba(text,uuid) from public, anon, authenticated;

commit;
