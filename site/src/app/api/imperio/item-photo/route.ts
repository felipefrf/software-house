import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { readEstoqueNowItemPhoto } from "@/app/imperio/logistica/data";
import {
  fetchEstoqueNowItemPhoto,
  isValidExternalId,
  type EstoqueNowItem,
} from "@/app/imperio/logistica/estoquenow";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const operationId = requestUrl.searchParams.get("operationId")?.trim() ?? "";
  const itemId = requestUrl.searchParams.get("itemId")?.trim() ?? "";
  const version = requestUrl.searchParams.get("version")?.trim() ?? "";
  if (!isUuid(operationId) || !isValidExternalId(itemId) || !version || version.length > 64)
    return NextResponse.json({ error: "Foto inválida." }, { status: 400 });

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const supabase = accessToken && url && key
    ? createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const auth = await supabase.auth.getUser(accessToken || undefined);
  if (!auth.data.user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const operation = await supabase
    .from("operations")
    .select("external_id,imported_at,source_context:estoquenow_operation_contexts(items)")
    .eq("id", operationId)
    .eq("source", "estoquenow")
    .maybeSingle();
  if (operation.error || !operation.data)
    return NextResponse.json({ error: "Foto indisponível." }, { status: 404 });
  const data = operation.data as unknown as {
    external_id: string | null;
    imported_at: string | null;
    source_context: { items: EstoqueNowItem[] } | null;
  };
  const item = data.source_context?.items.find((candidate) => candidate.id === itemId);
  if (!data.external_id || !item || data.imported_at !== version)
    return NextResponse.json({ error: "Foto indisponível." }, { status: 404 });

  try {
    const photo = await readEstoqueNowItemPhoto(data.external_id, item);
    const image = await fetchEstoqueNowItemPhoto(photo.url);
    return new NextResponse(image.bytes, {
      headers: {
        "cache-control": "private, max-age=300",
        "content-type": image.contentType,
        "x-content-type-options": "nosniff",
        vary: "Authorization, Cookie",
      },
    });
  } catch {
    return NextResponse.json({ error: "Foto indisponível." }, { status: 404 });
  }
}
