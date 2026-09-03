create table private.estoquenow_item_photo_rate_limits (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  window_started_at timestamptz not null default statement_timestamp()
    check (window_started_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)),
  request_count smallint not null default 1 check (request_count between 1 and 61),
  primary key (actor_id, operation_id)
);

alter table private.estoquenow_item_photo_rate_limits enable row level security;

revoke all on table private.estoquenow_item_photo_rate_limits
  from public, anon, authenticated, service_role;

create function public.claim_estoquenow_item_photo_request(p_operation_id uuid)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_window_started_at timestamptz;
  v_request_count smallint;
begin
  if v_actor_id is null
    or p_operation_id is null
    or not private.can_access_operation(p_operation_id)
    or not exists (
      select 1
      from public.operations operation
      where operation.id = p_operation_id
        and operation.source = 'estoquenow'
    )
  then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  insert into private.estoquenow_item_photo_rate_limits as rate (
    actor_id,
    operation_id,
    window_started_at,
    request_count
  ) values (
    v_actor_id,
    p_operation_id,
    v_now,
    1
  )
  on conflict (actor_id, operation_id) do update
  set window_started_at = case
      when rate.window_started_at <= v_now - interval '1 minute' then v_now
      else rate.window_started_at
    end,
    request_count = case
      when rate.window_started_at <= v_now - interval '1 minute' then 1
      else least(rate.request_count + 1, 61)::smallint
    end
  returning rate.window_started_at, rate.request_count
  into v_window_started_at, v_request_count;

  allowed := v_request_count <= 60;
  retry_after_seconds := case
    when allowed then 0
    else least(
      60,
      greatest(
        1,
        pg_catalog.ceil(
          extract(
            epoch from v_window_started_at + interval '1 minute' - pg_catalog.clock_timestamp()
          )
        )::integer
      )
    )
  end;
  return next;
end
$$;

revoke execute on function public.claim_estoquenow_item_photo_request(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_estoquenow_item_photo_request(uuid)
  to authenticated;
