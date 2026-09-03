create function public.get_estoquenow_sync_existing(p_external_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  result jsonb;
begin
  if p_external_ids is null
    or pg_catalog.cardinality(p_external_ids) > 100
    or exists (
      select 1
      from pg_catalog.unnest(p_external_ids) external_id
      where nullif(pg_catalog.btrim(external_id), '') is null
        or pg_catalog.length(pg_catalog.btrim(external_id)) > 200
    )
    then raise exception 'invalid external ids';
  end if;

  with requested as (
    select distinct pg_catalog.btrim(external_id) as external_id
    from pg_catalog.unnest(p_external_ids) external_id
  ), matched as (
    select
      operation.external_id,
      operation.event_name,
      operation.destination,
      operation.scheduled_at,
      operation.notes,
      operation.imported_at,
      operation.status,
      exists (
        select 1
        from public.operation_events event
        where event.operation_id = operation.id
      ) as has_events,
      case when context.operation_id is null then null
        else pg_catalog.jsonb_build_object(
          'order_id', context.order_id,
          'protocol', context.protocol,
          'source_version', context.source_version,
          'return_at', context.return_at,
          'venue', context.venue,
          'address_zipcode', context.address_zipcode,
          'address_street', context.address_street,
          'address_number', context.address_number,
          'address_complement', context.address_complement,
          'address_neighborhood', context.address_neighborhood,
          'address_city', context.address_city,
          'address_state', context.address_state,
          'delivery_status_id', context.delivery_status_id,
          'delivery_status_type', context.delivery_status_type,
          'delivery_concluded', context.delivery_concluded,
          'return_status_id', context.return_status_id,
          'return_status_type', context.return_status_type,
          'return_concluded', context.return_concluded,
          'item_count', context.item_count,
          'order_type', context.order_type,
          'logistic_type_id', context.logistic_type_id
        )
      end as source_context
    from requested
    join public.operations operation
      on operation.source = 'estoquenow'
      and operation.external_id = requested.external_id
    left join public.estoquenow_operation_contexts context
      on context.operation_id = operation.id
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'external_id', external_id,
        'event_name', event_name,
        'destination', destination,
        'scheduled_at', scheduled_at,
        'notes', notes,
        'imported_at', imported_at,
        'status', status,
        'has_events', has_events,
        'source_context', source_context
      ) order by external_id
    ),
    '[]'::jsonb
  ) into result
  from matched;

  return result;
end
$$;

revoke execute on function public.get_estoquenow_sync_existing(text[])
  from public, anon, authenticated, service_role;
grant execute on function public.get_estoquenow_sync_existing(text[])
  to service_role;

