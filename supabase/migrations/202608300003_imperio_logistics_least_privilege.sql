create function private.can_access_team(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.is_manager() or exists (
    select 1 from public.team_members
    where team_id = target_team_id and person_id = (select auth.uid())
  )
$$;

create function private.can_access_profile(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.is_manager()
    or target_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.team_members mine
      join public.team_members theirs on theirs.team_id = mine.team_id
      where mine.person_id = (select auth.uid())
        and theirs.person_id = target_profile_id
    )
$$;

create function private.can_access_vehicle(target_vehicle_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.is_manager() or exists (
    select 1 from public.operations operation
    where operation.vehicle_id = target_vehicle_id
      and private.can_access_operation(operation.id)
  )
$$;

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (private.can_access_profile(id));

drop policy teams_read on public.teams;
create policy teams_read on public.teams for select to authenticated
  using (private.can_access_team(id));

drop policy team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated
  using (private.can_access_team(team_id));

drop policy vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles for select to authenticated
  using (private.can_access_vehicle(id));

revoke execute on function private.can_access_team(uuid), private.can_access_profile(uuid), private.can_access_vehicle(uuid) from public;
grant execute on function private.can_access_team(uuid), private.can_access_profile(uuid), private.can_access_vehicle(uuid) to authenticated;
