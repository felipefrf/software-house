create table public.estoquenow_operation_contexts (
  operation_id uuid primary key references public.operations(id) on delete cascade,
  order_id text check (order_id is null or length(order_id) <= 200),
  protocol text check (protocol is null or length(protocol) <= 200),
  source_version text check (source_version is null or length(source_version) <= 200),
  return_at timestamptz check (return_at is null or pg_catalog.isfinite(return_at)),
  venue text check (venue is null or length(venue) <= 500),
  address_zipcode text check (address_zipcode is null or length(address_zipcode) <= 100),
  address_street text check (address_street is null or length(address_street) <= 500),
  address_number text check (address_number is null or length(address_number) <= 100),
  address_complement text check (address_complement is null or length(address_complement) <= 500),
  address_neighborhood text check (address_neighborhood is null or length(address_neighborhood) <= 500),
  address_city text check (address_city is null or length(address_city) <= 200),
  address_state text check (address_state is null or length(address_state) <= 100),
  delivery_status_id text check (delivery_status_id is null or length(delivery_status_id) <= 200),
  delivery_status_type text check (delivery_status_type is null or length(delivery_status_type) <= 200),
  delivery_concluded boolean,
  return_status_id text check (return_status_id is null or length(return_status_id) <= 200),
  return_status_type text check (return_status_type is null or length(return_status_type) <= 200),
  return_concluded boolean,
  item_count text check (item_count is null or length(item_count) <= 200),
  order_type text check (order_type is null or length(order_type) <= 200),
  logistic_type_id text check (logistic_type_id is null or length(logistic_type_id) <= 200)
);

alter table public.estoquenow_operation_contexts enable row level security;

revoke all on table public.estoquenow_operation_contexts
  from public, anon, authenticated, service_role;
grant select on table public.estoquenow_operation_contexts to authenticated;

create policy "operation participants read EstoqueNOW context"
on public.estoquenow_operation_contexts for select to authenticated
using ((select private.can_access_operation(operation_id)));

drop function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid
);

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
  p_legacy_notes text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_operation public.operations;
  current_context public.estoquenow_operation_contexts;
  operation_id uuid;
  context_order_id text := nullif(trim(p_context->>'order_id'), '');
  context_protocol text := nullif(trim(p_context->>'protocol'), '');
  context_source_version text := nullif(trim(p_context->>'source_version'), '');
  context_return_at timestamptz := nullif(p_context->>'return_at', '')::timestamptz;
  context_venue text := nullif(trim(p_context->>'venue'), '');
  context_address_zipcode text := nullif(trim(p_context->>'address_zipcode'), '');
  context_address_street text := nullif(trim(p_context->>'address_street'), '');
  context_address_number text := nullif(trim(p_context->>'address_number'), '');
  context_address_complement text := nullif(trim(p_context->>'address_complement'), '');
  context_address_neighborhood text := nullif(trim(p_context->>'address_neighborhood'), '');
  context_address_city text := nullif(trim(p_context->>'address_city'), '');
  context_address_state text := nullif(trim(p_context->>'address_state'), '');
  context_delivery_status_id text := nullif(trim(p_context->>'delivery_status_id'), '');
  context_delivery_status_type text := nullif(trim(p_context->>'delivery_status_type'), '');
  context_delivery_concluded boolean := nullif(p_context->>'delivery_concluded', '')::boolean;
  context_return_status_id text := nullif(trim(p_context->>'return_status_id'), '');
  context_return_status_type text := nullif(trim(p_context->>'return_status_type'), '');
  context_return_concluded boolean := nullif(p_context->>'return_concluded', '')::boolean;
  context_item_count text := nullif(trim(p_context->>'item_count'), '');
  context_order_type text := nullif(trim(p_context->>'order_type'), '');
  context_logistic_type_id text := nullif(trim(p_context->>'logistic_type_id'), '');
