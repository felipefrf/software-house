create function public.confirm_estoquenow_canary(
  p_external_id text,
  p_event_name text,
  p_destination text,
  p_scheduled_at timestamptz,
  p_notes text,
  p_imported_at timestamptz,
  p_manager_id uuid,
  p_context jsonb,
  p_legacy_event_name text,
  p_legacy_destination text,
  p_legacy_notes text,
  p_expected_imported_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_operation public.operations;
  current_context public.estoquenow_operation_contexts;
  stable_changed boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('estoquenow:' || trim(p_external_id), 0)
  );

  select * into current_operation
  from public.operations
  where source = 'estoquenow' and external_id = trim(p_external_id)
  for update;

  if found then
    if current_operation.imported_at is distinct from p_expected_imported_at
      then raise exception 'stale source divergence';
    end if;
    select * into current_context
    from public.estoquenow_operation_contexts
    where operation_id = current_operation.id;
    if not found then
      stable_changed := true;
    else
      stable_changed :=
        current_operation.event_name is distinct from trim(p_event_name)
        or current_operation.destination is distinct from trim(p_destination)
        or current_operation.scheduled_at is distinct from p_scheduled_at
        or current_context.order_id is distinct from nullif(trim(p_context->>'order_id'), '')
        or current_context.protocol is distinct from nullif(trim(p_context->>'protocol'), '')
        or current_context.return_at is distinct from nullif(p_context->>'return_at', '')::timestamptz
        or current_context.venue is distinct from nullif(trim(p_context->>'venue'), '')
        or current_context.address_zipcode is distinct from nullif(trim(p_context->>'address_zipcode'), '')
        or current_context.address_street is distinct from nullif(trim(p_context->>'address_street'), '')
        or current_context.address_number is distinct from nullif(trim(p_context->>'address_number'), '')
        or current_context.address_complement is distinct from nullif(trim(p_context->>'address_complement'), '')
        or current_context.address_neighborhood is distinct from nullif(trim(p_context->>'address_neighborhood'), '')
        or current_context.address_city is distinct from nullif(trim(p_context->>'address_city'), '')
        or current_context.address_state is distinct from nullif(trim(p_context->>'address_state'), '')
        or current_context.order_type is distinct from nullif(trim(p_context->>'order_type'), '')
        or current_context.logistic_type_id is distinct from nullif(trim(p_context->>'logistic_type_id'), '');
    end if;
    if stable_changed and (
      current_operation.status <> 'active'
      or exists (
        select 1 from public.operation_events
        where operation_id = current_operation.id
      )
    ) then raise exception 'historic source divergence';
    end if;
  elsif p_expected_imported_at is not null then
    raise exception 'stale source divergence';
  end if;

  return public.confirm_estoquenow_canary(
    p_external_id, p_event_name, p_destination, p_scheduled_at, p_notes,
    p_imported_at, p_manager_id, p_context, p_legacy_event_name,
    p_legacy_destination, p_legacy_notes
  );
end
$$;

revoke execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid, jsonb,
  text, text, text
) from service_role;

revoke execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid, jsonb,
  text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid, jsonb,
  text, text, text, timestamptz
) to service_role;
