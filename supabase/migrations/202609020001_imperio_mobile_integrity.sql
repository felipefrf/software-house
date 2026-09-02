alter function public.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision, double precision,
  double precision, uuid, text, text, text, text, text
) set schema private;

revoke all on function private.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision, double precision,
  double precision, uuid, text, text, text, text, text
) from public, anon, authenticated;

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
begin
  select * into existing_event
  from public.operation_events
  where device_action_id = p_device_action_id;

  if found and existing_event.actor_id is distinct from (select auth.uid()) then
    raise exception 'device action unavailable';
  end if;

  if not found and not exists (
    select 1 from storage.objects
    where bucket_id = 'operation-evidence'
      and name = p_photo_path
      and owner_id = (select auth.uid())::text
  ) then
    raise exception 'photo owner mismatch';
  end if;

  return private.confirm_operation_action(
    p_operation_id, p_device_action_id, p_stage, p_device_captured_at,
    p_checklist, p_latitude, p_longitude, p_accuracy, p_responsible_id,
    p_note, p_photo_path, p_arrival_access, p_arrival_reason, p_acceptance_name
  );
end
$$;

revoke all on function public.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision, double precision,
  double precision, uuid, text, text, text, text, text
) from public, anon;
grant execute on function public.confirm_operation_action(
  uuid, uuid, text, timestamptz, jsonb, double precision, double precision,
  double precision, uuid, text, text, text, text, text
) to authenticated;

create function public.create_operation_incident(
  p_incident_id uuid,
  p_operation_id uuid,
  p_stage text,
  p_type text,
  p_severity text,
  p_impact text,
  p_description text,
  p_responsible_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision,
  p_photo_path text
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_incident public.incidents;
  current_operation public.operations;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_incident_id::text, 0)
  );

  select * into existing_incident
  from public.incidents
  where id = p_incident_id;
  if found then
    if existing_incident.operation_id is distinct from p_operation_id
      or existing_incident.actor_id is distinct from (select auth.uid())
      or not private.can_access_operation(existing_incident.operation_id)
      then raise exception 'incident unavailable';
    end if;
    if existing_incident.stage is distinct from p_stage
      or existing_incident.type is distinct from p_type
      or existing_incident.severity is distinct from p_severity
      or existing_incident.impact is distinct from nullif(pg_catalog.btrim(p_impact), '')
      or existing_incident.description is distinct from pg_catalog.btrim(p_description)
      or existing_incident.responsible_id is distinct from p_responsible_id
      or existing_incident.latitude is distinct from p_latitude
      or existing_incident.longitude is distinct from p_longitude
      or existing_incident.accuracy is distinct from p_accuracy
      or existing_incident.photo_path is distinct from p_photo_path
      then raise exception 'incident divergence';
    end if;
    return existing_incident;
  end if;

  if not private.can_access_operation(p_operation_id) then raise exception 'forbidden'; end if;
  select * into current_operation from public.operations where id = p_operation_id;
  if current_operation.status is distinct from 'active' then raise exception 'operation not active'; end if;
  if current_operation.stage is distinct from p_stage then raise exception 'stage conflict'; end if;
  if p_type is null or p_type not in ('delay', 'damage', 'missing_item', 'access', 'other')
    then raise exception 'invalid incident type';
  end if;
  if p_severity is null or p_severity not in ('low', 'medium', 'high')
    then raise exception 'invalid incident severity';
  end if;
  if nullif(pg_catalog.btrim(p_description), '') is null
    or pg_catalog.length(pg_catalog.btrim(p_description)) < 3
    or pg_catalog.length(pg_catalog.btrim(p_description)) > 4000
    then raise exception 'invalid incident description';
  end if;
  if pg_catalog.length(coalesce(p_impact, '')) > 1000
    then raise exception 'invalid incident impact';
  end if;

  if (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is null) <> (p_accuracy is null)
    or (
      p_latitude is not null
      and (
        not (p_latitude between -90 and 90)
        or not (p_longitude between -180 and 180)
        or not (p_accuracy >= 0 and p_accuracy < 'Infinity'::double precision)
      )
    ) then raise exception 'invalid location';
  end if;

  if p_responsible_id is not null then
    if not exists (select 1 from public.profiles where id = p_responsible_id)
      then raise exception 'invalid responsible';
    end if;
    if not private.is_manager()
      and p_responsible_id <> (select auth.uid())
      and p_responsible_id is distinct from current_operation.driver_id
      and not exists (
        select 1 from public.team_members
        where team_id = current_operation.team_id and person_id = p_responsible_id
      ) then raise exception 'invalid responsible';
    end if;
  end if;

  if p_photo_path is not null and p_photo_path !~ (
    '^' || p_operation_id::text || '/incident-' || p_incident_id::text || '\.(jpg|png|webp)$'
  ) then raise exception 'invalid photo path';
  end if;
  if p_type in ('damage', 'missing_item') and p_photo_path is null
    then raise exception 'photo required';
  end if;
  if p_photo_path is not null and not exists (
    select 1 from storage.objects
    where bucket_id = 'operation-evidence'
      and name = p_photo_path
      and owner_id = (select auth.uid())::text
  ) then raise exception 'photo owner mismatch';
  end if;

  insert into public.incidents (
    id, operation_id, stage, type, severity, impact, description, actor_id,
    responsible_id, latitude, longitude, accuracy, photo_path
  ) values (
    p_incident_id, p_operation_id, p_stage, p_type, p_severity,
    nullif(pg_catalog.btrim(p_impact), ''), pg_catalog.btrim(p_description),
    (select auth.uid()), p_responsible_id, p_latitude, p_longitude, p_accuracy,
    p_photo_path
  ) returning * into existing_incident;
  return existing_incident;
end
$$;

revoke all on function public.create_operation_incident(
  uuid, uuid, text, text, text, text, text, uuid,
  double precision, double precision, double precision, text
) from public, anon;
grant execute on function public.create_operation_incident(
  uuid, uuid, text, text, text, text, text, uuid,
  double precision, double precision, double precision, text
) to authenticated;
