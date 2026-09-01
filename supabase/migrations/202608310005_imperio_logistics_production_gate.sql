revoke insert, update on table public.operations from authenticated;
revoke update on table public.incidents from authenticated;

create or replace function public.confirm_operation_action(
  p_operation_id uuid,
  p_device_action_id uuid,
  p_stage text,
  p_device_captured_at timestamptz,
  p_checklist jsonb,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision,
  p_responsible_id uuid,
  p_note text,
  p_photo_path text,
  p_arrival_access text default null,
  p_arrival_reason text default null,
  p_acceptance_name text default null
)
returns public.operation_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.operation_events;
  current_operation public.operations;
  required_items text[];
  next_stage text;
  event_kind text := 'stage_completed';
  elapsed_seconds integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_device_action_id::text, 0)
  );

  select * into existing_event
  from public.operation_events
  where device_action_id = p_device_action_id;
  if found then
    if existing_event.operation_id <> p_operation_id
      or existing_event.stage is distinct from p_stage
      or not private.can_access_operation(existing_event.operation_id)
      then raise exception 'device action unavailable';
    end if;
    return existing_event;
  end if;

  if not private.can_access_operation(p_operation_id) then raise exception 'forbidden'; end if;
  if p_stage not in (
    'preparation', 'departure', 'travel', 'arrival', 'assembly',
    'delivery', 'disassembly', 'return', 'inspection'
  ) then raise exception 'invalid stage'; end if;
  if p_device_captured_at is null
    or not pg_catalog.isfinite(p_device_captured_at)
    or p_device_captured_at < pg_catalog.now() - interval '30 days'
    or p_device_captured_at > pg_catalog.now() + interval '5 minutes'
    then raise exception 'invalid device capture time';
  end if;
  if p_latitude is null or not (p_latitude between -90 and 90)
    or p_longitude is null or not (p_longitude between -180 and 180)
    or p_accuracy is null or not (p_accuracy >= 0 and p_accuracy < 'Infinity'::double precision)
    then raise exception 'invalid location';
  end if;

  if jsonb_typeof(p_checklist) is distinct from 'object'
    then raise exception 'invalid checklist';
  end if;
  required_items := private.required_checklist(p_stage);
  if (select count(*) from jsonb_object_keys(p_checklist)) <> cardinality(required_items)
    or exists (
      select 1 from unnest(required_items) item
      where p_checklist -> item is distinct from 'true'::jsonb
    ) then raise exception 'incomplete checklist';
  end if;

  if p_photo_path !~ (
    '^' || p_operation_id::text || '/' || p_device_action_id::text || '\.(jpg|png|webp)$'
  ) then raise exception 'invalid photo path'; end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'operation-evidence' and name = p_photo_path
  ) then raise exception 'photo required'; end if;
  if not exists (select 1 from public.profiles where id = p_responsible_id)
    then raise exception 'invalid responsible';
  end if;

  select * into current_operation
  from public.operations
  where id = p_operation_id
  for update;
  if current_operation.status <> 'active' then raise exception 'operation not active'; end if;
  if current_operation.stage is distinct from p_stage then raise exception 'stage conflict'; end if;
  if p_stage in ('preparation', 'departure')
    and (
      current_operation.team_id is null
      or current_operation.vehicle_id is null
      or current_operation.driver_id is null
    ) then raise exception 'operation assignment incomplete';
  end if;
  if not private.is_manager()
    and p_responsible_id <> (select auth.uid())
    and p_responsible_id is distinct from current_operation.driver_id
    and not exists (
      select 1 from public.team_members
      where team_id = current_operation.team_id and person_id = p_responsible_id
    ) then raise exception 'invalid responsible';
  end if;

  if p_stage = 'arrival' then
    if p_arrival_access not in ('released', 'blocked') then raise exception 'arrival access required'; end if;
    if p_arrival_access = 'blocked' then
      if nullif(trim(p_arrival_reason), '') is null then raise exception 'arrival reason required'; end if;
      event_kind := 'arrival_blocked';
    end if;
  end if;
  if p_stage = 'delivery' and nullif(trim(p_acceptance_name), '') is null
    then raise exception 'acceptance required';
  end if;

  elapsed_seconds := greatest(
    0,
    floor(extract(epoch from (now() - current_operation.stage_started_at)))::integer
  );

  insert into public.operation_events (
    operation_id, device_action_id, stage, event_type, actor_id, responsible_id,
    device_captured_at, checklist, latitude, longitude, accuracy, duration_seconds,
    arrival_access, arrival_reason, acceptance_name, note, photo_path
  ) values (
    p_operation_id, p_device_action_id, p_stage, event_kind, (select auth.uid()), p_responsible_id,
    p_device_captured_at, p_checklist, p_latitude, p_longitude, p_accuracy, elapsed_seconds,
    p_arrival_access, nullif(trim(p_arrival_reason), ''), nullif(trim(p_acceptance_name), ''),
    nullif(trim(p_note), ''), p_photo_path
  ) returning * into existing_event;

  if event_kind = 'arrival_blocked' then
    update public.operations
    set waiting_since = coalesce(waiting_since, now())
    where id = p_operation_id;
    return existing_event;
  end if;

  next_stage := case p_stage
    when 'preparation' then 'departure'
    when 'departure' then 'travel'
    when 'travel' then 'arrival'
    when 'arrival' then 'assembly'
    when 'assembly' then 'delivery'
    when 'delivery' then 'disassembly'
    when 'disassembly' then 'return'
    when 'return' then 'inspection'
    else 'inspection'
  end;

  update public.operations
  set stage = next_stage,
      stage_started_at = now(),
      waiting_since = case when p_stage = 'arrival' then null else waiting_since end,
      status = case when p_stage = 'inspection' then 'completed' else status end,
      completed_at = case when p_stage = 'inspection' then now() else completed_at end
  where id = p_operation_id;
  return existing_event;
