alter table public.profiles
  add column job_title text not null default 'Operação',
  add column availability text not null default 'available'
    check (availability in ('available', 'unavailable')),
  add column must_change_password boolean not null default true;

alter table public.vehicles
  add column vehicle_type text not null default 'Utilitário';
alter table public.vehicles drop constraint vehicles_status_check;
alter table public.vehicles add constraint vehicles_status_check
  check (status in ('available', 'in_use', 'maintenance'));

alter table public.operations drop constraint operations_stage_check;
alter table public.operations add constraint operations_stage_check check (stage in (
  'preparation', 'departure', 'travel', 'arrival', 'assembly',
  'delivery', 'disassembly', 'return', 'inspection'
));
alter table public.operations
  add column status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  add column stage_started_at timestamptz not null default now(),
  add column completed_at timestamptz,
  add column cancel_reason text,
  add column imported_at timestamptz,
  add column waiting_since timestamptz,
  add constraint operations_source_external_id_key unique (source, external_id);

alter table public.operation_events drop constraint operation_events_stage_check;
alter table public.operation_events add constraint operation_events_stage_check check (stage in (
  'preparation', 'departure', 'travel', 'arrival', 'assembly',
  'delivery', 'disassembly', 'return', 'inspection'
));
alter table public.operation_events
  drop constraint operation_events_operation_id_device_action_id_key,
  drop constraint operation_events_operation_id_stage_key,
  add column event_type text not null default 'stage_completed'
    check (event_type in ('stage_completed', 'arrival_blocked')),
  add column duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  add column arrival_access text check (arrival_access in ('released', 'blocked')),
  add column arrival_reason text,
  add column acceptance_name text,
  add constraint operation_events_device_action_id_key unique (device_action_id);

create unique index operation_events_completed_stage_key
  on public.operation_events(operation_id, stage)
  where event_type = 'stage_completed';

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  stage text not null check (stage in (
    'preparation', 'departure', 'travel', 'arrival', 'assembly',
    'delivery', 'disassembly', 'return', 'inspection'
  )),
  type text not null check (type in ('delay', 'damage', 'missing_item', 'access', 'other')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  impact text,
  description text not null check (length(trim(description)) >= 3),
  status text not null default 'open' check (status in ('open', 'handling', 'resolved')),
  actor_id uuid not null constraint incidents_actor_id_fkey references public.profiles(id),
  responsible_id uuid constraint incidents_responsible_id_fkey references public.profiles(id),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  accuracy double precision check (accuracy is null or accuracy >= 0),
  photo_path text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index incidents_operation_id_idx on public.incidents(operation_id);
create index incidents_status_idx on public.incidents(status);

drop function public.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision,
  double precision, double precision, uuid, text, text
);

create function public.confirm_operation_action(
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
  next_stage text;
  event_kind text := 'stage_completed';
  elapsed_seconds integer;
begin
  select * into existing_event
  from public.operation_events
  where device_action_id = p_device_action_id;
  if found then
    if existing_event.operation_id <> p_operation_id then
      raise exception 'device action already belongs to another operation';
    end if;
    return existing_event;
  end if;

  if not private.can_access_operation(p_operation_id) then raise exception 'forbidden'; end if;
  if p_stage not in (
    'preparation', 'departure', 'travel', 'arrival', 'assembly',
    'delivery', 'disassembly', 'return', 'inspection'
  ) then raise exception 'invalid stage'; end if;
  if p_checklist = '{}'::jsonb or exists (
    select 1 from jsonb_each(p_checklist) where value <> 'true'::jsonb
  ) then raise exception 'incomplete checklist'; end if;
  if nullif(trim(p_photo_path), '') is null then raise exception 'photo required'; end if;
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

  elapsed_seconds := greatest(0, floor(extract(epoch from (now() - current_operation.stage_started_at)))::integer);

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

create function public.mark_password_changed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = (select auth.uid())
$$;

alter table public.incidents enable row level security;

revoke all on public.incidents from anon, authenticated;
grant select, insert, update on public.incidents to authenticated;
grant update on public.operations, public.vehicles to authenticated;

create policy incidents_read on public.incidents for select to authenticated
  using (private.can_access_operation(operation_id));
create policy incidents_insert on public.incidents for insert to authenticated
  with check (private.can_access_operation(operation_id) and actor_id = (select auth.uid()));
create policy incidents_update on public.incidents for update to authenticated
  using (private.is_manager() or actor_id = (select auth.uid()))
  with check (private.is_manager() or actor_id = (select auth.uid()));
create policy operations_manager_update on public.operations for update to authenticated
  using (private.is_manager()) with check (private.is_manager());
create policy vehicles_manager_update on public.vehicles for update to authenticated
  using (private.is_manager()) with check (private.is_manager());
create policy operation_evidence_delete on storage.objects for delete to authenticated
  using (bucket_id = 'operation-evidence' and private.can_access_operation(private.storage_operation_id(name)));

revoke execute on function public.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision, double precision,
  double precision, uuid, text, text, text, text, text
) from public;
grant execute on function public.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision, double precision,
  double precision, uuid, text, text, text, text, text
) to authenticated;
revoke execute on function public.mark_password_changed() from public;
grant execute on function public.mark_password_changed() to authenticated;

-- O primeiro usuário criado manualmente no Auth deve trocar a senha no primeiro acesso.
-- Depois, promova-o uma única vez: update public.profiles set role = 'manager' where id = '<uuid>';
