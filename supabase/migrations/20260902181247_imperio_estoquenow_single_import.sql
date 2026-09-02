create or replace function public.confirm_estoquenow_canary(
  p_external_id text,
  p_event_name text,
  p_destination text,
  p_scheduled_at timestamptz,
  p_notes text,
  p_imported_at timestamptz,
  p_manager_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_operation public.operations;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_manager_id and role = 'manager' and not must_change_password
  ) then raise exception 'invalid manager'; end if;
  if nullif(trim(p_external_id), '') is null then raise exception 'invalid external id'; end if;
  if p_scheduled_at is null or not pg_catalog.isfinite(p_scheduled_at)
    or p_imported_at is null or not pg_catalog.isfinite(p_imported_at)
    then raise exception 'invalid source time';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('estoquenow:' || trim(p_external_id), 0)
  );

  select * into current_operation
  from public.operations
  where source = 'estoquenow' and external_id = trim(p_external_id)
  for update;

  if found then
    if current_operation.event_name is distinct from trim(p_event_name)
      or current_operation.destination is distinct from trim(p_destination)
      or current_operation.scheduled_at is distinct from p_scheduled_at
      then raise exception 'source divergence';
    end if;
    update public.operations
    set imported_at = p_imported_at
    where id = current_operation.id;
    return 'unchanged';
  end if;

  insert into public.operations (
    source, external_id, event_name, destination, scheduled_at,
    manager_id, notes, imported_at
  ) values (
    'estoquenow', trim(p_external_id), trim(p_event_name), trim(p_destination),
    p_scheduled_at, p_manager_id, nullif(trim(p_notes), ''), p_imported_at
  );
  return 'new';
end
$$;
