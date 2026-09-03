create table private.estoquenow_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'estoquenow' check (source = 'estoquenow'),
  trigger_kind text not null check (trigger_kind in ('scheduled', 'manual')),
  mode text not null check (mode in ('observe', 'apply')),
  status text not null check (
    status in ('running', 'succeeded', 'partial', 'failed', 'abandoned', 'skipped')
  ),
  window_start date not null,
  window_end date not null,
  batch_limit smallint not null check (batch_limit between 1 and 5),
  lease_expires_at timestamptz not null
    check (lease_expires_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)),
  started_at timestamptz not null default statement_timestamp()
    check (started_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)),
  finished_at timestamptz
    check (finished_at is null or finished_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)),
  fetched_count integer not null default 0 check (fetched_count >= 0),
  valid_count integer not null default 0 check (valid_count between 0 and fetched_count),
  eligible_count integer not null default 0 check (eligible_count between 0 and valid_count),
  attempted_count integer not null default 0 check (
    attempted_count between 0 and batch_limit and attempted_count <= eligible_count
  ),
  applied_count integer not null default 0 check (applied_count between 0 and attempted_count),
  unchanged_count integer not null default 0 check (unchanged_count between 0 and attempted_count),
  blocked_count integer not null default 0 check (blocked_count between 0 and valid_count),
  deferred_count integer not null default 0 check (deferred_count between 0 and eligible_count),
  failed_count integer not null default 0 check (failed_count between 0 and attempted_count),
  contract_hash text check (contract_hash is null or contract_hash ~ '^[0-9a-f]{64}$'),
  error_code text check (
    error_code is null or error_code in (
      'already_running', 'lease_expired', 'auth_failed', 'rate_limited',
      'source_unavailable', 'contract_changed', 'page_limit', 'invalid_source',
      'item_blocked', 'item_failure', 'internal'
    )
  ),
  check (window_end >= window_start and window_end - window_start <= 366),
  check (lease_expires_at > started_at),
  check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  ),
  check (finished_at is null or finished_at >= started_at),
  check (applied_count + unchanged_count + failed_count <= attempted_count)
);

create unique index estoquenow_sync_runs_single_flight_idx
  on private.estoquenow_sync_runs (source)
  where status = 'running';

create index estoquenow_sync_runs_started_at_idx
  on private.estoquenow_sync_runs (started_at desc);

create table private.estoquenow_sync_items (
  run_id uuid not null references private.estoquenow_sync_runs(id) on delete cascade,
  external_id text not null check (length(trim(external_id)) between 1 and 200),
  source_version text check (source_version is null or length(source_version) <= 200),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  items_hash text not null check (items_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('new', 'update')),
  outcome text not null check (outcome in ('applying', 'applied', 'unchanged', 'blocked', 'failed')),
  error_code text check (
    error_code is null or error_code in (
      'cas_stale', 'historic_blocked', 'source_conflict',
      'validation_failed', 'batch_exhausted', 'lease_expired', 'internal'
    )
  ),
  expected_imported_at timestamptz check (
    expected_imported_at is null
    or expected_imported_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)
  ),
  resulting_imported_at timestamptz check (
    resulting_imported_at is null
    or resulting_imported_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)
  ),
  recorded_at timestamptz not null default statement_timestamp()
    check (recorded_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)),
  primary key (run_id, external_id),
  check (
    (outcome in ('applying', 'applied', 'unchanged') and error_code is null)
    or (outcome in ('blocked', 'failed') and error_code is not null)
  )
);

alter table private.estoquenow_sync_runs enable row level security;
alter table private.estoquenow_sync_items enable row level security;

revoke all on table private.estoquenow_sync_runs
  from public, anon, authenticated, service_role;
revoke all on table private.estoquenow_sync_items
  from public, anon, authenticated, service_role;

