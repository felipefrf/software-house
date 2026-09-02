create function public.set_operation_item_checked(
  p_operation_id uuid,
  p_item_snapshot jsonb,
  p_checked boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_operation public.operations;
  normalized_item jsonb;
  normalized_item_id text;
begin
  if (select auth.uid()) is null
    or pg_catalog.jsonb_typeof(p_item_snapshot) is distinct from 'object'
    or not p_item_snapshot ?& array['id', 'itemId', 'orderId', 'name']
    or p_item_snapshot - array['id', 'itemId', 'orderId', 'name'] <> '{}'::jsonb
    or pg_catalog.jsonb_typeof(p_item_snapshot->'id') <> 'string'
    or pg_catalog.jsonb_typeof(p_item_snapshot->'itemId') <> 'string'
    or pg_catalog.jsonb_typeof(p_item_snapshot->'orderId') <> 'string'
    or pg_catalog.jsonb_typeof(p_item_snapshot->'name') <> 'string'
    or length(trim(p_item_snapshot->>'id')) not between 1 and 200
    or length(trim(p_item_snapshot->>'itemId')) not between 1 and 200
    or length(trim(p_item_snapshot->>'orderId')) not between 1 and 200
    or length(trim(p_item_snapshot->>'name')) not between 1 and 500
    or p_checked is null
    then raise exception 'invalid item check';
  end if;

  normalized_item := pg_catalog.jsonb_build_object(
    'id', trim(p_item_snapshot->>'id'),
    'itemId', trim(p_item_snapshot->>'itemId'),
    'orderId', trim(p_item_snapshot->>'orderId'),
    'name', trim(p_item_snapshot->>'name')
  );
  normalized_item_id := normalized_item->>'id';

  select * into current_operation
  from public.operations
  where id = p_operation_id
  for update;

  if not found
    or current_operation.source <> 'estoquenow'
    or current_operation.status <> 'active'
    or not private.can_access_operation(p_operation_id)
    then raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.estoquenow_operation_contexts context,
      pg_catalog.jsonb_array_elements(context.items) item
    where context.operation_id = p_operation_id
      and item = normalized_item
  ) then raise exception 'source item unavailable';
  end if;

  if p_checked then
    insert into public.operation_item_checks (
      operation_id, source_item_id, checked_by
    ) values (
      p_operation_id, normalized_item_id, (select auth.uid())
    ) on conflict (operation_id, source_item_id) do nothing;
    return case when found then 'checked' else 'unchanged' end;
  end if;

  delete from public.operation_item_checks
  where operation_id = p_operation_id
    and source_item_id = normalized_item_id;
  return case when found then 'unchecked' else 'unchanged' end;
end
$$;

revoke execute on function public.set_operation_item_checked(uuid, text, boolean)
  from authenticated;
revoke execute on function public.set_operation_item_checked(uuid, jsonb, boolean)
  from public, anon, service_role;
grant execute on function public.set_operation_item_checked(uuid, jsonb, boolean)
  to authenticated;
