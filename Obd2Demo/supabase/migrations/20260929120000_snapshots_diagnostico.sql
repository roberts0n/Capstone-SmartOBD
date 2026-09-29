begin;

create type public.tipo_valor_pid as enum (
  'numerico',
  'texto',
  'estructurado'
);

create type public.tipo_snapshot_diagnostico as enum (
  'ingreso',
  'intermedio',
  'cierre'
);

create type public.estado_snapshot_diagnostico as enum (
  'completo',
  'parcial'
);

create type public.motivo_snapshot_parcial as enum (
  'motor_no_arranca',
  'lecturas_incompletas',
  'conexion_interrumpida',
  'otro'
);

create type public.modo_dtc_snapshot as enum (
  '03',
  '07',
  '0A'
);

create table public.catalogo_pids (
  codigo text primary key
    check (codigo ~ '^01[0-9A-F]{2}$'),
  nombre text not null
    check (char_length(trim(nombre)) between 3 and 160),
  unidad text,
  categoria text not null
    check (categoria in (
      'Motor y movimiento',
      'Combustible y emisiones',
      'Oxigeno y mezcla',
      'Temperaturas',
      'Estados y configuracion'
    )),
  tipo_valor public.tipo_valor_pid not null
);

create table public.snapshots_diagnostico (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  caso_id uuid not null,
  secuencia integer not null check (secuencia > 0),
  tipo public.tipo_snapshot_diagnostico not null,
  estado public.estado_snapshot_diagnostico not null,
  motivo_parcial public.motivo_snapshot_parcial,
  realizado_por uuid not null default auth.uid(),
  unique (caso_id, secuencia),
  foreign key (caso_id, taller_id)
    references public.casos_diagnosticos(id, taller_id) on delete cascade,
  foreign key (realizado_por, taller_id)
    references public.perfiles(id, taller_id) on delete restrict,
  check (
    (estado = 'completo' and motivo_parcial is null)
    or (estado = 'parcial' and motivo_parcial is not null)
  )
);

create unique index snapshots_un_ingreso_por_caso
  on public.snapshots_diagnostico (caso_id)
  where tipo = 'ingreso';

create unique index snapshots_un_cierre_por_caso
  on public.snapshots_diagnostico (caso_id)
  where tipo = 'cierre';

create table public.valores_pid_snapshot (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null
    references public.snapshots_diagnostico(id) on delete cascade,
  pid_codigo text not null
    references public.catalogo_pids(codigo) on delete restrict,
  valor jsonb not null check (valor <> 'null'::jsonb),
  unique (snapshot_id, pid_codigo)
);

create table public.codigos_dtc_snapshot (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null
    references public.snapshots_diagnostico(id) on delete cascade,
  codigo text not null
    check (codigo ~ '^[PCBU][0-3][0-9A-F]{3}$'),
  modo_obd public.modo_dtc_snapshot not null,
  ecu text check (ecu is null or ecu ~ '^[0-9A-F]{2,8}$')
);

create unique index dtc_unico_por_snapshot
  on public.codigos_dtc_snapshot (
    snapshot_id,
    codigo,
    modo_obd,
    coalesce(ecu, '')
  );

