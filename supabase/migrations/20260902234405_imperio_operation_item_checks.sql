create table public.operation_item_checks (
  operation_id uuid not null references public.estoquenow_operation_contexts(operation_id) on delete cascade,
  source_item_id text not null check (length(trim(source_item_id)) between 1 and 200),
  checked_by uuid not null references public.profiles(id) on delete restrict,
  checked_at timestamptz not null default statement_timestamp()
    check (checked_at not in ('infinity'::timestamptz, '-infinity'::timestamptz)),
  primary key (operation_id, source_item_id)
);

create index operation_item_checks_checked_by_idx
  on public.operation_item_checks(checked_by);

alter table public.operation_item_checks enable row level security;

revoke all on table public.operation_item_checks
  from public, anon, authenticated, service_role;
grant select on table public.operation_item_checks to authenticated;

create policy operation_item_checks_read
on public.operation_item_checks for select to authenticated
using ((select private.can_access_operation(operation_id)));

create function public.set_operation_item_checked(
  p_operation_id uuid,
  p_source_item_id text,
  p_checked boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_operation public.operations;
  normalized_item_id text := trim(p_source_item_id);
begin
  if (select auth.uid()) is null
    or length(normalized_item_id) not between 1 and 200
    or p_checked is null
    then raise exception 'invalid item check';
  end if;

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
      and item->>'id' = normalized_item_id
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
  from public, anon, service_role;
grant execute on function public.set_operation_item_checked(uuid, text, boolean)
  to authenticated;

create function private.clear_removed_operation_item_checks()
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
      from pg_catalog.jsonb_array_elements(new.items) item
      where item->>'id' = check_state.source_item_id
    );
  return new;
end
$$;

revoke execute on function private.clear_removed_operation_item_checks()
  from public, anon, authenticated, service_role;

create trigger clear_removed_operation_item_checks
after update of items on public.estoquenow_operation_contexts
for each row execute function private.clear_removed_operation_item_checks();
