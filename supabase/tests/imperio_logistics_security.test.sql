begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(149);

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

set local role postgres;
select has_table(
  'private',
  'estoquenow_sync_runs',
  'ledger privado de execuções do sync existe'
);
select has_table(
  'private',
  'estoquenow_sync_items',
  'ledger privado de itens do sync existe'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class
    where oid = 'private.estoquenow_sync_runs'::regclass),
  true,
  'ledger de execuções usa RLS'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class
    where oid = 'private.estoquenow_sync_items'::regclass),
  true,
  'ledger de itens usa RLS'
);
select ok(
  not has_table_privilege('service_role', 'private.estoquenow_sync_runs', 'SELECT')
    and not has_table_privilege('service_role', 'private.estoquenow_sync_runs', 'INSERT')
    and not has_table_privilege('service_role', 'private.estoquenow_sync_runs', 'UPDATE')
    and not has_table_privilege('service_role', 'private.estoquenow_sync_items', 'SELECT')
    and not has_table_privilege('service_role', 'private.estoquenow_sync_items', 'INSERT')
    and not has_table_privilege('service_role', 'private.estoquenow_sync_items', 'UPDATE'),
  'service_role acessa o ledger somente pelos RPCs estreitos'
);
select ok(
  not has_table_privilege('authenticated', 'private.estoquenow_sync_runs', 'SELECT')
    and not has_table_privilege('authenticated', 'private.estoquenow_sync_items', 'SELECT')
    and not has_table_privilege('anon', 'private.estoquenow_sync_runs', 'SELECT')
    and not has_table_privilege('anon', 'private.estoquenow_sync_items', 'SELECT'),
  'clientes não leem diretamente o ledger privado'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.begin_estoquenow_sync(text,text,date,date,integer)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'public.begin_estoquenow_sync(text,text,date,date,integer)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.begin_estoquenow_sync(text,text,date,date,integer)',
      'EXECUTE'
    ),
  'somente service_role inicia o sync'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.record_estoquenow_sync_item(uuid,text,text,text,text,text,text,text,timestamptz,text,timestamptz,uuid,jsonb,text,text,text,jsonb,timestamptz)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'public.record_estoquenow_sync_item(uuid,text,text,text,text,text,text,text,timestamptz,text,timestamptz,uuid,jsonb,text,text,text,jsonb,timestamptz)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.record_estoquenow_sync_item(uuid,text,text,text,text,text,text,text,timestamptz,text,timestamptz,uuid,jsonb,text,text,text,jsonb,timestamptz)',
      'EXECUTE'
    ),
  'somente service_role confirma e registra item do sync'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.finish_estoquenow_sync(uuid,integer,integer,integer,integer,integer,text,text)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'public.finish_estoquenow_sync(uuid,integer,integer,integer,integer,integer,text,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.finish_estoquenow_sync(uuid,integer,integer,integer,integer,integer,text,text)',
      'EXECUTE'
    ),
  'somente service_role finaliza o sync'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_estoquenow_sync_health(integer)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'service_role',
      'public.get_estoquenow_sync_health(integer)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.get_estoquenow_sync_health(integer)',
      'EXECUTE'
    ),
  'health é exposto somente a usuário autenticado e valida gestor internamente'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'begin_estoquenow_sync', 'record_estoquenow_sync_item',
        'finish_estoquenow_sync', 'get_estoquenow_sync_health'
      )
      and (
        not procedure.prosecdef
        or not coalesce(procedure.proconfig, '{}'::text[]) @> array['search_path=""']
      )
  ),
  'RPCs do sync são SECURITY DEFINER com search_path vazio'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name in ('estoquenow_sync_runs', 'estoquenow_sync_items')
      and column_name in (
        'payload', 'response', 'error_message', 'event_name', 'destination', 'notes'
      )
  ),
  'ledger não possui colunas de payload, PII ou erro livre'
);

create temp table sync_test_runs (
  label text primary key,
  run_id uuid not null
);
grant select, insert, update on sync_test_runs to service_role;

set local role service_role;
select throws_ok(
  $$
    select public.begin_estoquenow_sync(
      'scheduled', 'observe', '2026-09-01', '2026-09-03', 6
    )
  $$,
  'P0001',
  'invalid sync run',
  'begin rejeita lote acima do limite de cinco'
);
insert into sync_test_runs (label, run_id)
select 'observe', (result->>'runId')::uuid
from (
  select public.begin_estoquenow_sync(
    'scheduled', 'observe', '2026-09-01', '2026-09-03', 5
  ) result
) started;

