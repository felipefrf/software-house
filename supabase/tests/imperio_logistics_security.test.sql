begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(13);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'manager@test.local', '{"full_name":"Gestor"}'),
  ('10000000-0000-4000-8000-000000000002', 'worker@test.local', '{"full_name":"Funcionário"}'),
  ('10000000-0000-4000-8000-000000000003', 'outsider@test.local', '{"full_name":"Sem escala"}'),
  ('10000000-0000-4000-8000-000000000004', 'driver@test.local', '{"full_name":"Motorista"}');

update public.profiles
set must_change_password = false;
update public.profiles
set role = 'manager'
where id = '10000000-0000-4000-8000-000000000001';

insert into public.teams (id, name, leader_id)
values (
  '20000000-0000-4000-8000-000000000001',
  'Equipe teste',
  '10000000-0000-4000-8000-000000000002'
);
insert into public.team_members (team_id, person_id)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
insert into public.vehicles (id, name, plate, vehicle_type)
values (
  '30000000-0000-4000-8000-000000000001',
  'Veículo teste',
  'TST-0001',
  'VUC'
);
insert into public.operations (
  id, event_name, destination, scheduled_at, manager_id, team_id, vehicle_id, driver_id
) values (
  '40000000-0000-4000-8000-000000000001',
  'Operação teste',
  'Destino completo de teste',
  now(),
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000004'
);
insert into public.incidents (
  id, operation_id, stage, type, severity, description, actor_id
) values (
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'preparation',
  'delay',
  'medium',
  'Ocorrência de teste',
  '10000000-0000-4000-8000-000000000002'
);
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values
  (
    'operation-evidence',
    '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '{}'
  ),
  (
    'operation-evidence',
    '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000002.jpg',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '{}'
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';

select is(
  (select count(*) from public.profiles where id = '10000000-0000-4000-8000-000000000004'),
  1::bigint,
  'participante enxerga o motorista escalado fora da equipe'
);
select results_eq(
  $$
    with changed as (
      update storage.objects
      set metadata = '{"adulterada":true}'
      where name = '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000002.jpg'
      returning 1
    )
    select count(*) from changed
  $$,
  array[0::bigint],
  'funcionário não sobrescreve evidência de outro usuário'
);
select results_eq(
  $$
    with changed as (
      update public.incidents
      set status = 'resolved', resolved_at = now()
      where id = '50000000-0000-4000-8000-000000000001'
      returning 1
    )
    select count(*) from changed
  $$,
  array[0::bigint],
  'funcionário não encerra ocorrência'
);
select throws_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000003',
      'preparation',
      now(),
      '{"qualquer_item":true}'::jsonb,
      -23.5,
      -46.6,
      10,
      '10000000-0000-4000-8000-000000000002',
      null,
      '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000003.jpg'
    )
  $$,
  'P0001',
  'incomplete checklist',
  'RPC rejeita checklist arbitrário'
);
select lives_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'preparation',
      now(),
      '{
        "Pedido e separação conferidos":true,
        "Equipe escalada confirmada":true,
        "Veículo e motorista vinculados":true
      }'::jsonb,
      -23.5,
      -46.6,
      10,
      '10000000-0000-4000-8000-000000000002',
      null,
      '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg'
    )
  $$,
  'RPC confirma ação válida'
);
select lives_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'preparation',
      now(),
      '{}'::jsonb,
      0,
      0,
      0,
      '10000000-0000-4000-8000-000000000002',
      null,
      'ignorado-no-reenvio'
    )
  $$,
  'reenvio idempotente retorna a confirmação existente'
);
select is(
  (
    select count(*) from public.operation_events
    where device_action_id = '60000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'reenvio idempotente não duplica evento'
);
select results_eq(
  $$
    with changed as (
      update storage.objects
      set metadata = '{"adulterada":true}'
      where name = '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg'
      returning 1
    )
    select count(*) from changed
  $$,
  array[0::bigint],
  'evidência confirmada não pode mais ser sobrescrita pelo próprio autor'
);
select throws_ok(
  $$select public.mark_password_changed()$$,
  '42501',
  'permission denied for function mark_password_changed',
  'usuário autenticado não ignora a troca de senha via RPC'
);

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000003';
select throws_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'preparation',
      now(),
      '{}'::jsonb,
      0,
      0,
      0,
      '10000000-0000-4000-8000-000000000003',
      null,
      'ignorado-no-reenvio'
    )
  $$,
  'P0001',
  'device action unavailable',
  'reenvio idempotente não vaza evento para usuário sem acesso'
);

reset role;
update public.profiles
set must_change_password = true
where id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.operations),
  0::bigint,
  'senha temporária não libera operações'
);
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'senha temporária libera somente o próprio perfil'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select results_eq(
  $$
    with changed as (
      update public.incidents
      set status = 'resolved', resolved_at = now()
      where id = '50000000-0000-4000-8000-000000000001'
      returning 1
    )
    select count(*) from changed
  $$,
  array[1::bigint],
  'gestor pode encerrar ocorrência'
);

select * from finish();
rollback;
