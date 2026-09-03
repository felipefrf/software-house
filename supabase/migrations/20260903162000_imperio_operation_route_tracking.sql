create table public.operation_tracking_sessions (
  id uuid primary key,
  operation_id uuid not null references public.operations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  terms_version text not null check (length(terms_version) between 1 and 64),
  consented_at timestamptz not null default now(),
  device_consented_at timestamptz not null,
  stopped_at timestamptz,
  device_stopped_at timestamptz,
  stop_reason text check (
    stop_reason is null or stop_reason in (
      'returned', 'completed', 'cancelled', 'sign_out',
      'departure_failed', 'operation_ended'
    )
  ),
  created_at timestamptz not null default now(),
  check (pg_catalog.isfinite(consented_at)),
  check (pg_catalog.isfinite(device_consented_at)),
  check (stopped_at is null or pg_catalog.isfinite(stopped_at)),
  check (device_stopped_at is null or pg_catalog.isfinite(device_stopped_at)),
  check ((stopped_at is null) = (device_stopped_at is null)),
  check ((stopped_at is null) = (stop_reason is null))
);

create unique index operation_tracking_sessions_one_active_actor
  on public.operation_tracking_sessions(actor_id)
  where stopped_at is null;

create index operation_tracking_sessions_operation_idx
  on public.operation_tracking_sessions(operation_id, consented_at desc);

create table public.operation_route_points (
  id uuid primary key,
  session_id uuid not null references public.operation_tracking_sessions(id) on delete cascade,
  operation_id uuid not null references public.operations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  device_captured_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision not null,
  speed double precision,
  heading double precision,
  mocked boolean not null default false,
  check (pg_catalog.isfinite(device_captured_at)),
  check (pg_catalog.isfinite(server_received_at)),
  check (latitude between -90 and 90),
  check (longitude between -180 and 180),
  check (accuracy >= 0 and accuracy <= 1000),
  check (speed is null or (speed >= -1 and speed <= 150)),
  check (heading is null or heading = -1 or (heading >= 0 and heading <= 360))
);

create index operation_route_points_operation_time_idx
  on public.operation_route_points(operation_id, device_captured_at);

alter table public.operation_tracking_sessions enable row level security;
alter table public.operation_route_points enable row level security;

create policy operation_tracking_sessions_select on public.operation_tracking_sessions
for select to authenticated
using (private.can_access_operation(operation_id));

create policy operation_route_points_select on public.operation_route_points
for select to authenticated
using (private.can_access_operation(operation_id));

revoke all on public.operation_tracking_sessions, public.operation_route_points
  from public, anon, authenticated, service_role;
grant select on public.operation_tracking_sessions, public.operation_route_points
  to authenticated;
grant select on public.operation_tracking_sessions, public.operation_route_points
  to service_role;

create function public.start_operation_tracking(
  p_session_id uuid,
  p_operation_id uuid,
  p_terms_version text,
  p_device_consented_at timestamptz
)
returns public.operation_tracking_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid := (select auth.uid());
  current_operation public.operations;
  existing_session public.operation_tracking_sessions;
  active_session public.operation_tracking_sessions;