set local role postgres;
select is(
  (select status from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'observe')),
  'running',
  'begin cria execução observacional ativa'
);

set local role service_role;
insert into sync_test_runs (label, run_id)
select 'skipped', (result->>'runId')::uuid
from (
  select public.begin_estoquenow_sync(
    'scheduled', 'observe', '2026-09-01', '2026-09-03', 5
  ) result
) skipped;

set local role postgres;
select is(
  (select status from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'skipped')),
  'skipped',
  'segunda execução concorrente fica registrada como skipped'
);
select is(
  (select count(*) from private.estoquenow_sync_runs where status = 'running'),
  1::bigint,
  'single-flight mantém exatamente uma execução ativa'
);

set local role service_role;
select is(
  public.finish_estoquenow_sync(
    (select run_id from sync_test_runs where label = 'observe'),
    5, 4, 2, 1, 2, repeat('c', 64), null
  )->>'status',
  'partial',
  'execução observe sinaliza bloqueios sem tentar escrita externa'
);

set local role postgres;
select ok(
  (select fetched_count = 5
      and valid_count = 4
      and eligible_count = 2
      and attempted_count = 0
      and blocked_count = 1
      and deferred_count = 2
      and contract_hash = repeat('c', 64)
      and error_code = 'item_blocked'
    from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'observe')),
  'resumo observe reconcilia contagens e hash sem payload'
);

set local role service_role;
insert into sync_test_runs (label, run_id)
select 'apply', (result->>'runId')::uuid
from (
  select public.begin_estoquenow_sync(
    'manual', 'apply', '2026-09-01', '2026-09-03', 1
  ) result
) started;

set local role postgres;
select is(
  (select status from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'apply')),
  'running',
  'begin inicia execução apply depois da anterior finalizar'
);

set local role service_role;
select is(
  public.record_estoquenow_sync_item(
    (select run_id from sync_test_runs where label = 'apply'),
    'external-sync-ledger-1', '1', repeat('a', 64), repeat('b', 64), 'new',
    'Operação sync ledger', 'Destino de teste',
    '2026-09-04 12:00:00-03'::timestamptz, '',
    '2026-09-03 12:00:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{"order_id":"sync-order-1","delivery_status_type":"pending","delivery_concluded":false,"item_count":"1"}'::jsonb,
    'Operação sync ledger', 'Destino de teste', '',
    '[{"id":"sync-line-1","itemId":"sync-item-1","orderId":"sync-order-1","name":"Mesa"}]'::jsonb,
    null
  )->>'outcome',
  'applied',
  'record confirma operação e registra resultado no mesmo RPC'
);

set local role postgres;
select ok(
  exists (
    select 1
    from public.operations operation
    join public.estoquenow_operation_contexts context
      on context.operation_id = operation.id
    where operation.source = 'estoquenow'
      and operation.external_id = 'external-sync-ledger-1'
      and context.order_id = 'sync-order-1'
      and pg_catalog.jsonb_array_length(context.items) = 1
  ),
  'wrapper atômico persiste operação e contexto estruturado'
);
select is(
  (select outcome from private.estoquenow_sync_items
    where run_id = (select run_id from sync_test_runs where label = 'apply')
      and external_id = 'external-sync-ledger-1'),
  'applied',
  'ledger registra o desfecho aplicado sem conteúdo operacional'
);

set local role service_role;
select is(
  public.record_estoquenow_sync_item(
    (select run_id from sync_test_runs where label = 'apply'),
    'external-sync-ledger-1', '1', repeat('a', 64), repeat('b', 64), 'new',
    'Operação sync ledger', 'Destino de teste',
    '2026-09-04 12:00:00-03'::timestamptz, '',
    '2026-09-03 12:00:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{"order_id":"sync-order-1","delivery_status_type":"pending","delivery_concluded":false,"item_count":"1"}'::jsonb,
    'Operação sync ledger', 'Destino de teste', '',
    '[{"id":"sync-line-1","itemId":"sync-item-1","orderId":"sync-order-1","name":"Mesa"}]'::jsonb,
    null
  )->>'outcome',
  'applied',
  'retry do mesmo item retorna o resultado registrado'
);

