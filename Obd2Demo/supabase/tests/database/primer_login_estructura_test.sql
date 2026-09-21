begin;

select plan(6);

select has_column(
  'public', 'perfiles', 'debe_cambiar_password',
  'Perfiles registra el cambio obligatorio de contrasena'
);

select col_type_is(
  'public', 'perfiles', 'debe_cambiar_password', 'boolean',
  'La marca de primer acceso es booleana'
);

select ok(
  not has_column_privilege('authenticated', 'public.perfiles', 'debe_cambiar_password', 'UPDATE'),
  'La app no puede desbloquear directamente su perfil'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'perfiles'
      and policyname = 'perfiles_leer_propio'
      and cmd = 'SELECT'
  ),
  'El usuario puede consultar su propio estado de primer acceso'
);

select ok(
  position('not perfil.debe_cambiar_password' in
    pg_get_functiondef('public.taller_actual()'::regprocedure)) > 0,
  'La funcion del taller bloquea el primer inicio'
);

select ok(
  position('not perfil.debe_cambiar_password' in
    pg_get_functiondef('public.rol_actual()'::regprocedure)) > 0,
  'La funcion del rol bloquea el primer inicio'
);

select * from finish();
rollback;