end
$$;

revoke execute on function public.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision, double precision,
  double precision, uuid, text, text, text, text, text
) from public;
grant execute on function public.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision, double precision,
  double precision, uuid, text, text, text, text, text
) to authenticated;

create function public.create_manual_operation(
  p_event_name text,
  p_destination text,
  p_scheduled_at timestamptz,
  p_team_id uuid default null,
  p_vehicle_id uuid default null,
  p_driver_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_id uuid;
begin
  if not private.is_manager() then raise exception 'forbidden'; end if;
  if p_scheduled_at is null or not pg_catalog.isfinite(p_scheduled_at)
    then raise exception 'invalid scheduled time';
  end if;
  insert into public.operations (
    source, event_name, destination, scheduled_at, manager_id,
    team_id, vehicle_id, driver_id, notes
  ) values (
    'manual', trim(p_event_name), trim(p_destination), p_scheduled_at,
    (select auth.uid()), p_team_id, p_vehicle_id, p_driver_id, nullif(trim(p_notes), '')
  ) returning id into operation_id;
  return operation_id;
end
$$;

create function public.update_operation_assignment(
  p_id uuid,
  p_destination text,
  p_scheduled_at timestamptz,
  p_team_id uuid default null,
  p_vehicle_id uuid default null,
  p_driver_id uuid default null,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_operation public.operations;
  changed integer;
begin
  if not private.is_manager() then raise exception 'forbidden'; end if;
  if p_scheduled_at is null or not pg_catalog.isfinite(p_scheduled_at)
    then raise exception 'invalid scheduled time';
  end if;
  select * into current_operation
  from public.operations
  where id = p_id and status = 'active'
  for update;
  if not found then return false; end if;
  if current_operation.source = 'estoquenow'
    and (
      current_operation.destination is distinct from trim(p_destination)
      or current_operation.scheduled_at is distinct from p_scheduled_at
    ) then raise exception 'source fields immutable';
  end if;
  update public.operations
  set destination = trim(p_destination),
      scheduled_at = p_scheduled_at,
      team_id = p_team_id,
      vehicle_id = p_vehicle_id,
      driver_id = p_driver_id,
      notes = nullif(trim(p_notes), '')
  where id = current_operation.id;
  get diagnostics changed = row_count;
  return changed = 1;
end
$$;

create function public.cancel_operation(p_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not private.is_manager() then raise exception 'forbidden'; end if;
  if nullif(trim(p_reason), '') is null or length(trim(p_reason)) < 3
    then raise exception 'invalid reason';
  end if;
  update public.operations
  set status = 'cancelled', cancel_reason = trim(p_reason)
  where id = p_id and status = 'active';
  get diagnostics changed = row_count;
  return changed = 1;
end
$$;

create function public.confirm_estoquenow_canary(
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

create function public.set_incident_status(p_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not private.is_manager() then raise exception 'forbidden'; end if;
  if p_status not in ('open', 'handling', 'resolved')
    then raise exception 'invalid status';
  end if;
  update public.incidents
  set status = p_status,
      resolved_at = case when p_status = 'resolved' then now() else null end
  where id = p_id;
  get diagnostics changed = row_count;
  return changed = 1;
end
$$;

revoke execute on function public.create_manual_operation(
  text, text, timestamptz, uuid, uuid, uuid, text
), public.update_operation_assignment(
  uuid, text, timestamptz, uuid, uuid, uuid, text
), public.cancel_operation(uuid, text), public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid
), public.set_incident_status(uuid, text) from public;

grant execute on function public.create_manual_operation(
  text, text, timestamptz, uuid, uuid, uuid, text
), public.update_operation_assignment(
  uuid, text, timestamptz, uuid, uuid, uuid, text
), public.cancel_operation(uuid, text), public.set_incident_status(uuid, text) to authenticated;

revoke execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid
) from authenticated;
grant execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid
) to service_role;
