alter table private.estoquenow_sync_runs
  add column detail_failed_count integer not null default 0
    check (detail_failed_count >= 0),
  add column quarantined_count integer not null default 0
    check (quarantined_count >= 0);

create table private.estoquenow_sync_detail_failures (
  run_id uuid not null references private.estoquenow_sync_runs(id) on delete cascade,
  external_id text not null check (length(trim(external_id)) between 1 and 200),
  source_version text check (source_version is null or length(source_version) <= 200),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  error_code text not null check (
    error_code in ('source_item_changed', 'detail_invalid', 'detail_unavailable')
  ),
  quarantined boolean not null,
  retry_after timestamptz,
  recorded_at timestamptz not null default statement_timestamp()
    check (recorded_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)),
  primary key (run_id, external_id),
  check (
    (not quarantined and retry_after is null)
    or (
      quarantined
      and source_version is not null
      and retry_after is not null
      and retry_after not in ('infinity'::timestamptz, '-infinity'::timestamptz)
    )
  )
);

create index estoquenow_sync_detail_failures_quarantine_idx
  on private.estoquenow_sync_detail_failures (external_id, source_version, source_hash)
  where quarantined;

alter table private.estoquenow_sync_detail_failures enable row level security;
revoke all on table private.estoquenow_sync_detail_failures
  from public, anon, authenticated, service_role;

create function public.record_estoquenow_sync_detail_failure(
  p_run_id uuid,
  p_external_id text,
  p_source_version text,
  p_source_hash text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run private.estoquenow_sync_runs;
  current_failure private.estoquenow_sync_detail_failures;
  should_quarantine boolean;
begin
  if p_run_id is null
    or nullif(pg_catalog.btrim(p_external_id), '') is null
    or pg_catalog.length(pg_catalog.btrim(p_external_id)) > 200
    or (p_source_version is not null and pg_catalog.length(pg_catalog.btrim(p_source_version)) > 200)
    or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$'
    or p_error_code is null
    or p_error_code not in ('source_item_changed', 'detail_invalid', 'detail_unavailable')
    then raise exception 'invalid sync detail failure';
  end if;

  select * into current_run
  from private.estoquenow_sync_runs
  where id = p_run_id
  for update;

  if not found or current_run.mode <> 'apply' or current_run.status <> 'running'
    then raise exception 'sync run unavailable';
  end if;
  if current_run.lease_expires_at <= statement_timestamp()
    then raise exception 'sync run lease expired';
  end if;
  should_quarantine := p_error_code in ('source_item_changed', 'detail_invalid')
    and nullif(pg_catalog.btrim(p_source_version), '') is not null;

  select * into current_failure
  from private.estoquenow_sync_detail_failures
  where run_id = p_run_id and external_id = pg_catalog.btrim(p_external_id);

  if found then
    if current_failure.source_version is distinct from nullif(pg_catalog.btrim(p_source_version), '')
      or current_failure.source_hash is distinct from p_source_hash
      or current_failure.error_code is distinct from p_error_code
      or current_failure.quarantined is distinct from should_quarantine
      then raise exception 'sync detail failure conflict';
    end if;
  else
    if (
      select count(*)
      from private.estoquenow_sync_detail_failures
      where run_id = p_run_id
    ) >= 10 then raise exception 'sync detail failure limit';
    end if;
    insert into private.estoquenow_sync_detail_failures (
      run_id, external_id, source_version, source_hash, error_code, quarantined,
      retry_after
    ) values (
      p_run_id,
      pg_catalog.btrim(p_external_id),
      nullif(pg_catalog.btrim(p_source_version), ''),
      p_source_hash,
      p_error_code,
      should_quarantine,
      case when should_quarantine then statement_timestamp() + interval '6 hours' end
    ) returning * into current_failure;
  end if;

  return pg_catalog.jsonb_build_object(
    'externalId', current_failure.external_id,
    'errorCode', current_failure.error_code,
    'quarantined', current_failure.quarantined
  );
end
$$;

create function public.get_estoquenow_sync_quarantine(p_candidates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  result jsonb;
begin
  if p_candidates is null
    or pg_catalog.jsonb_typeof(p_candidates) <> 'array'
    or pg_catalog.jsonb_array_length(p_candidates) > 100
    or exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_candidates) candidate
      where pg_catalog.jsonb_typeof(candidate) <> 'object'
        or nullif(pg_catalog.btrim(candidate->>'externalId'), '') is null
        or pg_catalog.length(pg_catalog.btrim(candidate->>'externalId')) > 200
        or (
          candidate->>'sourceVersion' is not null
          and pg_catalog.length(pg_catalog.btrim(candidate->>'sourceVersion')) > 200
        )
        or coalesce(candidate->>'sourceHash', '') !~ '^[0-9a-f]{64}$'
    )
    then raise exception 'invalid quarantine candidates';
  end if;

  with requested as (
    select distinct
      pg_catalog.btrim(candidate->>'externalId') as external_id,
      nullif(pg_catalog.btrim(candidate->>'sourceVersion'), '') as source_version,
      candidate->>'sourceHash' as source_hash
    from pg_catalog.jsonb_array_elements(p_candidates) candidate
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('externalId', requested.external_id)
      order by requested.external_id
    ),
    '[]'::jsonb
  ) into result
  from requested
  where requested.source_version is not null
    and exists (
      select 1
      from private.estoquenow_sync_detail_failures failure
      where failure.external_id = requested.external_id
        and failure.source_version = requested.source_version
        and failure.source_hash = requested.source_hash
        and failure.quarantined
        and failure.retry_after > statement_timestamp()
    );

  return result;
