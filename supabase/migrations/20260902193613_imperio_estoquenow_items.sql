alter table public.estoquenow_operation_contexts
  add column items jsonb not null default '[]'::jsonb
  check (
    pg_catalog.jsonb_typeof(items) = 'array'
    and pg_catalog.jsonb_array_length(items) <= 1000
  );

create function public.confirm_estoquenow_canary(
  p_external_id text,
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
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_operation public.operations;
  current_context public.estoquenow_operation_contexts;
  normalized_items jsonb;
  result text;
begin
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array'
    then raise exception 'invalid source items';
  end if;
  if pg_catalog.jsonb_array_length(p_items) > 1000
    or exists (
      select 1 from pg_catalog.jsonb_array_elements(p_items) item
      where pg_catalog.jsonb_typeof(item) <> 'object'
        or not item ?& array['id', 'itemId', 'orderId', 'name']
        or item - array['id', 'itemId', 'orderId', 'name'] <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(item->'id') <> 'string'
        or pg_catalog.jsonb_typeof(item->'itemId') <> 'string'
        or pg_catalog.jsonb_typeof(item->'orderId') <> 'string'
        or pg_catalog.jsonb_typeof(item->'name') <> 'string'
        or length(trim(item->>'id')) not between 1 and 200
        or length(trim(item->>'itemId')) not between 1 and 200
        or length(trim(item->>'orderId')) not between 1 and 200
        or length(trim(item->>'name')) not between 1 and 500
    )
    then raise exception 'invalid source items';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', trim(item->>'id'),
        'itemId', trim(item->>'itemId'),
        'orderId', trim(item->>'orderId'),
        'name', trim(item->>'name')
      ) order by trim(item->>'id'), trim(item->>'itemId'), trim(item->>'orderId')
    ),
    '[]'::jsonb
  ) into normalized_items
  from pg_catalog.jsonb_array_elements(p_items) item;
  if (
    select count(*) <> count(distinct item->>'id')
    from pg_catalog.jsonb_array_elements(normalized_items) item
  ) then raise exception 'invalid source items';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('estoquenow:' || trim(p_external_id), 0)
  );
  select * into current_operation
  from public.operations
  where source = 'estoquenow' and external_id = trim(p_external_id)
  for update;

  if found then
    if current_operation.imported_at is distinct from p_expected_imported_at
      then raise exception 'stale source divergence';
    end if;
    select * into current_context
    from public.estoquenow_operation_contexts
    where operation_id = current_operation.id;
    if found
      and current_context.items is distinct from normalized_items
      and (
        current_operation.status <> 'active'
        or exists (
          select 1 from public.operation_events
          where operation_id = current_operation.id
        )
      )
      then raise exception 'historic item divergence';
    end if;
  elsif p_expected_imported_at is not null then
    raise exception 'stale source divergence';
  end if;

  result := public.confirm_estoquenow_canary(
    p_external_id, p_event_name, p_destination, p_scheduled_at, p_notes,
    p_imported_at, p_manager_id, p_context, p_legacy_event_name,
    p_legacy_destination, p_legacy_notes, p_expected_imported_at
  );

  update public.estoquenow_operation_contexts
  set items = normalized_items
  where operation_id = (
    select id from public.operations
    where source = 'estoquenow' and external_id = trim(p_external_id)
  ) and items is distinct from normalized_items;
  if found and result = 'unchanged' then return 'updated'; end if;
  return result;
end
$$;

revoke execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid, jsonb,
  text, text, text, timestamptz
) from service_role;

revoke execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid, jsonb,
  text, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid, jsonb,
  text, text, text, jsonb, timestamptz
) to service_role;