create or replace function public.begin_estoquenow_sync(
  p_trigger text,
  p_mode text,
  p_window_start date,
  p_window_end date,
  p_batch_limit integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  new_run private.estoquenow_sync_runs;
begin
  if p_trigger is null or p_trigger not in ('scheduled', 'manual')
    or p_mode is null or p_mode not in ('observe', 'apply')
    or p_window_start is null
    or p_window_end is null
    or p_window_end < p_window_start
    or p_window_end - p_window_start > 366
    or p_batch_limit is null
    or p_batch_limit not between 1 and 5
    then raise exception 'invalid sync run';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('estoquenow:sync-run', 0)
  );

  with expired_counts as (
    select
      run.id,
      count(item.run_id)::integer as attempted,
      count(item.run_id) filter (where item.outcome = 'applied')::integer as applied,
      count(item.run_id) filter (where item.outcome = 'unchanged')::integer as unchanged,
      count(item.run_id) filter (where item.outcome = 'blocked')::integer as blocked,
      count(item.run_id) filter (where item.outcome in ('failed', 'applying'))::integer as failed
    from private.estoquenow_sync_runs run
    left join private.estoquenow_sync_items item on item.run_id = run.id
    where run.source = 'estoquenow'
      and run.status = 'running'
      and run.lease_expires_at <= v_now
    group by run.id
  )
  update private.estoquenow_sync_runs run
  set status = 'abandoned',
    finished_at = v_now,
    fetched_count = greatest(
      run.fetched_count, expired.attempted, run.blocked_count + expired.blocked
    ),
    valid_count = greatest(
      run.valid_count, expired.attempted, run.blocked_count + expired.blocked
    ),
    eligible_count = greatest(run.eligible_count, expired.attempted),
    attempted_count = expired.attempted,
    applied_count = expired.applied,
    unchanged_count = expired.unchanged,
    blocked_count = run.blocked_count + expired.blocked,
    failed_count = expired.failed,
    error_code = 'lease_expired'
  from expired_counts expired
  where run.id = expired.id;

  if exists (
    select 1
    from private.estoquenow_sync_runs
    where source = 'estoquenow' and status = 'running'
  ) then
    insert into private.estoquenow_sync_runs (
      trigger_kind, mode, status, window_start, window_end, batch_limit,
      lease_expires_at, started_at, finished_at, error_code
    ) values (
      p_trigger, p_mode, 'skipped', p_window_start, p_window_end, p_batch_limit,
      v_now + interval '10 minutes', v_now, v_now, 'already_running'
    ) returning * into new_run;

    return pg_catalog.jsonb_build_object(
      'started', false,
      'runId', new_run.id,
      'status', new_run.status,
      'batchLimit', new_run.batch_limit,
      'errorCode', new_run.error_code
    );
  end if;

  insert into private.estoquenow_sync_runs (
    trigger_kind, mode, status, window_start, window_end, batch_limit,
    lease_expires_at, started_at
  ) values (
    p_trigger, p_mode, 'running', p_window_start, p_window_end, p_batch_limit,
    v_now + interval '10 minutes', v_now
  ) returning * into new_run;

  return pg_catalog.jsonb_build_object(
    'started', true,
    'runId', new_run.id,
    'status', new_run.status,
    'batchLimit', new_run.batch_limit,
    'errorCode', null
  );
end
$$;

