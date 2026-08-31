create function private.has_changed_password()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and not must_change_password
  )
$$;

create or replace function private.is_manager()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'manager'
      and not must_change_password
  )
$$;

create or replace function private.can_access_operation(target_operation_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.has_changed_password() and (
    private.is_manager() or exists (
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
  )
$$;

create or replace function private.can_access_team(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.has_changed_password() and (
    private.is_manager() or exists (
      select 1 from public.team_members
      where team_id = target_team_id and person_id = (select auth.uid())
    )
  )
$$;

create or replace function private.can_access_profile(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select target_profile_id = (select auth.uid())
    or (
      private.has_changed_password() and (
        private.is_manager() or exists (
          select 1
          from public.team_members mine
          join public.team_members theirs on theirs.team_id = mine.team_id
          where mine.person_id = (select auth.uid())
            and theirs.person_id = target_profile_id
        )
        or exists (
          select 1 from public.operations operation
          where operation.driver_id = target_profile_id
            and private.can_access_operation(operation.id)
        )
      )
    )
$$;

create or replace function private.can_access_vehicle(target_vehicle_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.has_changed_password() and (
    private.is_manager() or exists (
      select 1 from public.operations operation
      where operation.vehicle_id = target_vehicle_id
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
  )
$$;

create function private.required_checklist(p_stage text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'preparation' then array[
      'Pedido e separação conferidos',
      'Equipe escalada confirmada',
      'Veículo e motorista vinculados'
    ]
    when 'departure' then array[
      'Motorista e veículo confirmados',
      'Toda a equipe presente',
      'Carga fotografada e conferida'
    ]
    when 'travel' then array[
      'Rota aberta no Google Maps',
      'Contato do local disponível',
      'Nenhuma ocorrência pendente sem registro'
    ]
    when 'arrival' then array[
      'Chegada registrada no local',
      'Condição de acesso verificada',
      'Equipe orientada para a próxima etapa'
    ]
    when 'assembly' then array[
      'Itens e quantidades conferidos',
      'Montagem final fotografada',
      'Divergências registradas como ocorrência'
    ]
    when 'delivery' then array[
      'Entrega conferida com o responsável local',
      'Aceite interno identificado',
      'Pendências registradas'
    ]
    when 'disassembly' then array[
      'Volumes retirados conferidos',
      'Condição do local fotografada',
      'Faltas ou avarias registradas'
    ]
    when 'return' then array[
      'Saída do evento confirmada',
      'Chegada à base registrada',
      'Itens avariados separados para revisão'
    ]
    when 'inspection' then array[
      'Devolução conferida',
      'Avarias separadas e registradas',
      'Operação pronta para encerramento'
    ]
    else array[]::text[]
  end
$$;

create function private.can_modify_evidence(object_name text, object_owner_id text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select object_owner_id = (select auth.uid())::text
    and private.can_access_operation(private.storage_operation_id(object_name))
    and not exists (
      select 1 from public.operation_events where photo_path = object_name
    )
    and not exists (
      select 1 from public.incidents where photo_path = object_name
    )
$$;

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

drop policy incidents_update on public.incidents;
create policy incidents_update on public.incidents for update to authenticated
  using (private.is_manager())
  with check (private.is_manager());

drop policy operation_evidence_insert on storage.objects;
create policy operation_evidence_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'operation-evidence'
  and owner_id = (select auth.uid())::text
  and private.can_access_operation(private.storage_operation_id(name))
);

drop policy operation_evidence_update on storage.objects;
create policy operation_evidence_update on storage.objects for update to authenticated
using (
  bucket_id = 'operation-evidence'
  and private.can_modify_evidence(name, owner_id)
)
with check (
  bucket_id = 'operation-evidence'
  and private.can_modify_evidence(name, owner_id)
);

drop policy operation_evidence_delete on storage.objects;
create policy operation_evidence_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'operation-evidence'
  and private.can_modify_evidence(name, owner_id)
);

revoke execute on function private.has_changed_password(), private.required_checklist(text),
  private.can_modify_evidence(text, text) from public;
grant execute on function private.can_modify_evidence(text, text) to authenticated;
revoke execute on function public.mark_password_changed() from authenticated;
