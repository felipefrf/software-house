begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(78);

select has_table(
  'public',
  'estoquenow_operation_contexts',
  'contexto estruturado do EstoqueNOW existe'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.estoquenow_operation_contexts'::regclass),
  true,
  'contexto do EstoqueNOW usa RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.estoquenow_operation_contexts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.estoquenow_operation_contexts', 'INSERT')
    and not has_table_privilege('authenticated', 'public.estoquenow_operation_contexts', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.estoquenow_operation_contexts', 'DELETE'),
  'authenticated lê contexto, mas não grava diretamente'
);
select ok(
  not has_table_privilege('service_role', 'public.estoquenow_operation_contexts', 'INSERT')
    and not has_table_privilege('service_role', 'public.estoquenow_operation_contexts', 'UPDATE')
    and not has_table_privilege('service_role', 'public.estoquenow_operation_contexts', 'DELETE'),
  'service_role grava contexto somente pelo RPC estreito'
);

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
  ),
  (
    'operation-evidence',
    '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000003.jpg',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '{}'
  ),
  (
    'operation-evidence',
    '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000004.jpg',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '{}'
  ),
  (
    'operation-evidence',
    '40000000-0000-4000-8000-000000000001/incident-50000000-0000-4000-8000-000000000002.jpg',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '{}'
  ),
  (
    'operation-evidence',
    '40000000-0000-4000-8000-000000000001/incident-50000000-0000-4000-8000-000000000004.jpg',
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
select throws_ok(
  $$
    update public.incidents
    set status = 'resolved', resolved_at = now()
    where id = '50000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table incidents',
  'funcionário não altera ocorrência diretamente pela Data API'
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
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000004';
select throws_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'preparation', now(), '{}'::jsonb, 0, 0, 0,
      '10000000-0000-4000-8000-000000000004', null, 'ignorado-no-reenvio'
    )
  $$,
  'P0001',
  'device action unavailable',
  'outro participante não assume o reenvio confirmado'
);
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select throws_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      'departure', now(),
      '{
        "Motorista e veículo confirmados":true,
        "Toda a equipe presente":true,
        "Carga fotografada e conferida":true
      }'::jsonb,
      -23.5, -46.6, 10,
      '10000000-0000-4000-8000-000000000002', null,
      '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000002.jpg'
    )
  $$,
  'P0001',
  'photo owner mismatch',
  'ação não usa foto enviada por outro participante'
);
select throws_ok(
  $$
    insert into public.incidents (
      operation_id, stage, type, severity, description, actor_id
    ) values (
      '40000000-0000-4000-8000-000000000001', 'departure', 'delay', 'low',
      'Inserção direta indevida', '10000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'permission denied for table incidents',
  'funcionário não contorna a RPC inserindo ocorrência diretamente'
);
select lives_ok(
  $$
    select public.create_operation_incident(
      '50000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      'departure', 'damage', 'high', 'Atraso estimado de 10 minutos',
      'Avaria identificada durante a saída',
      '10000000-0000-4000-8000-000000000002',
      -23.5, -46.6, 8,
      '40000000-0000-4000-8000-000000000001/incident-50000000-0000-4000-8000-000000000002.jpg'
    )
  $$,
  'RPC registra ocorrência válida com evidência própria'
);
select lives_ok(
  $$
    select public.create_operation_incident(
      '50000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      'departure', 'damage', 'high', 'Atraso estimado de 10 minutos',
      'Avaria identificada durante a saída',
      '10000000-0000-4000-8000-000000000002',
      -23.5, -46.6, 8,
      '40000000-0000-4000-8000-000000000001/incident-50000000-0000-4000-8000-000000000002.jpg'
    )
  $$,
  'reenvio idempotente retorna ocorrência existente'
);
select is(
  (
    select count(*) from public.incidents
    where id = '50000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'reenvio idempotente não duplica ocorrência'
);
select throws_ok(
  $$
    select public.create_operation_incident(
      '50000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      'departure', 'damage', 'low', 'Impacto divergente',
      'Relato divergente com o mesmo identificador', null,
      null, null, null, null
    )
  $$,
  'P0001',
  'incident divergence',
  'reenvio idempotente rejeita conteúdo divergente'
);
select throws_ok(
  $$
    select public.create_operation_incident(
      '50000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000001',
      'departure', 'missing_item', 'medium', null,
      'Item faltante sem evidência', null, null, null, null, null
    )
  $$,
  'P0001',
  'photo required',
  'RPC exige foto para falta ou avaria'
);
select throws_ok(
  $$
    select public.create_operation_incident(
      '50000000-0000-4000-8000-000000000004',
      '40000000-0000-4000-8000-000000000001',
      'departure', 'damage', 'medium', null,
      'Tentativa com foto de outro autor', null, null, null, null,
      '40000000-0000-4000-8000-000000000001/incident-50000000-0000-4000-8000-000000000004.jpg'
    )
  $$,
  'P0001',
  'photo owner mismatch',
  'ocorrência não usa foto enviada por outro participante'
);
select throws_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      'departure',
      now(),
      '{}'::jsonb,
      0,
      0,
      0,
      '10000000-0000-4000-8000-000000000002',
      null,
      'ignorado-no-conflito'
    )
  $$,
  'P0001',
  'device action unavailable',
  'device_action_id não confirma outra etapa da mesma operação'
);
select throws_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000004',
      'departure',
      'infinity'::timestamptz,
      '{
        "Motorista e veículo confirmados":true,
        "Toda a equipe presente":true,
        "Carga fotografada e conferida":true
      }'::jsonb,
      -23.5,
      -46.6,
      10,
      '10000000-0000-4000-8000-000000000002',
      null,
      '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000004.jpg'
    )
  $$,
  'P0001',
  'invalid device capture time',
  'RPC rejeita horário de captura não finito'
);
select throws_ok(
  $$
    select public.confirm_operation_action(
      '40000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000004',
      'departure',
      now(),
      '{}'::jsonb,
      -23.5,
      -46.6,
      'infinity'::double precision,
      '10000000-0000-4000-8000-000000000002',
      null,
      '40000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000004.jpg'
    )
  $$,
  'P0001',
  'invalid location',
  'RPC rejeita precisão GPS não finita'
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

set local role postgres;
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

set local role postgres;
set local role service_role;
select lives_ok(
  $$select count(*) from public.profiles$$,
  'service role consulta perfis para validar o bootstrap'
);
select lives_ok(
  $$update public.profiles set full_name = full_name where false$$,
  'service role atualiza somente perfis pelo backend validado'
);

set local role postgres;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select is(
  public.update_operation_assignment(
    '40000000-0000-4000-8000-000000000001',
    'Destino atualizado pelo BFF',
    now(),
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000004',
    'Escala atualizada'
  ),
  true,
  'RPC estreito permite ao gestor atualizar a escala'
);
select throws_ok(
  $$
    select public.create_manual_operation(
      'Operação com horário inválido',
      'Destino completo válido',
      'infinity'::timestamptz
    )
  $$,
  'P0001',
  'invalid scheduled time',
  'RPC rejeita horário não finito ao criar operação'
);
select throws_ok(
  $$
    select public.update_operation_assignment(
      '40000000-0000-4000-8000-000000000001',
      'Destino atualizado pelo BFF',
      'infinity'::timestamptz
    )
  $$,
  'P0001',
  'invalid scheduled time',
  'RPC rejeita horário não finito ao atualizar operação'
);
select throws_ok(
  $$select public.cancel_operation('40000000-0000-4000-8000-000000000001', null)$$,
  'P0001',
  'invalid reason',
  'RPC rejeita cancelamento sem motivo'
);
select is(
  public.set_incident_status(
    '50000000-0000-4000-8000-000000000001',
    'resolved'
  ),
  true,
  'RPC estreito permite ao gestor tratar ocorrência'
);
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-canary-1',
      'Canário EstoqueNOW',
      'Destino externo válido',
      now(),
      'Leitura externa validada',
      now(),
      '10000000-0000-4000-8000-000000000001',
      '{"order_id":"pedido-1"}'::jsonb,
      'Canário EstoqueNOW',
      'Destino externo válido',
      'Leitura externa validada',
      '[]'::jsonb,
      null
    )
  $$,
  '42501',
  'permission denied for function confirm_estoquenow_canary',
  'gestor não contorna a flag chamando o canário pela Data API'
);
select throws_ok(
  $$
    insert into public.operations (
      event_name, destination, scheduled_at, manager_id
    ) values (
      'Operação indevida',
      'Destino completo indevido',
      now(),
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'permission denied for table operations',
  'gestor não insere operação diretamente pela Data API'
);
select throws_ok(
  $$
    update public.operations
    set stage = 'inspection', status = 'completed', completed_at = now()
    where id = '40000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table operations',
  'gestor não avança operação diretamente pela Data API'
);
select throws_ok(
  $$
    update public.incidents
    set status = 'resolved', resolved_at = now()
    where id = '50000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table incidents',
  'gestor não altera ocorrência diretamente pela Data API'
);

set local role postgres;
set local role service_role;
select is(
  public.confirm_estoquenow_canary(
    'external-canary-1',
    'Canário EstoqueNOW',
    'Destino externo válido',
    '2026-09-02 12:00:00-03'::timestamptz,
    'Leitura externa validada',
    '2026-09-02 12:05:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{
      "order_id":"pedido-1",
      "return_at":"2026-09-03T18:00:00-03:00",
      "address_city":"Salvador",
      "delivery_status_type":"pending",
      "delivery_concluded":false,
      "item_count":"12"
    }'::jsonb,
    'Canário EstoqueNOW',
    'Destino externo válido',
    'Leitura externa validada',
    '[{"id":"line-2","itemId":"item-2","orderId":"pedido-1","name":"Cadeira"},{"id":"line-1","itemId":"item-1","orderId":"pedido-1","name":"Mesa"}]'::jsonb,
    null
  ),
  'new',
  'RPC estreito cria exatamente um canário via backend privilegiado'
);
set local role postgres;
select is(
  (select count(*) from public.estoquenow_operation_contexts c
    join public.operations o on o.id = c.operation_id
    where o.external_id = 'external-canary-1'),
  1::bigint,
  'importação cria exatamente um contexto 1:1'
);
select results_eq(
  $$
    select c.order_id, c.return_at, c.address_city, c.delivery_status_type,
      c.delivery_concluded, c.item_count, c.items
    from public.estoquenow_operation_contexts c
    join public.operations o on o.id = c.operation_id
    where o.external_id = 'external-canary-1'
  $$,
  $$values (
    'pedido-1'::text,
    '2026-09-03 18:00:00-03'::timestamptz,
    'Salvador'::text,
    'pending'::text,
    false,
    '12'::text,
    '[{"id":"line-1","name":"Mesa","itemId":"item-1","orderId":"pedido-1"},{"id":"line-2","name":"Cadeira","itemId":"item-2","orderId":"pedido-1"}]'::jsonb
  )$$,
  'contexto preserva pedido, retorno, endereço, status e contagem'
);
set local role service_role;
select is(
  public.confirm_estoquenow_canary(
    'external-canary-1',
    'Canário EstoqueNOW',
    'Destino externo válido',
    '2026-09-02 12:00:00-03'::timestamptz,
    'Leitura externa validada',
    '2026-09-02 12:06:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{
      "order_id":"pedido-1",
      "return_at":"2026-09-03T18:00:00-03:00",
      "address_city":"Salvador",
      "delivery_status_type":"pending",
      "delivery_concluded":false,
      "item_count":"12"
    }'::jsonb,
    'Canário EstoqueNOW',
    'Destino externo válido',
    'Leitura externa validada',
    '[{"id":"line-1","itemId":"item-1","orderId":"pedido-1","name":"Mesa"},{"id":"line-2","itemId":"item-2","orderId":"pedido-1","name":"Cadeira"}]'::jsonb,
    '2026-09-02 12:05:00-03'::timestamptz
  ),
  'unchanged',
  'reimportação do mesmo ID externo é idempotente'
);
set local role postgres;
select is(
  (select count(*) from public.operations where external_id = 'external-canary-1'),
  1::bigint,
  'reimportação não duplica operação'
);
select is(
  (select count(*) from public.estoquenow_operation_contexts c
    join public.operations o on o.id = c.operation_id
    where o.external_id = 'external-canary-1'),
  1::bigint,
  'reimportação não duplica contexto'
);
set local role service_role;
select is(
  public.confirm_estoquenow_canary(
    'external-canary-1', 'Canário EstoqueNOW', 'Destino externo válido',
    '2026-09-02 12:00:00-03'::timestamptz, 'Leitura externa validada',
    '2026-09-02 12:07:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{
      "order_id":"pedido-alterado",
      "return_at":"2026-09-03T18:00:00-03:00",
      "address_city":"Salvador",
      "delivery_status_type":"pending",
      "delivery_concluded":false,
      "item_count":"12"
    }'::jsonb,
    'Canário EstoqueNOW', 'Destino externo válido', 'Leitura externa validada',
    '[{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa"},{"id":"line-2","itemId":"item-2","orderId":"pedido-alterado","name":"Cadeira"}]'::jsonb,
    '2026-09-02 12:06:00-03'::timestamptz
  ),
  'updated',
  'mudança revisada atualiza o contexto sem duplicar a operação'
);
set local role postgres;
select is(
  (select order_id from public.estoquenow_operation_contexts c
    join public.operations o on o.id = c.operation_id
    where o.external_id = 'external-canary-1'),
  'pedido-alterado',
  'atualização revisada persiste o novo contexto'
);
set local role service_role;
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-canary-1', 'Canário EstoqueNOW', 'Destino externo válido',
      '2026-09-02 12:00:00-03', '', '2026-09-02 12:08:00-03',
      '10000000-0000-4000-8000-000000000001',
      '{"order_id":"pedido-alterado"}'::jsonb,
      'Canário EstoqueNOW', 'Destino externo válido', '',
      '[{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa"},{"id":"line-2","itemId":"item-2","orderId":"pedido-alterado","name":"Cadeira"}]'::jsonb,
      '2026-09-02 12:06:00-03'
    )
  $$,
  'P0001',
  'stale source divergence',
  'confirmação obsoleta não sobrescreve leitura mais nova'
);
set local role postgres;
select is(
  (select imported_at from public.operations where external_id = 'external-canary-1'),
  '2026-09-02 12:07:00-03'::timestamptz,
  'conflito obsoleto preserva a versão persistida'
);
update public.operations set status = 'completed'
where external_id = 'external-canary-1';
set local role service_role;
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-canary-1', 'Canário alterado', 'Destino externo válido',
      '2026-09-02 12:00:00-03', '', '2026-09-02 12:09:00-03',
      '10000000-0000-4000-8000-000000000001',
      '{"order_id":"pedido-alterado"}'::jsonb,
      'Canário EstoqueNOW', 'Destino externo válido', '',
      '[{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa"},{"id":"line-2","itemId":"item-2","orderId":"pedido-alterado","name":"Cadeira"}]'::jsonb,
      '2026-09-02 12:07:00-03'
    )
  $$,
  'P0001',
  'historic source divergence',
  'operação concluída não reescreve cabeçalho histórico'
);
select is(
  public.confirm_estoquenow_canary(
    'external-canary-1', 'Canário EstoqueNOW', 'Destino externo válido',
    '2026-09-02 12:00:00-03', '', '2026-09-02 12:09:00-03',
    '10000000-0000-4000-8000-000000000001',
    '{
      "order_id":"pedido-alterado",
      "return_at":"2026-09-03T18:00:00-03:00",
      "address_city":"Salvador",
      "delivery_status_type":"completed",
      "delivery_concluded":true,
      "item_count":"12"
    }'::jsonb,
    'Canário EstoqueNOW', 'Destino externo válido', '',
    '[{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa"},{"id":"line-2","itemId":"item-2","orderId":"pedido-alterado","name":"Cadeira"}]'::jsonb,
    '2026-09-02 12:07:00-03'
  ),
  'updated',
  'operação concluída ainda atualiza somente status externo'
);
select is(
  public.confirm_estoquenow_canary(
    'external-canary-1', 'Canário EstoqueNOW', 'Destino externo válido',
    '2026-09-02 12:00:00-03', '', '2026-09-02 12:09:15-03',
    '10000000-0000-4000-8000-000000000001',
    '{
      "order_id":"pedido-alterado",
      "return_at":"2026-09-03T18:00:00-03:00",
      "address_city":"Salvador",
      "delivery_status_type":"completed",
      "delivery_concluded":true,
      "item_count":"12"
    }'::jsonb,
    'Canário EstoqueNOW', 'Destino externo válido', '',
    '[{"id":"line-2","itemId":"item-2","orderId":"pedido-alterado","name":"Cadeira"},{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa"}]'::jsonb,
    '2026-09-02 12:09:00-03'
  ),
  'unchanged',
  'ordem diferente da mesma lista não cria divergência histórica'
);
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-canary-1', 'Canário EstoqueNOW', 'Destino externo válido',
      '2026-09-02 12:00:00-03', '', '2026-09-02 12:09:30-03',
      '10000000-0000-4000-8000-000000000001',
      '{"order_id":"pedido-alterado","delivery_status_type":"completed","delivery_concluded":true}'::jsonb,
      'Canário EstoqueNOW', 'Destino externo válido', '',
      '[{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa alterada"}]'::jsonb,
      '2026-09-02 12:09:15-03'
    )
  $$,
  'P0001',
  'historic item divergence',
  'operação concluída não reescreve a lista histórica de equipamentos'
);
set local role postgres;
update public.operations set status = 'active'
where external_id = 'external-canary-1';
set local role service_role;
select is(
  public.confirm_estoquenow_canary(
    'external-canary-1', 'Canário EstoqueNOW', 'Destino externo válido',
    '2026-09-02 12:00:00-03', '', '2026-09-02 12:10:00-03',
    '10000000-0000-4000-8000-000000000001',
    '{
      "order_id":"pedido-alterado",
      "return_at":"2026-09-03T18:00:00-03:00",
      "address_city":"Salvador",
      "delivery_status_type":"completed",
      "delivery_concluded":true,
      "item_count":"12"
    }'::jsonb,
    'Canário EstoqueNOW', 'Destino externo válido', '',
    '[{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa"},{"id":"line-2","itemId":"item-2","orderId":"pedido-alterado","name":"Cadeira dobrável"}]'::jsonb,
    '2026-09-02 12:09:15-03'
  ),
  'updated',
  'operação ativa recebe lista de equipamentos revisada'
);
set local role postgres;
select ok(
  (select jsonb_array_length(c.items) = 2
      and c.items @> '[{"id":"line-2","name":"Cadeira dobrável"}]'::jsonb
    from public.estoquenow_operation_contexts c
    join public.operations o on o.id = c.operation_id
    where o.external_id = 'external-canary-1')
    and (select count(*) = 1 from public.operations where external_id = 'external-canary-1'),
  'atualização de equipamentos preserva uma única operação e um único contexto'
);
set local role service_role;
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-canary-1', 'Canário EstoqueNOW', 'Destino externo válido',
      '2026-09-02 12:00:00-03', '', '2026-09-02 12:11:00-03',
      '10000000-0000-4000-8000-000000000001',
      '{"order_id":"pedido-alterado","delivery_status_type":"completed","delivery_concluded":true}'::jsonb,
      'Canário EstoqueNOW', 'Destino externo válido', '',
      '[{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa","extra":"indevido"}]'::jsonb,
      '2026-09-02 12:10:00-03'
    )
  $$,
  'P0001',
  'invalid source items',
  'RPC rejeita equipamento fora do schema observado'
);
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-canary-1', 'Canário EstoqueNOW', 'Destino externo válido',
      '2026-09-02 12:00:00-03', '', '2026-09-02 12:11:00-03',
      '10000000-0000-4000-8000-000000000001',
      '{"order_id":"pedido-alterado","delivery_status_type":"completed","delivery_concluded":true}'::jsonb,
      'Canário EstoqueNOW', 'Destino externo válido', '',
      '[{"id":"line-1","itemId":"item-1","orderId":"pedido-alterado","name":"Mesa"},{"id":" line-1 ","itemId":"item-2","orderId":"pedido-alterado","name":"Cadeira"}]'::jsonb,
      '2026-09-02 12:10:00-03'
    )
  $$,
  'P0001',
  'invalid source items',
  'RPC rejeita IDs duplicados após normalização'
);

