create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

create or replace function private.invoke_imperio_estoquenow_pull()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  endpoint text;
  secret text;
  request_id bigint;
begin
  select decrypted_secret
    into endpoint
  from vault.decrypted_secrets
  where name = 'imperio_estoquenow_pull_url';

  select decrypted_secret
    into secret
  from vault.decrypted_secrets
  where name = 'imperio_estoquenow_cron_secret';

  if nullif(endpoint, '') is null or nullif(secret, '') is null then
    raise exception 'ESTOQUENOW_CRON_CONFIGURATION_MISSING';
  end if;

  if endpoint <> 'https://imperio-logistica.vercel.app/api/imperio/estoquenow-pull' then
    raise exception 'ESTOQUENOW_CRON_ENDPOINT_INVALID';
  end if;

  select net.http_get(
    url := endpoint,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 300000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_imperio_estoquenow_pull()
  from public, anon, authenticated, service_role;

select cron.schedule(
  'imperio-estoquenow-pull-15min',
  '*/15 * * * *',
  'select private.invoke_imperio_estoquenow_pull()'
);