begin
  if current_actor is null then raise exception 'authentication required'; end if;
  if p_session_id is null or p_operation_id is null then raise exception 'invalid tracking session'; end if;
  if p_terms_version is distinct from 'imperio-route-tracking-v1'
    then raise exception 'unsupported tracking terms';
  end if;
  if p_device_consented_at is null
    or not pg_catalog.isfinite(p_device_consented_at)
    or p_device_consented_at < pg_catalog.now() - interval '10 minutes'
    or p_device_consented_at > pg_catalog.now() + interval '5 minutes'
    then raise exception 'invalid consent time';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_actor::text, 0)
  );

  select * into existing_session
  from public.operation_tracking_sessions
  where id = p_session_id;
  if found then
    if existing_session.actor_id is distinct from current_actor
      or existing_session.operation_id is distinct from p_operation_id
      or existing_session.terms_version is distinct from p_terms_version
      or existing_session.device_consented_at is distinct from p_device_consented_at
      then raise exception 'tracking session divergence';
    end if;
    return existing_session;
  end if;

  if not private.can_access_operation(p_operation_id) then raise exception 'forbidden'; end if;
  select * into current_operation
  from public.operations
  where id = p_operation_id
  for share;
  if not found or current_operation.status is distinct from 'active'
    then raise exception 'operation not active';
  end if;
  if current_operation.stage is distinct from 'departure'
    then raise exception 'tracking starts only at departure';
  end if;

  update public.operation_tracking_sessions session
  set stopped_at = pg_catalog.now(),
      device_stopped_at = pg_catalog.now(),
      stop_reason = 'operation_ended'
  from public.operations operation
  where session.actor_id = current_actor
    and session.stopped_at is null
    and operation.id = session.operation_id
    and (operation.status is distinct from 'active' or operation.stage = 'inspection');

  select * into active_session
  from public.operation_tracking_sessions
  where actor_id = current_actor and stopped_at is null;
  if found then
    if active_session.operation_id is distinct from p_operation_id
      then raise exception 'another operation is being tracked';
    end if;
    update public.operation_tracking_sessions
    set stopped_at = pg_catalog.now(),
        device_stopped_at = pg_catalog.now(),
        stop_reason = 'operation_ended'
    where id = active_session.id;
  end if;

  insert into public.operation_tracking_sessions (
    id, operation_id, actor_id, terms_version, device_consented_at
  ) values (
    p_session_id, p_operation_id, current_actor, p_terms_version,
    p_device_consented_at
  ) returning * into existing_session;
  return existing_session;
end
$$;

create function public.append_operation_route_points(
  p_session_id uuid,
  p_points jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid := (select auth.uid());
  current_session public.operation_tracking_sessions;
  current_operation public.operations;
  existing_point public.operation_route_points;
  point jsonb;
  point_id uuid;
  point_captured_at timestamptz;
  point_latitude double precision;
  point_longitude double precision;
  point_accuracy double precision;
  point_speed double precision;
  point_heading double precision;
  point_mocked boolean;
  accepted_ids jsonb := '[]'::jsonb;
  should_stop boolean := false;
begin
  if current_actor is null then raise exception 'authentication required'; end if;
  if p_session_id is null then raise exception 'invalid tracking session'; end if;
  if jsonb_typeof(p_points) is distinct from 'array'
    or jsonb_array_length(p_points) < 1
    or jsonb_array_length(p_points) > 100
    then raise exception 'invalid route point batch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text, 0)
  );
  select * into current_session
  from public.operation_tracking_sessions
  where id = p_session_id;
  if not found or current_session.actor_id is distinct from current_actor
    then raise exception 'tracking session unavailable';
  end if;
  select * into current_operation
  from public.operations
  where id = current_session.operation_id;
  if found and current_session.stopped_at is null
    and (current_operation.status is distinct from 'active' or current_operation.stage = 'inspection')
  then
    update public.operation_tracking_sessions
    set stopped_at = pg_catalog.now(),
        device_stopped_at = pg_catalog.now(),
        stop_reason = case
          when current_operation.status = 'cancelled' then 'cancelled'
          when current_operation.status = 'completed' then 'completed'
          else 'operation_ended'
        end
    where id = current_session.id
    returning * into current_session;
  end if;
  should_stop := current_session.stopped_at is not null;

  for point in select value from jsonb_array_elements(p_points)
  loop
    if jsonb_typeof(point) is distinct from 'object'
      or point - array[
        'id', 'captured_at', 'latitude', 'longitude', 'accuracy',
        'speed', 'heading', 'mocked'
      ] <> '{}'::jsonb
      then raise exception 'invalid route point';
    end if;
    begin
      point_id := (point->>'id')::uuid;
      point_captured_at := (point->>'captured_at')::timestamptz;
      point_latitude := (point->>'latitude')::double precision;
      point_longitude := (point->>'longitude')::double precision;
      point_accuracy := (point->>'accuracy')::double precision;
      point_speed := nullif(point->>'speed', '')::double precision;
      point_heading := nullif(point->>'heading', '')::double precision;
      point_mocked := coalesce((point->>'mocked')::boolean, false);
    exception when others then
      raise exception 'invalid route point';
    end;

    if point_id is null
      or point_captured_at is null
      or not pg_catalog.isfinite(point_captured_at)
      or point_captured_at < current_session.device_consented_at - interval '1 minute'
      or point_captured_at > coalesce(
        current_session.device_stopped_at,
        pg_catalog.now() + interval '5 minutes'
      )
      or point_latitude is null or not (point_latitude between -90 and 90)
      or point_longitude is null or not (point_longitude between -180 and 180)
      or point_accuracy is null or not (point_accuracy >= 0 and point_accuracy <= 1000)
      or (point_speed is not null and not (point_speed >= -1 and point_speed <= 150))
      or (point_heading is not null and not (
        point_heading = -1 or point_heading between 0 and 360
      ))
      then raise exception 'invalid route point';
    end if;

    insert into public.operation_route_points (
      id, session_id, operation_id, actor_id, device_captured_at,
      latitude, longitude, accuracy, speed, heading, mocked
    ) values (
      point_id, current_session.id, current_session.operation_id, current_actor,
      point_captured_at, point_latitude, point_longitude, point_accuracy,
      point_speed, point_heading, point_mocked
    ) on conflict (id) do nothing;

    select * into existing_point
    from public.operation_route_points
    where id = point_id;
    if existing_point.session_id is distinct from current_session.id
      or existing_point.operation_id is distinct from current_session.operation_id
      or existing_point.actor_id is distinct from current_actor
      or existing_point.device_captured_at is distinct from point_captured_at
      or existing_point.latitude is distinct from point_latitude
      or existing_point.longitude is distinct from point_longitude
      or existing_point.accuracy is distinct from point_accuracy
      or existing_point.speed is distinct from point_speed
      or existing_point.heading is distinct from point_heading
      or existing_point.mocked is distinct from point_mocked
      then raise exception 'route point divergence';
    end if;
    accepted_ids := accepted_ids || pg_catalog.to_jsonb(point_id::text);
  end loop;

  return pg_catalog.jsonb_build_object(
    'accepted_ids', accepted_ids,
    'should_stop', should_stop,
    'stopped_at', current_session.device_stopped_at,
    'stop_reason', current_session.stop_reason
  );
