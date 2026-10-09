begin;

-- dejo las relaciones originales intactas; la limpieza solo pasa por estas funciones
create function public.alcance_eliminacion_prueba(tipo_objetivo text, registro_objetivo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  taller_usuario uuid := public.taller_actual();
  etiqueta text;
  clientes_ids uuid[] := '{}'::uuid[];
  vehiculos_ids uuid[] := '{}'::uuid[];
  casos_ids uuid[] := '{}'::uuid[];
  snapshots_ids uuid[] := '{}'::uuid[];
  filas_clientes jsonb;
  filas_vehiculos jsonb;
  filas_casos jsonb;
  filas_asignaciones jsonb;
  filas_mensajes jsonb;
  filas_snapshots jsonb;
  filas_pid jsonb;
  filas_dtc jsonb;
begin
  if taller_usuario is null or public.rol_actual() is distinct from 'recepcion'::public.rol_taller then
    raise exception 'Solo una sesion activa de recepcion puede limpiar registros.';
  end if;
  if registro_objetivo is null or tipo_objetivo is null
     or tipo_objetivo not in ('cliente', 'vehiculo', 'caso') then
    raise exception 'Selecciona un registro para eliminar.';
  end if;

  if tipo_objetivo = 'cliente' then
    select cliente.nombre into etiqueta from public.clientes as cliente
    where cliente.id = registro_objetivo and cliente.taller_id = taller_usuario;
    clientes_ids := array[registro_objetivo];
    select coalesce(array_agg(vehiculo.id order by vehiculo.id), '{}'::uuid[])
    into vehiculos_ids from public.vehiculos as vehiculo
    where vehiculo.cliente_id = registro_objetivo and vehiculo.taller_id = taller_usuario;
  elsif tipo_objetivo = 'vehiculo' then
    select concat_ws(' · ', vehiculo.marca, vehiculo.modelo, vehiculo.patente, vehiculo.vin)
    into etiqueta from public.vehiculos as vehiculo
    where vehiculo.id = registro_objetivo and vehiculo.taller_id = taller_usuario;
    vehiculos_ids := array[registro_objetivo];
  else
    select concat_ws(' · ', 'Caso ' || caso.id::text, vehiculo.patente, caso.motivo_ingreso)
    into etiqueta from public.casos_diagnosticos as caso
    join public.vehiculos as vehiculo on vehiculo.id = caso.vehiculo_id and vehiculo.taller_id = caso.taller_id
    where caso.id = registro_objetivo and caso.taller_id = taller_usuario;
  end if;
  if etiqueta is null then
    raise exception 'El registro no existe o no pertenece al taller.';
  end if;
  if etiqueta = '' then etiqueta := registro_objetivo::text; end if;

  select coalesce(array_agg(caso.id order by caso.id), '{}'::uuid[]) into casos_ids
  from public.casos_diagnosticos as caso
  where caso.taller_id = taller_usuario and
    ((tipo_objetivo = 'caso' and caso.id = registro_objetivo) or caso.vehiculo_id = any(vehiculos_ids));
  select coalesce(array_agg(snapshot.id order by snapshot.id), '{}'::uuid[]) into snapshots_ids
  from public.snapshots_diagnostico as snapshot
  where snapshot.caso_id = any(casos_ids) and snapshot.taller_id = taller_usuario;

  -- incluyo el contenido en la huella, pero a la pantalla solo le envio los conteos
  select coalesce(jsonb_agg(to_jsonb(fila) order by fila.id), '[]'::jsonb) into filas_clientes
  from public.clientes as fila where fila.id = any(clientes_ids) and fila.taller_id = taller_usuario;
  select coalesce(jsonb_agg(to_jsonb(fila) order by fila.id), '[]'::jsonb) into filas_vehiculos
  from public.vehiculos as fila where fila.id = any(vehiculos_ids) and fila.taller_id = taller_usuario;
  select coalesce(jsonb_agg(to_jsonb(fila) order by fila.id), '[]'::jsonb) into filas_casos
  from public.casos_diagnosticos as fila where fila.id = any(casos_ids) and fila.taller_id = taller_usuario;
  select coalesce(jsonb_agg(to_jsonb(fila) order by fila.id), '[]'::jsonb) into filas_asignaciones
  from public.asignaciones as fila where fila.caso_id = any(casos_ids) and fila.taller_id = taller_usuario;
  select coalesce(jsonb_agg(to_jsonb(fila) order by fila.id), '[]'::jsonb) into filas_mensajes
  from public.mensajes_chatbot as fila where fila.caso_id = any(casos_ids) and fila.taller_id = taller_usuario;
  select coalesce(jsonb_agg(to_jsonb(fila) order by fila.id), '[]'::jsonb) into filas_snapshots
  from public.snapshots_diagnostico as fila where fila.id = any(snapshots_ids) and fila.taller_id = taller_usuario;
  select coalesce(jsonb_agg(to_jsonb(fila) order by fila.id), '[]'::jsonb) into filas_pid
  from public.valores_pid_snapshot as fila where fila.snapshot_id = any(snapshots_ids);
  select coalesce(jsonb_agg(to_jsonb(fila) order by fila.id), '[]'::jsonb) into filas_dtc
  from public.codigos_dtc_snapshot as fila where fila.snapshot_id = any(snapshots_ids);

  return jsonb_build_object(
    'tipo', tipo_objetivo, 'id', registro_objetivo, 'etiqueta', etiqueta,
    'clientesIds', clientes_ids, 'vehiculosIds', vehiculos_ids, 'casosIds', casos_ids,
    'cantidades', jsonb_build_object(
      'clientes', jsonb_array_length(filas_clientes), 'vehiculos', jsonb_array_length(filas_vehiculos),
      'casos', jsonb_array_length(filas_casos), 'asignaciones', jsonb_array_length(filas_asignaciones),
      'mensajes', jsonb_array_length(filas_mensajes), 'snapshots', jsonb_array_length(filas_snapshots),
      'valoresPid', jsonb_array_length(filas_pid), 'codigosDtc', jsonb_array_length(filas_dtc)),
    'huella', md5(jsonb_build_array(tipo_objetivo, registro_objetivo, etiqueta,
      filas_clientes, filas_vehiculos, filas_casos, filas_asignaciones, filas_mensajes,
      filas_snapshots, filas_pid, filas_dtc)::text)
  );
end;
$$;

create function public.previsualizar_eliminacion_prueba(tipo_objetivo text, registro_objetivo uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.alcance_eliminacion_prueba(tipo_objetivo, registro_objetivo)
    - 'clientesIds' - 'vehiculosIds' - 'casosIds';
$$;

create function public.eliminar_registro_prueba(
  tipo_objetivo text, registro_objetivo uuid, huella_revisada text, confirmacion text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  taller_usuario uuid := public.taller_actual();
  alcance jsonb;
  vehiculos_ids uuid[];
  casos_ids uuid[];
begin
  alcance := public.alcance_eliminacion_prueba(tipo_objetivo, registro_objetivo);
  if confirmacion is distinct from 'ELIMINAR' then
    raise exception 'Escribe ELIMINAR para confirmar.';
  end if;
  if huella_revisada is null or huella_revisada !~ '^[a-f0-9]{32}$' then
    raise exception 'Actualiza la vista previa antes de eliminar.';
  end if;
  select coalesce(array_agg(valor::uuid), '{}'::uuid[]) into vehiculos_ids
  from jsonb_array_elements_text(alcance -> 'vehiculosIds') as elementos(valor);
  select coalesce(array_agg(valor::uuid), '{}'::uuid[]) into casos_ids
  from jsonb_array_elements_text(alcance -> 'casosIds') as elementos(valor);

  -- bloqueo de arriba hacia abajo para que no entren hijos nuevos durante el borrado
  if tipo_objetivo = 'cliente' then
    perform fila.id from public.clientes as fila
    where fila.id = registro_objetivo and fila.taller_id = taller_usuario for update;
  end if;
  perform fila.id from public.vehiculos as fila
  where fila.id = any(vehiculos_ids) and fila.taller_id = taller_usuario order by fila.id for update;
  perform fila.id from public.casos_diagnosticos as fila
  where fila.id = any(casos_ids) and fila.taller_id = taller_usuario order by fila.id for update;
  perform fila.id from public.asignaciones as fila
  where fila.caso_id = any(casos_ids) and fila.taller_id = taller_usuario order by fila.id for update;
  perform fila.id from public.mensajes_chatbot as fila
  where fila.caso_id = any(casos_ids) and fila.taller_id = taller_usuario order by fila.id for update;
  perform fila.id from public.snapshots_diagnostico as fila
  where fila.caso_id = any(casos_ids) and fila.taller_id = taller_usuario order by fila.id for update;
  perform fila.id from public.valores_pid_snapshot as fila
  where fila.snapshot_id in (select snapshot.id from public.snapshots_diagnostico as snapshot
    where snapshot.caso_id = any(casos_ids)) order by fila.id for update;
  perform fila.id from public.codigos_dtc_snapshot as fila
  where fila.snapshot_id in (select snapshot.id from public.snapshots_diagnostico as snapshot
    where snapshot.caso_id = any(casos_ids)) order by fila.id for update;

  alcance := public.alcance_eliminacion_prueba(tipo_objetivo, registro_objetivo);
  if alcance ->> 'huella' is distinct from huella_revisada then
    raise exception 'Los registros cambiaron. Actualiza la vista previa antes de eliminar.';
  end if;

  -- los casos ya arrastran asignaciones, mensajes, snapshots y sus lecturas por cascada
  delete from public.casos_diagnosticos where id = any(casos_ids) and taller_id = taller_usuario;
  delete from public.vehiculos where id = any(vehiculos_ids) and taller_id = taller_usuario;
  if tipo_objetivo = 'cliente' then
    delete from public.clientes where id = registro_objetivo and taller_id = taller_usuario;
  end if;
  return alcance - 'clientesIds' - 'vehiculosIds' - 'casosIds';
end;
$$;

revoke all on function public.alcance_eliminacion_prueba(text, uuid) from public, anon, authenticated;
revoke all on function public.previsualizar_eliminacion_prueba(text, uuid) from public, anon, authenticated;
revoke all on function public.eliminar_registro_prueba(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.previsualizar_eliminacion_prueba(text, uuid) to authenticated;
grant execute on function public.eliminar_registro_prueba(text, uuid, text, text) to authenticated;

commit;
