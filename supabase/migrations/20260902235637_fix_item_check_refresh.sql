create or replace function private.clear_removed_operation_item_checks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.operation_item_checks check_state
  where check_state.operation_id = new.operation_id
    and not exists (
      select 1
      from pg_catalog.jsonb_array_elements(new.items) new_item
      join pg_catalog.jsonb_array_elements(old.items) old_item
        on old_item->>'id' = new_item->>'id'
      where new_item->>'id' = check_state.source_item_id
        and new_item = old_item
    );
  return new;
end
$$;