set local role postgres;
select is(
  (select count(*) from private.estoquenow_sync_items
    where run_id = (select run_id from sync_test_runs where label = 'apply')),
  1::bigint,
  'retry idempotente não duplica item do ledger'
);

set local role service_role;
select is(
  public.record_estoquenow_sync_item(
    (select run_id from sync_test_runs where label = 'apply'),
    'external-sync-ledger-2', '1', repeat('d', 64), repeat('e', 64), 'new',
    'Operação fora do lote', 'Destino de teste',
    '2026-09-04 13:00:00-03'::timestamptz, '',
    '2026-09-03 12:01:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{"order_id":"sync-order-2"}'::jsonb,
    'Operação fora do lote', 'Destino de teste', '', '[]'::jsonb, null
  )->>'errorCode',
  'batch_exhausted',
  'segundo item é bloqueado pelo cap persistido do lote'
);

set local role postgres;
select is(
  (select attempted_count from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'apply')),
  1,
  'cap do lote permanece correto após tentativa excedente'
);
select is(
  (select count(*) from public.operations where external_id = 'external-sync-ledger-2'),
  0::bigint,
  'item acima do cap não chega à persistência operacional'
);

set local role service_role;
select is(
  public.finish_estoquenow_sync(
    (select run_id from sync_test_runs where label = 'apply'),
    2, 2, 2, 0, 1, repeat('f', 64), null
  )->>'status',
  'succeeded',
  'finish reconcilia item aplicado e candidato adiado'
);

set local role postgres;
select ok(
  (select attempted_count = 1
      and applied_count = 1
      and unchanged_count = 0
      and failed_count = 0
      and deferred_count = 1
      and contract_hash = repeat('f', 64)
    from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'apply')),
  'resumo apply deriva desfechos do ledger e preserva hash do contrato'
);

set local role service_role;
select is(
  public.finish_estoquenow_sync(
    (select run_id from sync_test_runs where label = 'apply'),
    99, 99, 99, 99, 99, repeat('0', 64), 'internal'
  )->>'status',
  'succeeded',
  'finish repetido é idempotente e não reescreve resumo final'
);

insert into sync_test_runs (label, run_id)
select 'expired', (result->>'runId')::uuid
from (
  select public.begin_estoquenow_sync(
    'manual', 'apply', '2026-09-01', '2026-09-03', 1
  ) result
) started;

select is(
  public.record_estoquenow_sync_item(
    (select run_id from sync_test_runs where label = 'expired'),
    'external-sync-expired-begin', '1', repeat('1', 64), repeat('2', 64), 'new',
    'Operação lease begin', 'Destino de teste',
    '2026-09-04 14:00:00-03'::timestamptz, '',
    '2026-09-03 12:02:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{"order_id":"sync-order-expired-begin"}'::jsonb,
    'Operação lease begin', 'Destino de teste', '',
    '[{"id":"sync-line-expired-begin","itemId":"sync-item-expired-begin","orderId":"sync-order-expired-begin","name":"Mesa"}]'::jsonb,
    null
  )->>'outcome',
  'applied',
  'run que vencerá registra desfecho antes da expiração'
);

set local role postgres;
update private.estoquenow_sync_runs
set lease_expires_at = started_at + interval '1 microsecond'
where id = (select run_id from sync_test_runs where label = 'expired');

set local role service_role;
insert into sync_test_runs (label, run_id)
select 'replacement', (result->>'runId')::uuid
from (
  select public.begin_estoquenow_sync(
    'scheduled', 'observe', '2026-09-01', '2026-09-03', 5
  ) result
) started;

set local role postgres;
select ok(
  (select status = 'abandoned'
      and attempted_count = 1
      and applied_count = 1
      and failed_count = 0
    from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'expired')),
  'begin abandona lease vencido reconciliando o desfecho persistido'
);
select is(
  (select status from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'replacement')),
  'running',
  'novo ciclo assume o single-flight depois do lease vencido'
);
select is(
  (select count(*) from private.estoquenow_sync_runs where status = 'running'),
  1::bigint,
  'troca de lease mantém uma única execução ativa'
);

set local role service_role;
select is(
  public.finish_estoquenow_sync(
    (select run_id from sync_test_runs where label = 'replacement'),
    0, 0, 0, 0, 0, null, null
  )->>'status',
  'succeeded',
  'execução substituta finaliza normalmente'
);

