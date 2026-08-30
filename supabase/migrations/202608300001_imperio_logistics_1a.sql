create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 1),
  role text not null default 'worker' check (role in ('manager', 'worker')),
  phone text,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 1),
  leader_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  person_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, person_id)
);

create index team_members_person_id_idx on public.team_members(person_id);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 1),
  plate text not null unique check (length(trim(plate)) > 2),
  capacity_label text,
  status text not null default 'available' check (status in ('available', 'maintenance')),
  created_at timestamptz not null default now()
);

create table public.operations (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual' check (source in ('manual', 'estoquenow')),
  external_id text,
  event_name text not null check (length(trim(event_name)) > 1),
  destination text not null check (length(trim(destination)) > 4),
  scheduled_at timestamptz not null,
  stage text not null default 'preparation' check (stage in ('preparation', 'departure')),
  manager_id uuid not null references public.profiles(id),
  team_id uuid references public.teams(id),
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index operations_manager_id_idx on public.operations(manager_id);
create index operations_team_id_idx on public.operations(team_id);
create index operations_driver_id_idx on public.operations(driver_id);

create table public.operation_events (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  device_action_id uuid not null,
  stage text not null check (stage in ('preparation', 'departure')),
  state text not null default 'confirmed' check (state = 'confirmed'),
  actor_id uuid not null constraint operation_events_actor_id_fkey references public.profiles(id),
  responsible_id uuid not null constraint operation_events_responsible_id_fkey references public.profiles(id),
  device_captured_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  checklist jsonb not null check (jsonb_typeof(checklist) = 'object'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision not null check (accuracy >= 0),
  note text,
  photo_path text not null,
  unique (operation_id, device_action_id),
  unique (operation_id, stage)
);

create index operation_events_operation_id_idx on public.operation_events(operation_id);

create function private.is_manager()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  )
$$;

create function private.can_access_operation(target_operation_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.is_manager() or exists (
    select 1
    from public.operations operation
    where operation.id = target_operation_id
      and (
        operation.manager_id = (select auth.uid())
        or operation.driver_id = (select auth.uid())
        or exists (
          select 1 from public.team_members member
          where member.team_id = operation.team_id
            and member.person_id = (select auth.uid())
        )
      )
  )
$$;

create function private.storage_operation_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email), 'worker');
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke execute on function public.handle_new_user() from public;

create function public.create_team(p_name text, p_leader_id uuid, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_team_id uuid;
begin
  if not private.is_manager() then raise exception 'forbidden'; end if;
  insert into public.teams (name, leader_id) values (trim(p_name), p_leader_id) returning id into new_team_id;
  insert into public.team_members (team_id, person_id)
  select new_team_id, member_id
  from (
    select distinct unnest(array_append(coalesce(p_member_ids, array[]::uuid[]), p_leader_id)) as member_id
  ) members;
  return new_team_id;
end
$$;

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
  p_photo_path text
)
returns public.operation_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.operation_events;
  current_stage text;
begin
  select * into existing_event
  from public.operation_events
  where operation_id = p_operation_id and device_action_id = p_device_action_id;
  if found then return existing_event; end if;

  if not private.can_access_operation(p_operation_id) then raise exception 'forbidden'; end if;
  if p_stage not in ('preparation', 'departure') then raise exception 'invalid stage'; end if;
  if p_checklist = '{}'::jsonb or exists (select 1 from jsonb_each(p_checklist) where value <> 'true'::jsonb)
    then raise exception 'incomplete checklist';
  end if;

  select stage into current_stage from public.operations where id = p_operation_id for update;
  if current_stage is distinct from p_stage then raise exception 'stage conflict'; end if;

  insert into public.operation_events (
    operation_id, device_action_id, stage, actor_id, responsible_id,
    device_captured_at, checklist, latitude, longitude, accuracy, note, photo_path
  ) values (
    p_operation_id, p_device_action_id, p_stage, (select auth.uid()), p_responsible_id,
    p_device_captured_at, p_checklist, p_latitude, p_longitude, p_accuracy, nullif(trim(p_note), ''), p_photo_path
  ) returning * into existing_event;

  update public.operations
  set stage = case when p_stage = 'preparation' then 'departure' else 'departure' end
  where id = p_operation_id;
  return existing_event;
end
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.vehicles enable row level security;
alter table public.operations enable row level security;
alter table public.operation_events enable row level security;

revoke all on public.profiles, public.teams, public.team_members, public.vehicles, public.operations, public.operation_events from anon, authenticated;
grant select on public.profiles, public.teams, public.team_members, public.vehicles to authenticated;
grant select on public.operations, public.operation_events to authenticated;
grant insert on public.vehicles, public.operations to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy teams_read on public.teams for select to authenticated using (true);
create policy team_members_read on public.team_members for select to authenticated using (true);
create policy vehicles_read on public.vehicles for select to authenticated using (true);
create policy vehicles_manager_insert on public.vehicles for insert to authenticated with check (private.is_manager());
create policy operations_read on public.operations for select to authenticated using (private.can_access_operation(id));
create policy operations_manager_insert on public.operations for insert to authenticated with check (private.is_manager() and manager_id = (select auth.uid()));
create policy operation_events_read on public.operation_events for select to authenticated using (private.can_access_operation(operation_id));

revoke execute on function private.is_manager(), private.can_access_operation(uuid), private.storage_operation_id(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_manager(), private.can_access_operation(uuid), private.storage_operation_id(text) to authenticated;
revoke execute on function public.create_team(text, uuid, uuid[]), public.confirm_operation_action(uuid, uuid, text, timestamptz, jsonb, double precision, double precision, double precision, uuid, text, text) from public;
grant execute on function public.create_team(text, uuid, uuid[]), public.confirm_operation_action(uuid, uuid, text, timestamptz, jsonb, double precision, double precision, double precision, uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('operation-evidence', 'operation-evidence', false, 6000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy operation_evidence_read on storage.objects for select to authenticated
using (bucket_id = 'operation-evidence' and private.can_access_operation(private.storage_operation_id(name)));
create policy operation_evidence_insert on storage.objects for insert to authenticated
with check (bucket_id = 'operation-evidence' and private.can_access_operation(private.storage_operation_id(name)));
create policy operation_evidence_update on storage.objects for update to authenticated
using (bucket_id = 'operation-evidence' and private.can_access_operation(private.storage_operation_id(name)))
with check (bucket_id = 'operation-evidence' and private.can_access_operation(private.storage_operation_id(name)));

-- Bootstrap: crie o primeiro usuário no Supabase Auth e promova-o uma única vez.
-- update public.profiles set role = 'manager' where id = '<auth-user-uuid>';