set local role postgres;
insert into public.operations (
  id, source, external_id, event_name, destination, scheduled_at, manager_id, notes, imported_at
) values (
  '40000000-0000-4000-8000-000000000010', 'estoquenow', 'external-legacy-1',
  'Operação legada', 'Local · Salvador', '2026-09-05 08:00:00-03',
  '10000000-0000-4000-8000-000000000001',
  'Importado por leitura do EstoqueNOW. Pedido legado.',
  '2026-09-02 11:00:00-03'::timestamptz
);
set local role service_role;
select is(
  public.confirm_estoquenow_canary(
    'external-legacy-1', 'Operação legada', 'Local · Rua A, 10 · Salvador - BA',
    '2026-09-05 08:00:00-03', '', now(),
    '10000000-0000-4000-8000-000000000001',
    '{"order_id":"legado","address_street":"Rua A"}'::jsonb,
    'Operação legada',
    'Local · Salvador', 'Importado por leitura do EstoqueNOW. Pedido legado.',
    '[]'::jsonb,
    '2026-09-02 11:00:00-03'::timestamptz
  ),
  'backfilled',
  'linha legada exata recebe contexto sem nova operação'
);
set local role postgres;
select ok(
  (select notes is null and destination = 'Local · Rua A, 10 · Salvador - BA'
    from public.operations where external_id = 'external-legacy-1')
    and (select count(*) = 1 from public.estoquenow_operation_contexts c
      join public.operations o on o.id = c.operation_id
      where o.external_id = 'external-legacy-1'),
  'backfill limpa somente a nota legada e enriquece o destino'
);