insert into sync_test_runs (label, run_id)
select 'finish-expired', (result->>'runId')::uuid
from (
  select public.begin_estoquenow_sync(
    'manual', 'apply', '2026-09-01', '2026-09-03', 1
  ) result
) started;
select is(
  public.record_estoquenow_sync_item(
    (select run_id from sync_test_runs where label = 'finish-expired'),
    'external-sync-expired-finish', '1', repeat('3', 64), repeat('4', 64), 'new',
    'Operação lease finish', 'Destino de teste',
    '2026-09-04 15:00:00-03'::timestamptz, '',
    '2026-09-03 12:03:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{"order_id":"sync-order-expired-finish"}'::jsonb,
    'Operação lease finish', 'Destino de teste', '',
    '[{"id":"sync-line-expired-finish","itemId":"sync-item-expired-finish","orderId":"sync-order-expired-finish","name":"Mesa"}]'::jsonb,
    null
  )->>'outcome',
  'applied',
  'finish expirado possui desfecho persistido para reconciliar'
);

set local role postgres;
update private.estoquenow_sync_runs
set lease_expires_at = started_at + interval '1 microsecond'
where id = (select run_id from sync_test_runs where label = 'finish-expired');

set local role service_role;
select is(
  public.finish_estoquenow_sync(
    (select run_id from sync_test_runs where label = 'finish-expired'),
    0, 0, 0, 0, 0, null, 'internal'
  )->>'status',
  'abandoned',
  'finish vencido abandona o run sem perder o desfecho já confirmado'
);

set local role postgres;
select ok(
  (select attempted_count = 1
      and applied_count = 1
      and failed_count = 0
      and error_code = 'lease_expired'
    from private.estoquenow_sync_runs
    where id = (select run_id from sync_test_runs where label = 'finish-expired')),
  'finish vencido reconcilia contagens pelo ledger de itens'
);

