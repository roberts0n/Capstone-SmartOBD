begin;

select plan(12);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.talleres'::regclass),
  'RLS esta activo en talleres'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.perfiles'::regclass),
  'RLS esta activo en perfiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.clientes'::regclass),
  'RLS esta activo en clientes'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.vehiculos'::regclass),
  'RLS esta activo en vehiculos'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.casos_diagnosticos'::regclass),
  'RLS esta activo en casos_diagnosticos'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.asignaciones'::regclass),
  'RLS esta activo en asignaciones'
);

select ok(
  not has_table_privilege('anon', 'public.perfiles', 'SELECT'),
  'Una persona anonima no puede leer perfiles'
);
select ok(
  not has_table_privilege('authenticated', 'public.perfiles', 'INSERT'),
  'La app no puede insertar perfiles directamente'
);
select ok(
  not has_table_privilege('authenticated', 'public.perfiles', 'UPDATE'),
  'La app no puede cambiar roles directamente'
);

select has_function(
  'public',
  'actualizar_diagnostico_mecanico',
  array['uuid', 'public.estado_caso', 'text'],
  'Existe la operacion tecnica limitada para mecanicos'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.actualizar_diagnostico_mecanico(uuid, public.estado_caso, text)',
    'EXECUTE'
  ),
  'El personal autenticado puede invocar la operacion controlada'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.actualizar_diagnostico_mecanico(uuid, public.estado_caso, text)',
    'EXECUTE'
  ),
  'Una persona anonima no puede invocar la operacion tecnica'
);

select * from finish();
rollback;