begin
  if not exists (
    select 1 from public.profiles
    where id = p_manager_id and role = 'manager' and not must_change_password
  ) then raise exception 'invalid manager'; end if;
  if nullif(trim(p_external_id), '') is null or length(trim(p_external_id)) > 200
    then raise exception 'invalid external id';
  end if;
  if nullif(trim(p_event_name), '') is null or nullif(trim(p_destination), '') is null
    then raise exception 'invalid source fields';
  end if;
  if p_scheduled_at is null or not pg_catalog.isfinite(p_scheduled_at)
    or p_imported_at is null or not pg_catalog.isfinite(p_imported_at)
    or (context_return_at is not null and not pg_catalog.isfinite(context_return_at))
    or (context_return_at is not null and context_return_at <= p_scheduled_at)
    then raise exception 'invalid source time';
  end if;
  if pg_catalog.jsonb_typeof(p_context) is distinct from 'object'
    or p_context - array[
      'order_id', 'protocol', 'source_version', 'return_at', 'venue',
      'address_zipcode', 'address_street', 'address_number', 'address_complement',
      'address_neighborhood', 'address_city', 'address_state',
      'delivery_status_id', 'delivery_status_type', 'delivery_concluded',
      'return_status_id', 'return_status_type', 'return_concluded', 'item_count',
      'order_type', 'logistic_type_id'
    ] <> '{}'::jsonb
    then raise exception 'invalid source context';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('estoquenow:' || trim(p_external_id), 0)
  );

  select * into current_operation
  from public.operations
  where source = 'estoquenow' and external_id = trim(p_external_id)
  for update;

  if found then
    select * into current_context
    from public.estoquenow_operation_contexts
    where public.estoquenow_operation_contexts.operation_id = current_operation.id;

    if not found then
      if current_operation.event_name is distinct from trim(p_legacy_event_name)
        or current_operation.destination is distinct from trim(p_legacy_destination)
        or current_operation.scheduled_at is distinct from p_scheduled_at
        or current_operation.notes is distinct from nullif(trim(p_legacy_notes), '')
        then raise exception 'legacy source divergence';
      end if;
      update public.operations
      set event_name = trim(p_event_name), destination = trim(p_destination),
        notes = nullif(trim(p_notes), ''), imported_at = p_imported_at
      where id = current_operation.id;
      operation_id := current_operation.id;
    else
      if current_operation.event_name is distinct from trim(p_event_name)
        or current_operation.destination is distinct from trim(p_destination)
        or current_operation.scheduled_at is distinct from p_scheduled_at
        or current_context.order_id is distinct from context_order_id
        or current_context.protocol is distinct from context_protocol
        or current_context.source_version is distinct from context_source_version
        or current_context.return_at is distinct from context_return_at
        or current_context.venue is distinct from context_venue
        or current_context.address_zipcode is distinct from context_address_zipcode
        or current_context.address_street is distinct from context_address_street
        or current_context.address_number is distinct from context_address_number
        or current_context.address_complement is distinct from context_address_complement
        or current_context.address_neighborhood is distinct from context_address_neighborhood
        or current_context.address_city is distinct from context_address_city
        or current_context.address_state is distinct from context_address_state
        or current_context.delivery_status_id is distinct from context_delivery_status_id
        or current_context.delivery_status_type is distinct from context_delivery_status_type
        or current_context.delivery_concluded is distinct from context_delivery_concluded
        or current_context.return_status_id is distinct from context_return_status_id
        or current_context.return_status_type is distinct from context_return_status_type
        or current_context.return_concluded is distinct from context_return_concluded
        or current_context.item_count is distinct from context_item_count
        or current_context.order_type is distinct from context_order_type
        or current_context.logistic_type_id is distinct from context_logistic_type_id
        then
          update public.operations
          set event_name = trim(p_event_name), destination = trim(p_destination),
            scheduled_at = p_scheduled_at, imported_at = p_imported_at
          where id = current_operation.id;
          update public.estoquenow_operation_contexts
          set order_id = context_order_id,
            protocol = context_protocol,
            source_version = context_source_version,
            return_at = context_return_at,
            venue = context_venue,
            address_zipcode = context_address_zipcode,
            address_street = context_address_street,
            address_number = context_address_number,
            address_complement = context_address_complement,
            address_neighborhood = context_address_neighborhood,
            address_city = context_address_city,
            address_state = context_address_state,
            delivery_status_id = context_delivery_status_id,
            delivery_status_type = context_delivery_status_type,
            delivery_concluded = context_delivery_concluded,
            return_status_id = context_return_status_id,
            return_status_type = context_return_status_type,
            return_concluded = context_return_concluded,
            item_count = context_item_count,
            order_type = context_order_type,
            logistic_type_id = context_logistic_type_id
          where public.estoquenow_operation_contexts.operation_id = current_operation.id;
          return 'updated';
      end if;
      update public.operations set imported_at = p_imported_at where id = current_operation.id;
      return 'unchanged';
    end if;
  else
    insert into public.operations (
      source, external_id, event_name, destination, scheduled_at,
      manager_id, notes, imported_at
    ) values (
      'estoquenow', trim(p_external_id), trim(p_event_name), trim(p_destination),
      p_scheduled_at, p_manager_id, nullif(trim(p_notes), ''), p_imported_at
    ) returning id into operation_id;
  end if;

  insert into public.estoquenow_operation_contexts (
    operation_id, order_id, protocol, source_version, return_at, venue,
    address_zipcode, address_street, address_number, address_complement,
    address_neighborhood, address_city, address_state,
    delivery_status_id, delivery_status_type, delivery_concluded,
    return_status_id, return_status_type, return_concluded, item_count,
    order_type, logistic_type_id
  ) values (
    operation_id, context_order_id, context_protocol, context_source_version,
    context_return_at, context_venue, context_address_zipcode, context_address_street,
    context_address_number, context_address_complement, context_address_neighborhood,
    context_address_city, context_address_state, context_delivery_status_id,
    context_delivery_status_type, context_delivery_concluded, context_return_status_id,
    context_return_status_type, context_return_concluded, context_item_count,
    context_order_type, context_logistic_type_id
  );

  return case when current_operation.id is null then 'new' else 'backfilled' end;
end
$$;

revoke execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.confirm_estoquenow_canary(
  text, text, text, timestamptz, text, timestamptz, uuid, jsonb, text, text, text
) to service_role;