create function public.begin_estoquenow_sync(
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
  active_run private.estoquenow_sync_runs;
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

  update private.estoquenow_sync_runs
  set status = 'abandoned', finished_at = v_now, error_code = 'lease_expired'
  where source = 'estoquenow'
    and status = 'running'
    and lease_expires_at <= v_now;

  select * into active_run
  from private.estoquenow_sync_runs
  where source = 'estoquenow' and status = 'running';

  if found then
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

create function public.record_estoquenow_sync_item(
  p_run_id uuid,
  p_external_id text,
  p_source_version text,
  p_source_hash text,
  p_items_hash text,
  p_decision text,
  p_event_name text,
  p_destination text,
  p_scheduled_at timestamptz,
  p_notes text,
  p_imported_at timestamptz,
  p_manager_id uuid,
  p_context jsonb,
  p_legacy_event_name text,
  p_legacy_destination text,
  p_legacy_notes text,
  p_items jsonb,
  p_expected_imported_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  current_run private.estoquenow_sync_runs;
  current_item private.estoquenow_sync_items;
  import_result text;
  item_outcome text;
  safe_error_code text;
  resulting_time timestamptz;
begin
  if p_run_id is null
    or nullif(trim(p_external_id), '') is null
    or length(trim(p_external_id)) > 200
    or (p_source_version is not null and length(p_source_version) > 200)
    or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$'
    or p_items_hash is null or p_items_hash !~ '^[0-9a-f]{64}$'
    or p_decision is null or p_decision not in ('new', 'update')
    then raise exception 'invalid sync item';
  end if;

  select * into current_run
  from private.estoquenow_sync_runs
  where id = p_run_id
  for update;

  if not found or current_run.mode <> 'apply' or current_run.status <> 'running'
    then raise exception 'sync run unavailable';
  end if;

  if current_run.lease_expires_at <= v_now then
    update private.estoquenow_sync_runs
    set status = 'abandoned', finished_at = v_now, error_code = 'lease_expired'
    where id = p_run_id;
    return pg_catalog.jsonb_build_object(
      'outcome', 'blocked', 'errorCode', 'lease_expired', 'result', null
    );
  end if;

  select * into current_item
  from private.estoquenow_sync_items
  where run_id = p_run_id and external_id = trim(p_external_id);

  if found then
    if current_item.source_hash is distinct from p_source_hash
      or current_item.items_hash is distinct from p_items_hash
      or current_item.decision is distinct from p_decision
      then raise exception 'sync item conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', current_item.outcome,
      'errorCode', current_item.error_code,
      'result', case
        when current_item.outcome = 'applied' then 'applied'
        when current_item.outcome = 'unchanged' then 'unchanged'
        else null
      end
    );
  end if;

  if current_run.attempted_count >= current_run.batch_limit then
    return pg_catalog.jsonb_build_object(
      'outcome', 'blocked', 'errorCode', 'batch_exhausted', 'result', null
    );
  end if;

  insert into private.estoquenow_sync_items (
    run_id, external_id, source_version, source_hash, items_hash, decision,
    outcome, expected_imported_at
  ) values (
    p_run_id, trim(p_external_id), nullif(trim(p_source_version), ''),
    p_source_hash, p_items_hash, p_decision, 'applying', p_expected_imported_at
  );

  update private.estoquenow_sync_runs
  set fetched_count = fetched_count + 1,
    valid_count = valid_count + 1,
    eligible_count = eligible_count + 1,
    attempted_count = attempted_count + 1
  where id = p_run_id;

  begin
    import_result := public.confirm_estoquenow_canary(
      p_external_id, p_event_name, p_destination, p_scheduled_at, p_notes,
      p_imported_at, p_manager_id, p_context, p_legacy_event_name,
      p_legacy_destination, p_legacy_notes, p_items, p_expected_imported_at
    );
    if import_result in ('new', 'updated', 'backfilled') then
      item_outcome := 'applied';
    elsif import_result = 'unchanged' then
      item_outcome := 'unchanged';
    else
      raise exception 'unexpected sync result';
    end if;

    select imported_at into resulting_time
    from public.operations
    where source = 'estoquenow' and external_id = trim(p_external_id);

    update private.estoquenow_sync_items
    set outcome = item_outcome, resulting_imported_at = resulting_time
    where run_id = p_run_id and external_id = trim(p_external_id);
  exception when others then
    safe_error_code := case
      when sqlerrm like 'stale source divergence%'
        then 'cas_stale'
      when sqlerrm like 'historic source divergence%'
        or sqlerrm like 'historic item divergence%'
        then 'historic_blocked'
      when sqlerrm like 'source divergence%'
        or sqlerrm like 'legacy source divergence%'
        or sqlerrm like 'sync item conflict%'
        then 'source_conflict'
      when sqlerrm like 'invalid %'
        then 'validation_failed'
      else 'internal'
    end;
    item_outcome := case
      when safe_error_code in ('cas_stale', 'historic_blocked', 'source_conflict')
        then 'blocked'
      else 'failed'
    end;
    import_result := null;

    update private.estoquenow_sync_items
    set outcome = item_outcome, error_code = safe_error_code
    where run_id = p_run_id and external_id = trim(p_external_id);
  end;

  return pg_catalog.jsonb_build_object(
    'outcome', item_outcome,
    'errorCode', safe_error_code,
    'result', import_result
  );
end
$$;

create function public.finish_estoquenow_sync(
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

  if current_run.lease_expires_at <= v_now then
    update private.estoquenow_sync_runs
    set status = 'abandoned', finished_at = v_now, error_code = 'lease_expired'
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

  select
    count(*)::integer,
    count(*) filter (where outcome = 'applied')::integer,
    count(*) filter (where outcome = 'unchanged')::integer,
    count(*) filter (where outcome = 'blocked')::integer,
    count(*) filter (where outcome in ('failed', 'applying'))::integer
  into counted_attempts, counted_applied, counted_unchanged, counted_blocked, counted_failed
  from private.estoquenow_sync_items
  where run_id = p_run_id;

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
    when counted_blocked > 0 then 'item_blocked'
    else null
  end;
  final_status := case
    when p_error_code is not null and counted_applied + counted_unchanged = 0 then 'failed'
    when p_error_code is not null or counted_failed > 0 or counted_blocked > 0 then 'partial'
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

create function public.get_estoquenow_sync_health(p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  result jsonb;
begin
  if not private.is_manager() then raise exception 'forbidden'; end if;
  if p_limit is null or p_limit not between 1 and 50
    then raise exception 'invalid health limit';
  end if;

  with summaries as (
    select pg_catalog.jsonb_build_object(
      'id', run.id,
      'trigger', run.trigger_kind,
      'mode', run.mode,
      'status', run.status,
      'windowStart', run.window_start,
      'windowEnd', run.window_end,
      'batchLimit', run.batch_limit,
      'startedAt', run.started_at,
      'finishedAt', run.finished_at,
      'fetched', run.fetched_count,
      'valid', run.valid_count,
      'eligible', run.eligible_count,
      'attempted', run.attempted_count,
      'applied', run.applied_count,
      'unchanged', run.unchanged_count,
      'blocked', run.blocked_count,
      'deferred', run.deferred_count,
      'failed', run.failed_count,
      'errorCode', run.error_code
    ) as summary,
    run.trigger_kind,
    run.status,
    run.started_at,
    run.id
    from private.estoquenow_sync_runs run
  ),
  recent as (
    select * from summaries
    order by started_at desc, id desc
    limit p_limit
  )
  select pg_catalog.jsonb_build_object(
    'lastRun', (select summary from recent order by started_at desc limit 1),
    'lastSuccessfulScheduledRun', (
      select summary from summaries
      where trigger_kind = 'scheduled' and status = 'succeeded'
      order by started_at desc, id desc
      limit 1
    ),
    'recentRuns', coalesce(
      (select pg_catalog.jsonb_agg(summary order by started_at desc) from recent),
      '[]'::jsonb
    )
  ) into result;

  return result;
end
$$;

revoke execute on function public.begin_estoquenow_sync(text, text, date, date, integer)
  from public, anon, authenticated, service_role;
revoke execute on function public.record_estoquenow_sync_item(
  uuid, text, text, text, text, text, text, text, timestamptz, text,
  timestamptz, uuid, jsonb, text, text, text, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke execute on function public.finish_estoquenow_sync(
  uuid, integer, integer, integer, integer, integer, text, text
) from public, anon, authenticated, service_role;
revoke execute on function public.get_estoquenow_sync_health(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.begin_estoquenow_sync(text, text, date, date, integer)
  to service_role;
grant execute on function public.record_estoquenow_sync_item(
  uuid, text, text, text, text, text, text, text, timestamptz, text,
  timestamptz, uuid, jsonb, text, text, text, jsonb, timestamptz
) to service_role;
grant execute on function public.finish_estoquenow_sync(
  uuid, integer, integer, integer, integer, integer, text, text
) to service_role;
grant execute on function public.get_estoquenow_sync_health(integer)
  to authenticated;