insert into public.operations (
  id, source, external_id, event_name, destination, scheduled_at, manager_id, notes, imported_at
) values (
  '40000000-0000-4000-8000-000000000011', 'estoquenow', 'external-legacy-diverged',
  'Operação legada', 'Local · Salvador', '2026-09-05 08:00:00-03',
  '10000000-0000-4000-8000-000000000001', 'Nota interna preservada',
  '2026-09-02 11:00:00-03'::timestamptz
);
set local role service_role;
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-legacy-diverged', 'Operação legada', 'Local · Rua A, 10 · Salvador - BA',
      '2026-09-05 08:00:00-03', '', now(),
      '10000000-0000-4000-8000-000000000001',
      '{"order_id":"legado"}'::jsonb,
      'Operação legada',
      'Local · Salvador', 'Importado por leitura do EstoqueNOW. Pedido legado.',
      '[]'::jsonb,
      '2026-09-02 11:00:00-03'::timestamptz
    )
  $$,
  'P0001',
  'legacy source divergence',
  'backfill divergente aborta sem sobrescrever nota interna'
);
set local role postgres;
select ok(
  (select notes = 'Nota interna preservada' from public.operations
    where external_id = 'external-legacy-diverged')
    and not exists (
      select 1 from public.estoquenow_operation_contexts c
      join public.operations o on o.id = c.operation_id
      where o.external_id = 'external-legacy-diverged'
    ),
  'backfill divergente preserva parent e não cria contexto'
);
set local role service_role;
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-canary-infinito',
      'Canário inválido',
      'Destino externo válido',
      'infinity'::timestamptz,
      'Leitura externa inválida',
      now(),
      '10000000-0000-4000-8000-000000000001',
      '{}'::jsonb,
      'Canário inválido',
      'Destino externo válido',
      'Leitura externa inválida',
      '[]'::jsonb,
      null
    )
  $$,
  'P0001',
  'invalid source time',
  'RPC rejeita horário externo não finito'
);
select throws_ok(
  $$
    select public.confirm_estoquenow_canary(
      'external-canary-retorno-invalido', 'Canário inválido', 'Destino externo válido',
      '2026-09-05 12:00:00-03'::timestamptz, '', now(),
      '10000000-0000-4000-8000-000000000001',
      '{"return_at":"2026-09-05T11:00:00-03:00"}'::jsonb,
      'Canário inválido', 'Destino externo válido', '', '[]'::jsonb, null
    )
  $$,
  'P0001',
  'invalid source time',
  'RPC rejeita devolução anterior à entrega'
);