end
$$;

create function public.finish_estoquenow_sync_v2(
  p_run_id uuid,
  p_fetched_count integer,
  p_valid_count integer,
  p_eligible_count integer,
  p_blocked_count integer,
  p_quarantined_count integer,
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
  counted_detail_failed integer;
  final_status text;
  final_error_code text;
begin
  if p_run_id is null
    or p_fetched_count is null or p_fetched_count < 0
    or p_valid_count is null or p_valid_count not between 0 and p_fetched_count
    or p_eligible_count is null or p_eligible_count not between 0 and p_valid_count
    or p_blocked_count is null or p_blocked_count not between 0 and p_valid_count
    or p_quarantined_count is null or p_quarantined_count not between 0 and p_valid_count
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
      'quarantined', current_run.quarantined_count,
      'detailFailed', current_run.detail_failed_count,
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

  select count(*)::integer into counted_detail_failed
  from private.estoquenow_sync_detail_failures
  where run_id = p_run_id;

  if current_run.lease_expires_at <= v_now then
    update private.estoquenow_sync_runs
    set status = 'abandoned',
      finished_at = v_now,
      fetched_count = greatest(p_fetched_count, p_valid_count),
      valid_count = greatest(p_valid_count, p_eligible_count, p_blocked_count),
      eligible_count = greatest(p_eligible_count, counted_attempts + counted_detail_failed),
      attempted_count = counted_attempts,
      applied_count = counted_applied,
      unchanged_count = counted_unchanged,
      blocked_count = p_blocked_count + counted_blocked,
      quarantined_count = p_quarantined_count,
      detail_failed_count = counted_detail_failed,
      deferred_count = p_deferred_count,
      failed_count = counted_failed,
      contract_hash = p_contract_hash,
      error_code = 'lease_expired'
    where id = p_run_id
    returning * into current_run;
  else
    if counted_attempts <> current_run.attempted_count
      or counted_attempts > current_run.batch_limit
      or p_eligible_count <> counted_attempts + counted_detail_failed + p_deferred_count
      or (current_run.mode = 'observe' and counted_attempts + counted_detail_failed <> 0)
      or p_blocked_count + counted_blocked > p_valid_count
      then raise exception 'sync summary mismatch';
    end if;

    final_error_code := case
      when p_error_code is not null then p_error_code
      when counted_detail_failed > 0 or p_quarantined_count > 0 then 'invalid_source'
      when counted_failed > 0 then 'item_failure'
      when p_blocked_count + counted_blocked > 0 then 'item_blocked'
      else null
    end;
    final_status := case
      when counted_applied + counted_unchanged = 0
        and counted_attempts + counted_detail_failed > 0
        then 'failed'
      when p_error_code is not null
        or counted_detail_failed > 0
        or p_quarantined_count > 0
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
      attempted_count = counted_attempts,
      applied_count = counted_applied,
      unchanged_count = counted_unchanged,
      blocked_count = p_blocked_count + counted_blocked,
      quarantined_count = p_quarantined_count,
      detail_failed_count = counted_detail_failed,
      deferred_count = p_deferred_count,
      failed_count = counted_failed,
      contract_hash = p_contract_hash,
      error_code = final_error_code
    where id = p_run_id
    returning * into current_run;
  end if;

  return pg_catalog.jsonb_build_object(
    'runId', current_run.id,
    'status', current_run.status,
    'attempted', current_run.attempted_count,
    'applied', current_run.applied_count,
    'unchanged', current_run.unchanged_count,
    'blocked', current_run.blocked_count,
    'quarantined', current_run.quarantined_count,
    'detailFailed', current_run.detail_failed_count,
    'deferred', current_run.deferred_count,
    'failed', current_run.failed_count,
    'errorCode', current_run.error_code
  );
end
$$;

create or replace function public.get_estoquenow_sync_health(p_limit integer default 10)
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
      'quarantined', run.quarantined_count,
      'detailFailed', run.detail_failed_count,
      'deferred', run.deferred_count,
      'failed', run.failed_count,
      'errorCode', run.error_code
    ) as summary,
    run.trigger_kind,
    run.status,
    run.started_at,
    run.id,
    run.applied_count,
    run.unchanged_count
    from private.estoquenow_sync_runs run
  ), recent as (
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
    'lastAppliedScheduledRun', (
      select summary from summaries
      where trigger_kind = 'scheduled'
        and status in ('succeeded', 'partial')
        and applied_count + unchanged_count > 0
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

revoke execute on function public.record_estoquenow_sync_detail_failure(
  uuid, text, text, text, text
) from public, anon, authenticated, service_role;
revoke execute on function public.get_estoquenow_sync_quarantine(jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.finish_estoquenow_sync_v2(
  uuid, integer, integer, integer, integer, integer, integer, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.record_estoquenow_sync_detail_failure(
  uuid, text, text, text, text
) to service_role;
grant execute on function public.get_estoquenow_sync_quarantine(jsonb)
  to service_role;
grant execute on function public.finish_estoquenow_sync_v2(
  uuid, integer, integer, integer, integer, integer, integer, text, text
) to service_role;