end
$$;

create function public.stop_operation_tracking(
  p_session_id uuid,
  p_device_stopped_at timestamptz,
  p_reason text
)
returns public.operation_tracking_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid := (select auth.uid());
  current_session public.operation_tracking_sessions;
begin
  if current_actor is null then raise exception 'authentication required'; end if;
  if p_session_id is null then raise exception 'invalid tracking session'; end if;
  if p_reason is null or p_reason not in (
    'returned', 'completed', 'cancelled', 'sign_out',
    'departure_failed', 'operation_ended'
  ) then raise exception 'invalid tracking stop reason'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text, 0)
  );
  select * into current_session
  from public.operation_tracking_sessions
  where id = p_session_id;
  if not found or current_session.actor_id is distinct from current_actor
    then raise exception 'tracking session unavailable';
  end if;
  if p_device_stopped_at is null
    or not pg_catalog.isfinite(p_device_stopped_at)
    or p_device_stopped_at < current_session.device_consented_at
    or p_device_stopped_at > pg_catalog.now() + interval '5 minutes'
    then raise exception 'invalid tracking stop time';
  end if;

  if current_session.stopped_at is not null then
    return current_session;
  end if;
  update public.operation_tracking_sessions
  set stopped_at = pg_catalog.now(),
      device_stopped_at = p_device_stopped_at,
      stop_reason = p_reason
  where id = p_session_id
  returning * into current_session;
  return current_session;
end
$$;

revoke all on function public.start_operation_tracking(uuid, uuid, text, timestamptz)
  from public, anon, service_role;
revoke all on function public.append_operation_route_points(uuid, jsonb)
  from public, anon, service_role;
revoke all on function public.stop_operation_tracking(uuid, timestamptz, text)
  from public, anon, service_role;
grant execute on function public.start_operation_tracking(uuid, uuid, text, timestamptz)
  to authenticated;
grant execute on function public.append_operation_route_points(uuid, jsonb)
  to authenticated;
grant execute on function public.stop_operation_tracking(uuid, timestamptz, text)
  to authenticated;