set local role postgres;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select throws_ok(
  $$
    select public.update_operation_assignment(
      (select id from public.operations where external_id = 'external-canary-1'),
      'Destino adulterado na torre',
      (select scheduled_at from public.operations where external_id = 'external-canary-1')
    )
  $$,
  'P0001',
  'source fields immutable',
  'escala interna não altera campos canônicos do EstoqueNOW'
);

set local role postgres;
select has_table(
  'public',
  'operation_item_checks',
  'estado interno de conferência dos itens existe'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.operation_item_checks'::regclass),
  true,
  'conferência dos itens usa RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.operation_item_checks', 'SELECT')
    and not has_table_privilege('authenticated', 'public.operation_item_checks', 'INSERT')
    and not has_table_privilege('authenticated', 'public.operation_item_checks', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.operation_item_checks', 'DELETE'),
  'authenticated lê conferência, mas não grava diretamente'
);
select ok(
  has_function_privilege('authenticated', 'public.set_operation_item_checked(uuid,jsonb,boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.set_operation_item_checked(uuid,text,boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.set_operation_item_checked(uuid,jsonb,boolean)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.set_operation_item_checked(uuid,jsonb,boolean)', 'EXECUTE'),
  'somente usuário autenticado executa o RPC de conferência'
);

insert into public.operations (
  id, source, external_id, event_name, destination, scheduled_at,
  manager_id, team_id, status, imported_at
) values (
  '40000000-0000-4000-8000-000000000012', 'estoquenow', 'external-checks-1',
  'Conferência de equipamentos', 'Destino de teste', now(),
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 'active', now()
);
insert into public.estoquenow_operation_contexts (operation_id, items)
values (
  '40000000-0000-4000-8000-000000000012',
  '[{"id":"line-a","itemId":"item-a","orderId":"order-a","name":"Mesa"},{"id":"line-b","itemId":"item-b","orderId":"order-a","name":"Cadeira"}]'::jsonb
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select throws_ok(
  $$
    insert into public.operation_item_checks (
      operation_id, source_item_id, checked_by
    ) values (
      '40000000-0000-4000-8000-000000000012', 'line-a',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'permission denied for table operation_item_checks',
  'cliente não grava conferência diretamente'
);
select is(
  public.set_operation_item_checked(
    '40000000-0000-4000-8000-000000000012',
    '{"id":"line-a","itemId":"item-a","orderId":"order-a","name":"Mesa"}'::jsonb,
    true
  ),
  'checked',
  'gestor marca item da operação acessível'
);

set local role postgres;
select ok(
  (select checked_by = '10000000-0000-4000-8000-000000000001'
      and checked_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)
    from public.operation_item_checks
    where operation_id = '40000000-0000-4000-8000-000000000012'
      and source_item_id = 'line-a'),
  'ator e horário vêm do banco, não do cliente'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select is(
  public.set_operation_item_checked(
    '40000000-0000-4000-8000-000000000012',
    '{"id":"line-a","itemId":"item-a","orderId":"order-a","name":"Mesa"}'::jsonb,
    true
  ),
  'unchanged',
  'repetir a mesma marcação é idempotente'
);
select throws_ok(
  $$
    select public.set_operation_item_checked(
      '40000000-0000-4000-8000-000000000012',
      '{"id":"line-a","itemId":"item-a","orderId":"order-a","name":"Mesa antiga"}'::jsonb,
      false
    )
  $$,
  'P0001',
  'source item unavailable',
  'tela obsoleta não altera item que mudou mantendo o mesmo ID'
);

set local role postgres;
update public.profiles set must_change_password = false
where id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select is(
  public.set_operation_item_checked(
    '40000000-0000-4000-8000-000000000012',
    '{"id":"line-b","itemId":"item-b","orderId":"order-a","name":"Cadeira"}'::jsonb,
    true
  ),
  'checked',
  'funcionário escalado confere item da própria operação'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000003';
select throws_ok(
  $$
    select public.set_operation_item_checked(
      '40000000-0000-4000-8000-000000000012',
      '{"id":"line-a","itemId":"item-a","orderId":"order-a","name":"Mesa"}'::jsonb,
      false
    )
  $$,
  'P0001',
  'forbidden',
  'usuário fora da escala não altera a conferência'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select throws_ok(
  $$
    select public.set_operation_item_checked(
      '40000000-0000-4000-8000-000000000001',
      '{"id":"line-a","itemId":"item-a","orderId":"order-a","name":"Mesa"}'::jsonb,
      true
    )
  $$,
  'P0001',
  'forbidden',
  'operação manual não aceita item externo'
);

set local role postgres;
update public.operations set status = 'completed'
where id = '40000000-0000-4000-8000-000000000012';
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select throws_ok(
  $$
    select public.set_operation_item_checked(
      '40000000-0000-4000-8000-000000000012',
      '{"id":"line-a","itemId":"item-a","orderId":"order-a","name":"Mesa"}'::jsonb,
      false
    )
  $$,
  'P0001',
  'forbidden',
  'operação encerrada mantém checklist somente para leitura'
);

set local role postgres;
update public.operations set status = 'active'
where id = '40000000-0000-4000-8000-000000000012';
update public.estoquenow_operation_contexts
set items = '[{"id":"line-a","itemId":"item-a","orderId":"order-a","name":"Mesa alterada"}]'::jsonb
where operation_id = '40000000-0000-4000-8000-000000000012';
select ok(
  not exists (
    select 1 from public.operation_item_checks
    where operation_id = '40000000-0000-4000-8000-000000000012'
  ),
  'refresh da origem remove item ausente e redefine check de equipamento alterado'
);

select * from finish();
rollback;