set local role service_role;
insert into sync_test_runs (label, run_id)
select 'all-failed', (result->>'runId')::uuid
from (
  select public.begin_estoquenow_sync(
    'manual', 'apply', '2026-09-01', '2026-09-03', 1
  ) result
) started;
select is(
  public.record_estoquenow_sync_item(
    (select run_id from sync_test_runs where label = 'all-failed'),
    'external-sync-all-failed', '1', repeat('5', 64), repeat('6', 64), 'new',
    'Operação inválida', 'Destino de teste',
    '2026-09-04 16:00:00-03'::timestamptz, '',
    '2026-09-03 12:04:00-03'::timestamptz,
    '10000000-0000-4000-8000-000000000001',
    '{"order_id":"sync-order-all-failed"}'::jsonb,
    'Operação inválida', 'Destino de teste', '',
    'null'::jsonb,
    null
  )->>'outcome',
  'failed',
  'wrapper registra falha sanitizada sem persistir operação inválida'
);
select ok(
  (select result->>'status' = 'failed'
      and result->>'errorCode' = 'item_failure'
    from (
      select public.finish_estoquenow_sync(
        (select run_id from sync_test_runs where label = 'all-failed'),
        1, 1, 1, 0, 0, null, null
      ) result
    ) finished),
  'finish alinha status failed quando todos os attempts falham'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.get_estoquenow_sync_health(10)$$,
  'P0001',
  'forbidden',
  'funcionário não acessa observabilidade gerencial'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select ok(
  pg_catalog.jsonb_typeof(public.get_estoquenow_sync_health(10)->'recentRuns') = 'array'
    and public.get_estoquenow_sync_health(10) ? 'lastRun'
    and public.get_estoquenow_sync_health(10) ? 'lastSuccessfulScheduledRun',
  'gestor recebe health agregado com histórico recente e último sucesso agendado'
);
select ok(
  position(
    'external-sync-ledger-1' in public.get_estoquenow_sync_health(10)::text
  ) = 0,
  'health não expõe IDs externos nem detalhes de itens'
);
select ok(
  public.get_estoquenow_sync_health(1)->'lastSuccessfulScheduledRun' is not null,
  'último sucesso agendado não depende do limite do histórico recente'
);

set local role postgres;
select ok(
  pg_catalog.to_regprocedure('public.get_estoquenow_sync_existing(text[])') is not null,
  'RPC estreito de leitura incremental existe'
);
select ok(
  has_function_privilege(
    'service_role', 'public.get_estoquenow_sync_existing(text[])', 'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated', 'public.get_estoquenow_sync_existing(text[])', 'EXECUTE'
    )
    and not has_function_privilege(
      'anon', 'public.get_estoquenow_sync_existing(text[])', 'EXECUTE'
    ),
  'somente service_role executa a leitura incremental'
);
select ok(
  (select procedure.prosecdef
      and coalesce(procedure.proconfig, '{}'::text[]) @> array['search_path=""']
    from pg_catalog.pg_proc procedure
    where procedure.oid = 'public.get_estoquenow_sync_existing(text[])'::regprocedure),
  'RPC de leitura usa SECURITY DEFINER com search_path vazio'
);

set local role service_role;
select throws_ok(
  $$
    select public.get_estoquenow_sync_existing(
      array(select 'external-' || number from pg_catalog.generate_series(1, 101) number)
    )
  $$,
  'P0001',
  'invalid external ids',
  'RPC rejeita mais de cem IDs externos'
);
select is(
  public.get_estoquenow_sync_existing('{}'::text[]),
  '[]'::jsonb,
  'RPC aceita lote vazio sem consultar dados amplos'
);
select ok(
  (select pg_catalog.jsonb_array_length(response) = 1
      and (select count(*) from pg_catalog.jsonb_object_keys(response->0)) = 9
      and (response->0) ?& array[
        'external_id', 'event_name', 'destination', 'scheduled_at', 'notes',
        'imported_at', 'status', 'has_events', 'source_context'
      ]
      and pg_catalog.jsonb_typeof(response->0->'has_events') = 'boolean'
    from (
      select public.get_estoquenow_sync_existing(
        array[' external-canary-1 ', 'external-canary-1']
      ) response
    ) result),
  'RPC deduplica IDs e retorna somente o envelope necessário'
);
select ok(
  (select (select count(*)
      from pg_catalog.jsonb_object_keys(response->0->'source_context')) = 21
      and (response->0->'source_context') ?& array[
        'order_id', 'protocol', 'source_version', 'return_at', 'venue',
        'address_zipcode', 'address_street', 'address_number', 'address_complement',
        'address_neighborhood', 'address_city', 'address_state',
        'delivery_status_id', 'delivery_status_type', 'delivery_concluded',
        'return_status_id', 'return_status_type', 'return_concluded',
        'item_count', 'order_type', 'logistic_type_id'
      ]
    from (
      select public.get_estoquenow_sync_existing(
        array['external-canary-1']
      ) response
    ) result),
  'contexto 1:1 usa allowlist estável e não inclui items'
);

set local role postgres;
update public.operations
set external_id = 'external-manual-sync-read'
where id = '40000000-0000-4000-8000-000000000001' and source = 'manual';
set local role service_role;
select is(
  public.get_estoquenow_sync_existing(array['external-manual-sync-read']),
  '[]'::jsonb,
  'RPC nunca mistura operação manual com leitura do EstoqueNOW'
);

set local role postgres;
select has_table(
  'private',
  'estoquenow_item_photo_rate_limits',
  'rate limit privado do proxy de fotos existe'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class
    where oid = 'private.estoquenow_item_photo_rate_limits'::regclass),
  true,
  'rate limit de fotos usa RLS como defesa em profundidade'
);
select ok(
  not has_table_privilege(
    'authenticated', 'private.estoquenow_item_photo_rate_limits', 'SELECT'
  )
    and not has_table_privilege(
      'authenticated', 'private.estoquenow_item_photo_rate_limits', 'INSERT'
    )
    and not has_table_privilege(
      'authenticated', 'private.estoquenow_item_photo_rate_limits', 'UPDATE'
    )
    and not has_table_privilege(
      'anon', 'private.estoquenow_item_photo_rate_limits', 'SELECT'
    )
    and not has_table_privilege(
      'service_role', 'private.estoquenow_item_photo_rate_limits', 'SELECT'
    ),
  'clientes e service_role não acessam diretamente o contador privado'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.claim_estoquenow_item_photo_request(uuid)'
  ) is not null,
  'RPC estreito de claim de foto existe'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.claim_estoquenow_item_photo_request(uuid)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.claim_estoquenow_item_photo_request(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.claim_estoquenow_item_photo_request(uuid)',
      'EXECUTE'
    ),
  'somente authenticated executa o claim de foto'
);
select ok(
  (select procedure.prosecdef
      and coalesce(procedure.proconfig, '{}'::text[]) @> array['search_path=""']
    from pg_catalog.pg_proc procedure
    where procedure.oid =
      'public.claim_estoquenow_item_photo_request(uuid)'::regprocedure),
  'claim de foto usa SECURITY DEFINER com search_path vazio'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
create temp table photo_rate_claims (
  attempt integer primary key,
  allowed boolean not null,
  retry_after_seconds integer not null
);

do $$
begin
  for attempt in 1..61 loop
    insert into photo_rate_claims
    select attempt, claim.allowed, claim.retry_after_seconds
    from public.claim_estoquenow_item_photo_request(
      '40000000-0000-4000-8000-000000000012'
    ) claim;
  end loop;
end
$$;
select is(
  (select count(*) from photo_rate_claims where allowed),
  60::bigint,
  'janela permite sessenta fotos para um ator e operação'
);
select ok(
  (select not allowed and retry_after_seconds between 1 and 60
    from photo_rate_claims where attempt = 61),
  'claim excedente é negado com retry-after curto e limitado'
);
set local role postgres;
select ok(
  (select request_count = 61
    from private.estoquenow_item_photo_rate_limits
    where actor_id = '10000000-0000-4000-8000-000000000001'
      and operation_id = '40000000-0000-4000-8000-000000000012')
    and (select count(*) from private.estoquenow_item_photo_rate_limits
      where actor_id = '10000000-0000-4000-8000-000000000001'
        and operation_id = '40000000-0000-4000-8000-000000000012') = 1,
  'contador satura sem criar histórico ou linhas duplicadas'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select ok(
  (select allowed and retry_after_seconds = 0
    from public.claim_estoquenow_item_photo_request(
      '40000000-0000-4000-8000-000000000012'
    )),
  'participante acessível possui janela independente por ator'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000003';
select throws_ok(
  $$
    select * from public.claim_estoquenow_item_photo_request(
      '40000000-0000-4000-8000-000000000012'
    )
  $$,
  '42501',
  'forbidden',
  'usuário sem acesso à operação não consome nem cria janela'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select throws_ok(
  $$
    select * from public.claim_estoquenow_item_photo_request(
      '40000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'forbidden',
  'claim rejeita operação que não pertence ao EstoqueNOW'
);

set local role postgres;
update private.estoquenow_item_photo_rate_limits
set window_started_at = statement_timestamp() - interval '61 seconds',
  request_count = 61
where actor_id = '10000000-0000-4000-8000-000000000001'
  and operation_id = '40000000-0000-4000-8000-000000000012';
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select ok(
  (select allowed and retry_after_seconds = 0
    from public.claim_estoquenow_item_photo_request(
      '40000000-0000-4000-8000-000000000012'
    )),
  'janela vencida é resetada e permite novo claim'
);
set local role postgres;
select is(
  (select request_count
    from private.estoquenow_item_photo_rate_limits
    where actor_id = '10000000-0000-4000-8000-000000000001'
      and operation_id = '40000000-0000-4000-8000-000000000012'),
  1::smallint,
  'reset reutiliza a mesma linha e reinicia o contador'
);

set local role postgres;
select ok(
  (select not public
      and file_size_limit = 6000000
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
    from storage.buckets
    where id = 'estoquenow-item-photos'
      and name = 'estoquenow-item-photos'),
  'cache de fotos do EstoqueNOW é privado e restringe tamanho e MIME'
);
select is(
  (select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') like '%estoquenow-item-photos%'
        or coalesce(with_check, '') like '%estoquenow-item-photos%'
      )),
  0::bigint,
  'cache não possui policy de objetos para clientes'
);
insert into storage.objects (bucket_id, name, metadata)
values (
  'estoquenow-item-photos',
  'external-operation/external-item/source-version.webp',
  '{}'::jsonb
);

set local role anon;
select is(
  (select count(*) from storage.objects
    where bucket_id = 'estoquenow-item-photos'),
  0::bigint,
  'anon não lê o cache privado'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from storage.objects
    where bucket_id = 'estoquenow-item-photos'),
  0::bigint,
  'authenticated não lê o cache privado'
);

set local role service_role;
select is(
  (select count(*) from storage.objects
    where bucket_id = 'estoquenow-item-photos'),
  1::bigint,
  'service role lê o cache pelo backend'
);

select * from finish();
rollback;
