#!/usr/bin/env bash
set -euo pipefail

readonly BASE_URL="${ESTOQUENOW_API_URL:-https://api.estoquenow.com.br}"
readonly TOKEN_CACHE="${TMPDIR:-/tmp}/imperio-estoquenow-token-${UID}.json"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

require_env() {
  [[ -n "${ESTOQUENOW_CLIENT_ID:-}" ]] || fail "ESTOQUENOW_CLIENT_ID ausente."
  [[ -n "${ESTOQUENOW_CLIENT_SECRET:-}" ]] || fail "ESTOQUENOW_CLIENT_SECRET ausente."
  [[ "${ESTOQUENOW_IMPORT_ENABLED:-false}" != "true" ]] || fail "ESTOQUENOW_IMPORT_ENABLED deve permanecer false."
  [[ "$BASE_URL" == https://* ]] || fail "ESTOQUENOW_API_URL deve usar HTTPS."
}

allowed_get() {
  [[ "$1" != *$'\n'* && "$1" != *$'\r'* && "$1" != *' '* && "$1" != *'#'* && "$1" != *'..'* ]] || return 1
  case "$1" in
    /v1/logistic | /v1/logistic/ | /v1/logistic\?*) return 0 ;;
  esac
  [[ "$1" =~ ^/v1/logistic/[0-9]+/?$ ]] ||
    [[ "$1" =~ ^/v1/logistic/(print_delivery|print_return|checklist_delivery|checklist_return|checklist_delivery_return)/[0-9]+/?$ ]]
}

refresh_token() {
  local response_file status token temp_cache
  response_file="$(mktemp)"
  temp_cache="$(mktemp)"
  trap 'rm -f "$response_file" "$temp_cache"' RETURN
  status="$(curl -sS --max-time 15 -o "$response_file" -w '%{http_code}' \
    -H 'content-type: application/json' \
    --data "$(jq -nc --arg id "$ESTOQUENOW_CLIENT_ID" --arg secret "$ESTOQUENOW_CLIENT_SECRET" '{client_id:$id,client_secret:$secret}')" \
    "${BASE_URL%/}/v1/oauth2/token")"
  [[ "$status" == 2* ]] || fail "ESTOQUENOW_AUTH_HTTP_${status}"
  token="$(jq -r '.access_token // .token // empty' "$response_file")"
  [[ -n "$token" && "$token" != "[SENSITIVE]" ]] || fail "ESTOQUENOW_INVALID_TOKEN_RESPONSE"
  umask 077
  jq -c --argjson cached_at "$(date +%s)" '. + {cached_at:$cached_at}' "$response_file" > "$temp_cache"
  mv "$temp_cache" "$TOKEN_CACHE"
  chmod 600 "$TOKEN_CACHE"
  printf '%s' "$token"
}

access_token() {
  local now cached_at token
  now="$(date +%s)"
  if [[ -f "$TOKEN_CACHE" ]]; then
    cached_at="$(jq -r '.cached_at // 0' "$TOKEN_CACHE" 2>/dev/null || printf '0')"
    token="$(jq -r '.access_token // .token // empty' "$TOKEN_CACHE" 2>/dev/null || true)"
    if [[ -n "$token" && "$cached_at" =~ ^[0-9]+$ && $((cached_at + 1500)) -gt $now ]]; then
      printf '%s' "$token"
      return
    fi
  fi
  refresh_token
}

sanitize_json() {
  jq '
    def signature:
      if . == null then "null"
      elif type != "string" then type
      elif test("^[0-9]{2}/[0-9]{2}/[0-9]{4}$") then "DD/MM/YYYY"
      elif test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$") then "YYYY-MM-DD"
      elif test("^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$") then "HH:MM[:SS]"
      elif test("^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ]") then "datetime"
      elif test("^(manha|tarde|noite)$"; "i") then "turno"
      elif length == 0 then "empty-string"
      else "string"
      end;
    def path_name($path): $path | map(if type == "number" then "[]" else tostring end) | join(".");
    {
      envelope: (if type == "object" then {
        page: (.page // null),
        perPage: (.perPage // .per_page // null),
        recordsTotal: (.recordsTotal // .records_total // null),
        recordsFiltered: (.recordsFiltered // .records_filtered // null)
      } else null end),
      records: (if type == "array" then length elif (.data | type) == "array" then .data | length else null end),
      fields: ([paths(scalars) as $path | {
        path: path_name($path),
        signature: (getpath($path) | signature)
      }] | group_by(.path) | map({
        path: .[0].path,
        signatures: (map(.signature) | unique),
        occurrences: length
      }))
    }'
}

readonly_get() {
  local path="$1" token response_file headers_file status content_type
  allowed_get "$path" || fail "GET não permitido pelo harness: $path"
  response_file="$(mktemp)"
  headers_file="$(mktemp)"
  trap 'rm -f "$response_file" "$headers_file"' RETURN
  token="$(access_token)"
  status="$(curl -sS --max-time 20 -D "$headers_file" -o "$response_file" -w '%{http_code}' \
    -H "authorization: Bearer $token" \
    "${BASE_URL%/}${path}")"
  if [[ "$status" == "401" ]]; then
    rm -f "$TOKEN_CACHE"
    token="$(access_token)"
    status="$(curl -sS --max-time 20 -D "$headers_file" -o "$response_file" -w '%{http_code}' \
      -H "authorization: Bearer $token" \
      "${BASE_URL%/}${path}")"
  fi
  [[ "$status" == 2* ]] || fail "ESTOQUENOW_GET_HTTP_${status}"
  content_type="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/{gsub(/\r/,""); print $2; exit}' "$headers_file")"
  if [[ "$content_type" == application/json* ]]; then
    sanitize_json < "$response_file"
  else
    jq -n --arg status "$status" --arg contentType "$content_type" --argjson bytes "$(wc -c < "$response_file")" \
      '{httpStatus:$status,contentType:$contentType,bytes:$bytes,body:"redacted"}'
  fi
}

self_test() {
  local fixture output
  allowed_get '/v1/logistic?page=1&per_page=25' || fail "self-test allowlist"
  ! allowed_get '/v1/logistic/1/confirm' || fail "self-test write block"
  fixture="$(mktemp)"
  trap 'rm -f "$fixture"' RETURN
  printf '%s' '{"page":1,"data":[{"id":123,"event_name":"Pessoa privada","delivery_date":"31/08/2026","delivery_time":"manha"}]}' > "$fixture"
  output="$(sanitize_json < "$fixture")"
  [[ "$output" != *'Pessoa privada'* && "$output" == *'DD/MM/YYYY'* && "$output" == *'turno'* ]] || fail "self-test redaction"
  printf '%s\n' "readonly harness: ok"
}

case "${1:-}" in
  token)
    require_env
    access_token >/dev/null
    printf '%s\n' "token pronto e redigido"
    ;;
  get)
    require_env
    [[ -n "${2:-}" ]] || fail "Uso: $0 get '/v1/logistic?...'"
    readonly_get "$2"
    ;;
  self-test)
    self_test
    ;;
  *)
    fail "Uso: $0 {token|get <rota GET>|self-test}"
    ;;
esac