-- este catalogo refleja lo que el traductor actual conoce. las formulas siguen
-- en typescript para no mezclar calculos obd con datos descriptivos.
insert into public.catalogo_pids (
  codigo,
  nombre,
  unidad,
  categoria,
  tipo_valor
)
values
  ('0101', 'Estado del sistema desde borrado de DTC', null, 'Estados y configuracion', 'estructurado'),
  ('0102', 'DTC que origino el cuadro congelado', null, 'Estados y configuracion', 'estructurado'),
  ('0103', 'Estado del sistema de combustible', null, 'Estados y configuracion', 'estructurado'),
  ('0104', 'Carga calculada del motor', '%', 'Motor y movimiento', 'numerico'),
  ('0105', 'Temperatura del refrigerante', '°C', 'Temperaturas', 'numerico'),
  ('0106', 'Ajuste corto de combustible banco 1 (y 3 si existe)', '%', 'Oxigeno y mezcla', 'estructurado'),
  ('0107', 'Ajuste largo de combustible banco 1 (y 3 si existe)', '%', 'Oxigeno y mezcla', 'estructurado'),
  ('0108', 'Ajuste corto de combustible banco 2 (y 4 si existe)', '%', 'Oxigeno y mezcla', 'estructurado'),
  ('0109', 'Ajuste largo de combustible banco 2 (y 4 si existe)', '%', 'Oxigeno y mezcla', 'estructurado'),
  ('010A', 'Presion de combustible', 'kPa', 'Combustible y emisiones', 'numerico'),
  ('010B', 'Presion del multiple de admision', 'kPa', 'Motor y movimiento', 'numerico'),
  ('010C', 'RPM del motor', 'rpm', 'Motor y movimiento', 'numerico'),
  ('010D', 'Velocidad del vehiculo', 'km/h', 'Motor y movimiento', 'numerico'),
  ('010E', 'Avance de encendido', '°', 'Motor y movimiento', 'numerico'),
  ('010F', 'Temperatura del aire de admision', '°C', 'Temperaturas', 'numerico'),
  ('0110', 'Caudal de aire MAF', 'g/s', 'Motor y movimiento', 'numerico'),
  ('0111', 'Posicion de la mariposa', '%', 'Motor y movimiento', 'numerico'),
  ('0112', 'Estado del aire secundario solicitado', null, 'Estados y configuracion', 'estructurado'),
  ('0113', 'Sensores de oxigeno presentes (2 bancos)', null, 'Estados y configuracion', 'estructurado'),
  ('0114', 'Sensor de oxigeno 1: voltaje y ajuste', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0115', 'Sensor de oxigeno 2: voltaje y ajuste', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0116', 'Sensor de oxigeno 3: voltaje y ajuste', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0117', 'Sensor de oxigeno 4: voltaje y ajuste', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0118', 'Sensor de oxigeno 5: voltaje y ajuste', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0119', 'Sensor de oxigeno 6: voltaje y ajuste', null, 'Oxigeno y mezcla', 'estructurado'),
  ('011A', 'Sensor de oxigeno 7: voltaje y ajuste', null, 'Oxigeno y mezcla', 'estructurado'),
  ('011B', 'Sensor de oxigeno 8: voltaje y ajuste', null, 'Oxigeno y mezcla', 'estructurado'),
  ('011C', 'Norma OBD compatible', null, 'Estados y configuracion', 'texto'),
  ('011D', 'Sensores de oxigeno presentes (4 bancos)', null, 'Estados y configuracion', 'estructurado'),
  ('011E', 'Estado de entrada auxiliar PTO', null, 'Estados y configuracion', 'estructurado'),
  ('011F', 'Tiempo desde el arranque', 's', 'Motor y movimiento', 'numerico'),
  ('0121', 'Distancia recorrida con MIL encendida', 'km', 'Estados y configuracion', 'numerico'),
  ('0122', 'Presion del riel relativa al vacio', 'kPa', 'Combustible y emisiones', 'numerico'),
  ('0123', 'Presion manometrica del riel (inyeccion directa)', 'kPa', 'Combustible y emisiones', 'numerico'),
  ('0124', 'Sensor de oxigeno 1: lambda y voltaje', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0125', 'Sensor de oxigeno 2: lambda y voltaje', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0126', 'Sensor de oxigeno 3: lambda y voltaje', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0127', 'Sensor de oxigeno 4: lambda y voltaje', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0128', 'Sensor de oxigeno 5: lambda y voltaje', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0129', 'Sensor de oxigeno 6: lambda y voltaje', null, 'Oxigeno y mezcla', 'estructurado'),
  ('012A', 'Sensor de oxigeno 7: lambda y voltaje', null, 'Oxigeno y mezcla', 'estructurado'),
  ('012B', 'Sensor de oxigeno 8: lambda y voltaje', null, 'Oxigeno y mezcla', 'estructurado'),
  ('012C', 'EGR solicitada', '%', 'Combustible y emisiones', 'numerico'),
  ('012D', 'Error de EGR', '%', 'Combustible y emisiones', 'numerico'),
  ('012E', 'Purga evaporativa comandada', '%', 'Combustible y emisiones', 'numerico'),
  ('012F', 'Nivel del tanque de combustible', '%', 'Combustible y emisiones', 'numerico'),
  ('0130', 'Ciclos de calentamiento desde borrado de DTC', 'ciclos', 'Estados y configuracion', 'numerico'),
  ('0131', 'Distancia desde borrado de DTC', 'km', 'Estados y configuracion', 'numerico'),
  ('0132', 'Presion de vapor EVAP', 'Pa', 'Combustible y emisiones', 'numerico'),
  ('0133', 'Presion barometrica', 'kPa', 'Motor y movimiento', 'numerico'),
  ('0134', 'Sensor de oxigeno 1: lambda y corriente', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0135', 'Sensor de oxigeno 2: lambda y corriente', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0136', 'Sensor de oxigeno 3: lambda y corriente', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0137', 'Sensor de oxigeno 4: lambda y corriente', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0138', 'Sensor de oxigeno 5: lambda y corriente', null, 'Oxigeno y mezcla', 'estructurado'),
  ('0139', 'Sensor de oxigeno 6: lambda y corriente', null, 'Oxigeno y mezcla', 'estructurado'),
  ('013A', 'Sensor de oxigeno 7: lambda y corriente', null, 'Oxigeno y mezcla', 'estructurado'),
  ('013B', 'Sensor de oxigeno 8: lambda y corriente', null, 'Oxigeno y mezcla', 'estructurado'),
  ('013C', 'Temperatura del catalizador banco 1 sensor 1', '°C', 'Temperaturas', 'numerico'),
  ('013D', 'Temperatura del catalizador banco 2 sensor 1', '°C', 'Temperaturas', 'numerico'),
  ('013E', 'Temperatura del catalizador banco 1 sensor 2', '°C', 'Temperaturas', 'numerico'),
  ('013F', 'Temperatura del catalizador banco 2 sensor 2', '°C', 'Temperaturas', 'numerico'),
  ('0141', 'Estado de monitores en este ciclo', null, 'Estados y configuracion', 'estructurado'),
  ('0142', 'Voltaje del modulo de control', 'V', 'Motor y movimiento', 'numerico'),
  ('0143', 'Carga absoluta', '%', 'Motor y movimiento', 'numerico'),
  ('0144', 'Relacion de equivalencia solicitada (lambda)', 'lambda', 'Oxigeno y mezcla', 'numerico'),
  ('0145', 'Posicion relativa de la mariposa', '%', 'Motor y movimiento', 'numerico'),
  ('0146', 'Temperatura ambiente', '°C', 'Temperaturas', 'numerico'),
  ('0147', 'Posicion absoluta de la mariposa B', '%', 'Motor y movimiento', 'numerico'),
  ('0148', 'Posicion absoluta de la mariposa C', '%', 'Motor y movimiento', 'numerico'),
  ('0149', 'Posicion del pedal D', '%', 'Motor y movimiento', 'numerico'),
  ('014A', 'Posicion del pedal E', '%', 'Motor y movimiento', 'numerico'),
  ('014B', 'Posicion del pedal F', '%', 'Motor y movimiento', 'numerico'),
  ('014C', 'Actuador de la mariposa solicitado', '%', 'Motor y movimiento', 'numerico'),
  ('014D', 'Tiempo de funcionamiento con MIL encendida', 'min', 'Estados y configuracion', 'numerico'),
  ('014E', 'Tiempo desde borrado de DTC', 'min', 'Estados y configuracion', 'numerico'),
  ('014F', 'Configuracion de escalas OBD', null, 'Estados y configuracion', 'estructurado'),
  ('0150', 'Configuracion de escala MAF', null, 'Estados y configuracion', 'estructurado'),
  ('0151', 'Combustible utilizado', null, 'Estados y configuracion', 'estructurado'),
  ('0152', 'Porcentaje de etanol', '%', 'Combustible y emisiones', 'numerico'),
  ('0153', 'Presion absoluta de vapor EVAP', 'kPa', 'Combustible y emisiones', 'numerico'),
  ('0154', 'Presion de vapor EVAP de rango ampliado', 'Pa', 'Combustible y emisiones', 'numerico'),
  ('0155', 'Ajuste corto de combustible secundario banco 1 (y 3 si existe)', '%', 'Oxigeno y mezcla', 'estructurado'),
  ('0156', 'Ajuste largo de combustible secundario banco 1 (y 3 si existe)', '%', 'Oxigeno y mezcla', 'estructurado'),
  ('0157', 'Ajuste corto de combustible secundario banco 2 (y 4 si existe)', '%', 'Oxigeno y mezcla', 'estructurado'),
  ('0158', 'Ajuste largo de combustible secundario banco 2 (y 4 si existe)', '%', 'Oxigeno y mezcla', 'estructurado'),
  ('0159', 'Presion absoluta del riel', 'kPa', 'Combustible y emisiones', 'numerico'),
  ('015A', 'Posicion relativa del pedal', '%', 'Motor y movimiento', 'numerico'),
  ('015B', 'Carga restante de bateria hibrida/EV (SOC)', '%', 'Motor y movimiento', 'numerico'),
  ('015C', 'Temperatura del aceite', '°C', 'Temperaturas', 'numerico'),
  ('015D', 'Avance de la inyeccion', '°', 'Combustible y emisiones', 'numerico'),
  ('015E', 'Caudal de combustible', 'L/h', 'Combustible y emisiones', 'numerico'),
  ('015F', 'Requisitos de emisiones', null, 'Estados y configuracion', 'estructurado');

alter table public.catalogo_pids enable row level security;
alter table public.snapshots_diagnostico enable row level security;
alter table public.valores_pid_snapshot enable row level security;
alter table public.codigos_dtc_snapshot enable row level security;

revoke all on public.catalogo_pids from anon, authenticated;
revoke all on public.snapshots_diagnostico from anon, authenticated;
revoke all on public.valores_pid_snapshot from anon, authenticated;
revoke all on public.codigos_dtc_snapshot from anon, authenticated;

grant select on public.catalogo_pids to authenticated;
grant select on public.snapshots_diagnostico to authenticated;
grant select on public.valores_pid_snapshot to authenticated;
grant select on public.codigos_dtc_snapshot to authenticated;

create or replace function public.puede_consultar_caso_diagnostico(
  caso_objetivo uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.casos_diagnosticos as caso
    where caso.id = caso_objetivo
      and caso.taller_id = (select public.taller_actual())
      and (
        (select public.rol_actual()) = 'recepcion'
        or (
          (select public.rol_actual()) = 'mecanico'
          and exists (
            select 1
            from public.asignaciones as asignacion
            where asignacion.caso_id = caso.id
              and asignacion.taller_id = caso.taller_id
              and asignacion.mecanico_id = (select auth.uid())
              and asignacion.estado = 'activa'
          )
        )
      )
  )
$$;

revoke all on function public.puede_consultar_caso_diagnostico(uuid)
from public, anon;
grant execute on function public.puede_consultar_caso_diagnostico(uuid)
to authenticated;

create policy catalogo_pids_leer_autenticado
on public.catalogo_pids for select
to authenticated
using ((select public.taller_actual()) is not null);

create policy snapshots_leer_segun_caso
on public.snapshots_diagnostico for select
to authenticated
using ((select public.puede_consultar_caso_diagnostico(caso_id)));

create policy valores_snapshot_leer_segun_caso
on public.valores_pid_snapshot for select
to authenticated
using (
  exists (
    select 1
    from public.snapshots_diagnostico as snapshot
    where snapshot.id = valores_pid_snapshot.snapshot_id
      and (select public.puede_consultar_caso_diagnostico(snapshot.caso_id))
  )
);

create policy dtc_snapshot_leer_segun_caso
on public.codigos_dtc_snapshot for select
to authenticated
using (
  exists (
    select 1
    from public.snapshots_diagnostico as snapshot
    where snapshot.id = codigos_dtc_snapshot.snapshot_id
      and (select public.puede_consultar_caso_diagnostico(snapshot.caso_id))
  )
);

create or replace function public.guardar_snapshot_diagnostico(
  caso_objetivo uuid,
  tipo_nuevo public.tipo_snapshot_diagnostico,
  estado_nuevo public.estado_snapshot_diagnostico,
  motivo_parcial_nuevo public.motivo_snapshot_parcial default null,
  valores_nuevos jsonb default '[]'::jsonb,
  codigos_dtc_nuevos jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  taller_usuario uuid;
  rol_usuario public.rol_taller;
  estado_caso_actual public.estado_caso;
  recepcion_responsable uuid;
  secuencia_nueva integer;
  snapshot_nuevo uuid;
begin
  taller_usuario := (select public.taller_actual());
  rol_usuario := (select public.rol_actual());

  if taller_usuario is null or rol_usuario is null then
    raise exception 'La sesion no tiene acceso al taller.';
  end if;

  if jsonb_typeof(valores_nuevos) <> 'array'
     or jsonb_typeof(codigos_dtc_nuevos) <> 'array' then
    raise exception 'Los valores PID y DTC deben enviarse como listas.';
  end if;

  if jsonb_array_length(valores_nuevos) > 256
     or jsonb_array_length(codigos_dtc_nuevos) > 256 then
    raise exception 'El snapshot supera el limite de elementos permitido.';
  end if;

  if estado_nuevo = 'completo' and motivo_parcial_nuevo is not null then
    raise exception 'Un snapshot completo no debe indicar motivo parcial.';
  end if;

  if estado_nuevo = 'parcial' and motivo_parcial_nuevo is null then
    raise exception 'Un snapshot parcial debe indicar su motivo.';
  end if;

  if estado_nuevo = 'completo'
     and jsonb_array_length(valores_nuevos) = 0 then
    raise exception 'Un snapshot completo debe contener al menos un valor PID.';
  end if;

  select caso.estado, caso.recepcion_responsable_id
  into estado_caso_actual, recepcion_responsable
  from public.casos_diagnosticos as caso
  where caso.id = caso_objetivo
    and caso.taller_id = taller_usuario
  for update;

  if not found then
    raise exception 'El caso no existe o pertenece a otro taller.';
  end if;

  if estado_caso_actual = 'cerrado' then
    raise exception 'No se pueden agregar snapshots a un caso cerrado.';
  end if;

  if rol_usuario = 'recepcion' then
    if tipo_nuevo <> 'ingreso'
       or recepcion_responsable <> (select auth.uid())
       or estado_caso_actual not in ('ingresado', 'diagnostico_inicial') then
      raise exception 'Recepcion solo puede guardar el snapshot de ingreso de su caso.';
    end if;
  elsif rol_usuario = 'mecanico' then
    if tipo_nuevo not in ('intermedio', 'cierre')
       or estado_caso_actual not in ('asignado', 'en_revision', 'diagnosticado')
       or not exists (
         select 1
         from public.asignaciones as asignacion
         where asignacion.caso_id = caso_objetivo
           and asignacion.taller_id = taller_usuario
           and asignacion.mecanico_id = (select auth.uid())
           and asignacion.estado = 'activa'
       ) then
      raise exception 'El mecanico no tiene una asignacion activa para este caso.';
    end if;
  else
    raise exception 'El perfil actual no guarda snapshots de diagnostico.';
  end if;

  if tipo_nuevo in ('ingreso', 'cierre')
     and exists (
       select 1
       from public.snapshots_diagnostico as snapshot
       where snapshot.caso_id = caso_objetivo
         and snapshot.tipo = tipo_nuevo
     ) then
    raise exception 'Ya existe un snapshot de este tipo para el caso.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(valores_nuevos) as elemento
    where jsonb_typeof(elemento) <> 'object'
      or not (elemento ? 'pidCodigo')
      or not (elemento ? 'valor')
      or elemento -> 'valor' = 'null'::jsonb
      or upper(trim(elemento ->> 'pidCodigo')) !~ '^01[0-9A-F]{2}$'
  ) then
    raise exception 'Existe un valor PID con formato invalido.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(valores_nuevos) as elemento
    where not exists (
      select 1
      from public.catalogo_pids as pid
      where pid.codigo = upper(trim(elemento ->> 'pidCodigo'))
    )
  ) then
    raise exception 'El snapshot contiene un PID que SmartOBD no interpreta.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(codigos_dtc_nuevos) as elemento
    where jsonb_typeof(elemento) <> 'object'
      or upper(trim(elemento ->> 'codigo')) !~ '^[PCBU][0-3][0-9A-F]{3}$'
      or upper(trim(elemento ->> 'modoObd')) not in ('03', '07', '0A')
      or (
        nullif(upper(trim(elemento ->> 'ecu')), '') is not null
        and upper(trim(elemento ->> 'ecu')) !~ '^[0-9A-F]{2,8}$'
      )
  ) then
    raise exception 'Existe un DTC con formato invalido.';
  end if;

  select coalesce(max(snapshot.secuencia), 0) + 1
  into secuencia_nueva
  from public.snapshots_diagnostico as snapshot
  where snapshot.caso_id = caso_objetivo;

  insert into public.snapshots_diagnostico (
    taller_id,
    caso_id,
    secuencia,
    tipo,
    estado,
    motivo_parcial,
    realizado_por
  )
  values (
    taller_usuario,
    caso_objetivo,
    secuencia_nueva,
    tipo_nuevo,
    estado_nuevo,
    motivo_parcial_nuevo,
    (select auth.uid())
  )
  returning id into snapshot_nuevo;

  insert into public.valores_pid_snapshot (
    snapshot_id,
    pid_codigo,
    valor
  )
  select
    snapshot_nuevo,
    upper(trim(elemento ->> 'pidCodigo')),
    elemento -> 'valor'
  from jsonb_array_elements(valores_nuevos) as elemento;

  insert into public.codigos_dtc_snapshot (
    snapshot_id,
    codigo,
    modo_obd,
    ecu
  )
  select
    snapshot_nuevo,
    upper(trim(elemento ->> 'codigo')),
    upper(trim(elemento ->> 'modoObd'))::public.modo_dtc_snapshot,
    nullif(upper(trim(elemento ->> 'ecu')), '')
  from jsonb_array_elements(codigos_dtc_nuevos) as elemento;

  return snapshot_nuevo;
end;
$$;

revoke all on function public.guardar_snapshot_diagnostico(
  uuid,
  public.tipo_snapshot_diagnostico,
  public.estado_snapshot_diagnostico,
  public.motivo_snapshot_parcial,
  jsonb,
  jsonb
) from public, anon;

grant execute on function public.guardar_snapshot_diagnostico(
  uuid,
  public.tipo_snapshot_diagnostico,
  public.estado_snapshot_diagnostico,
  public.motivo_snapshot_parcial,
  jsonb,
  jsonb
) to authenticated;

commit;