create or replace function public.finish_estoquenow_sync(
  p_run_id uuid,
  p_fetched_count integer,
  p_valid_count integer,
  p_eligible_count integer,
  p_blocked_count integer,
  p_deferred_count integer,
  p_contract_hash text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  current_run private.estoquenow_sync_runs;
  counted_attempts integer;
  counted_applied integer;
  counted_unchanged integer;
  counted_blocked integer;
  counted_failed integer;
  final_status text;
  final_error_code text;
  reconciled_eligible integer;
  reconciled_valid integer;
  reconciled_fetched integer;
begin
  if p_run_id is null
    or p_fetched_count is null or p_fetched_count < 0
    or p_valid_count is null or p_valid_count not between 0 and p_fetched_count
    or p_eligible_count is null or p_eligible_count not between 0 and p_valid_count
    or p_blocked_count is null or p_blocked_count not between 0 and p_valid_count
    or p_deferred_count is null or p_deferred_count not between 0 and p_eligible_count
    or (p_contract_hash is not null and p_contract_hash !~ '^[0-9a-f]{64}$')
    or (
      p_error_code is not null and p_error_code not in (
        'auth_failed', 'rate_limited', 'source_unavailable', 'contract_changed',
        'page_limit', 'invalid_source', 'internal'
      )
    )
    then raise exception 'invalid sync summary';
  end if;

  select * into current_run
  from private.estoquenow_sync_runs
  where id = p_run_id
  for update;

  if not found then raise exception 'sync run unavailable'; end if;

  if current_run.status <> 'running' then
    return pg_catalog.jsonb_build_object(
      'runId', current_run.id,
      'status', current_run.status,
      'attempted', current_run.attempted_count,
      'applied', current_run.applied_count,
      'unchanged', current_run.unchanged_count,
      'blocked', current_run.blocked_count,
      'deferred', current_run.deferred_count,
      'failed', current_run.failed_count,
      'errorCode', current_run.error_code
    );
  end if;

  select
    count(*)::integer,
    count(*) filter (where outcome = 'applied')::integer,
    count(*) filter (where outcome = 'unchanged')::integer,
    count(*) filter (where outcome = 'blocked')::integer,
    count(*) filter (where outcome in ('failed', 'applying'))::integer
  into counted_attempts, counted_applied, counted_unchanged, counted_blocked, counted_failed
  from private.estoquenow_sync_items
  where run_id = p_run_id;

  if current_run.lease_expires_at <= v_now then
    reconciled_eligible := greatest(
      p_eligible_count, counted_attempts, p_deferred_count
    );
    reconciled_valid := greatest(
      p_valid_count, reconciled_eligible, p_blocked_count + counted_blocked
    );
    reconciled_fetched := greatest(p_fetched_count, reconciled_valid);

    update private.estoquenow_sync_runs
    set status = 'abandoned',
      finished_at = v_now,
      fetched_count = reconciled_fetched,
      valid_count = reconciled_valid,
      eligible_count = reconciled_eligible,
      attempted_count = counted_attempts,
      applied_count = counted_applied,
      unchanged_count = counted_unchanged,
      blocked_count = p_blocked_count + counted_blocked,
      deferred_count = p_deferred_count,
      failed_count = counted_failed,
      contract_hash = p_contract_hash,
      error_code = 'lease_expired'
    where id = p_run_id
    returning * into current_run;
    return pg_catalog.jsonb_build_object(
      'runId', current_run.id,
      'status', current_run.status,
      'attempted', current_run.attempted_count,
      'applied', current_run.applied_count,
      'unchanged', current_run.unchanged_count,
      'blocked', current_run.blocked_count,
      'deferred', current_run.deferred_count,
      'failed', current_run.failed_count,
      'errorCode', current_run.error_code
    );
  end if;

  if counted_attempts <> current_run.attempted_count
    or counted_attempts > current_run.batch_limit
    or p_eligible_count <> counted_attempts + p_deferred_count
    or (current_run.mode = 'observe' and counted_attempts <> 0)
    or p_blocked_count + counted_blocked > p_valid_count
    then raise exception 'sync summary mismatch';
  end if;

  final_error_code := case
    when p_error_code is not null then p_error_code
    when counted_failed > 0 then 'item_failure'
    when p_blocked_count + counted_blocked > 0 then 'item_blocked'
    else null
  end;
  final_status := case
    when p_error_code is not null and counted_applied + counted_unchanged = 0 then 'failed'
    when counted_attempts > 0
      and counted_applied + counted_unchanged = 0
      and counted_failed + counted_blocked = counted_attempts
      then 'failed'
    when p_error_code is not null
      or counted_failed > 0
      or p_blocked_count + counted_blocked > 0
      then 'partial'
    else 'succeeded'
  end;

  update private.estoquenow_sync_runs
  set status = final_status,
    finished_at = v_now,
    fetched_count = p_fetched_count,
    valid_count = p_valid_count,
    eligible_count = p_eligible_count,
    applied_count = counted_applied,
    unchanged_count = counted_unchanged,
    blocked_count = p_blocked_count + counted_blocked,
    deferred_count = p_deferred_count,
    failed_count = counted_failed,
    contract_hash = p_contract_hash,
    error_code = final_error_code
  where id = p_run_id
  returning * into current_run;

  return pg_catalog.jsonb_build_object(
    'runId', current_run.id,
    'status', current_run.status,
    'attempted', current_run.attempted_count,
    'applied', current_run.applied_count,
    'unchanged', current_run.unchanged_count,
    'blocked', current_run.blocked_count,
    'deferred', current_run.deferred_count,
    'failed', current_run.failed_count,
    'errorCode', current_run.error_code
  );
end
$$;
