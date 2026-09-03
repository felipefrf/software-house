import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { readEstoqueNowItemPhoto } from "@/app/imperio/logistica/data";
import {
  fetchEstoqueNowItemPhoto,
  isValidExternalId,
  withEstoqueNowMediaSlot,
  type EstoqueNowItem,
} from "@/app/imperio/logistica/estoquenow";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { readThroughItemPhotoCache } from "./cache";

const PHOTO_CACHE_BUCKET = "estoquenow-item-photos";
const PHOTO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_MAX_BYTES = 6_000_000;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const SAFE_PHOTO_ERRORS = new Set([
  "MEDIA_HOST_NOT_ALLOWED",
  "MEDIA_PROTOCOL_NOT_ALLOWED",
  "MEDIA_CREDENTIALS_NOT_ALLOWED",
  "MEDIA_PORT_NOT_ALLOWED",
  "MEDIA_REDIRECT_INVALID",
  "MEDIA_FETCH_FAILED",
  "MEDIA_TYPE_INVALID",
  "MEDIA_TOO_LARGE",
  "MEDIA_QUEUE_BUSY",
  "ESTOQUENOW_SOURCE_ITEM_CHANGED",
  "ESTOQUENOW_ITEM_PHOTO_UNAVAILABLE",
  "ESTOQUENOW_INVALID_ITEM_PHOTO",
  "ESTOQUENOW_PHOTO_SOURCE_UNAVAILABLE",
]);

class PhotoRequestError extends Error {
  constructor(
    message: string,
    readonly status: 429 | 503,
    readonly retryAfter: number,
  ) {
    super(message);
  }
}

const photoResponse = (photo: { bytes: Uint8Array<ArrayBuffer>; contentType: string }) =>
  new NextResponse(photo.bytes, {
    headers: {
      "cache-control": "private, max-age=300",
      "content-type": photo.contentType,
      "x-content-type-options": "nosniff",
      vary: "Authorization, Cookie",
    },
  });

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
  const cachePath = `${operationId}/${createHash("sha256")
    .update(`${itemId}\0${data.imported_at}`)
    .digest("hex")}`;
  const admin = createSupabaseAdminClient();
  let sourceHost = "";
  try {
    const claim = await supabase.rpc("claim_estoquenow_item_photo_request", {
      p_operation_id: operationId,
    });
    let claimData: unknown = claim.data;
    if (Array.isArray(claimData))
      claimData = claimData.length === 1 ? claimData[0] : null;
    const claimRow = claimData && typeof claimData === "object"
      ? claimData as Record<string, unknown>
      : null;
    if (
      claim.error ||
      !claimRow ||
      typeof claimRow.allowed !== "boolean" ||
      !Number.isInteger(claimRow.retry_after_seconds)
    ) throw new PhotoRequestError("Foto indisponível.", 503, 5);
    if (!claimRow.allowed) {
      const retryAfter = Math.min(
        Math.max(Number(claimRow.retry_after_seconds), 1),
        60,
      );
      throw new PhotoRequestError(
        "Muitas fotos solicitadas. Tente novamente em instantes.",
        429,
        retryAfter,
      );
    }

    const image = await readThroughItemPhotoCache(
      async () => {
        if (!admin) return null;
        const cached = await admin.storage.from(PHOTO_CACHE_BUCKET).download(cachePath);
        if (cached.error || !cached.data) return null;
        const contentType = cached.data.type.split(";", 1)[0];
        if (
          !PHOTO_CONTENT_TYPES.has(contentType) ||
          cached.data.size === 0 ||
          cached.data.size > PHOTO_MAX_BYTES
        ) return null;
        return {
          bytes: new Uint8Array(await cached.data.arrayBuffer()),
          contentType,
        };
      },
      async () =>
        withEstoqueNowMediaSlot(async () => {
          const photo = await readEstoqueNowItemPhoto(data.external_id!, item);
          sourceHost = new URL(photo.url).hostname.toLowerCase();
          return fetchEstoqueNowItemPhoto(photo.url);
        }),
      async (photo) => {
        if (!admin) return;
        const upload = await admin.storage.from(PHOTO_CACHE_BUCKET).upload(
          cachePath,
          photo.bytes,
          {
            cacheControl: "31536000",
            contentType: photo.contentType,
            upsert: false,
          },
        );
        if (upload.error) throw upload.error;
      },
    );
    return photoResponse(image);
  } catch (error) {
    if (error instanceof PhotoRequestError)
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            "cache-control": "no-store",
            "retry-after": String(error.retryAfter),
          },
        },
      );
    const [rawReason, blockedHost] = error instanceof Error
      ? error.message.split("@", 2)
      : ["PHOTO_UNAVAILABLE", ""];
    const reason = SAFE_PHOTO_ERRORS.has(rawReason)
      ? rawReason
      : "PHOTO_UNAVAILABLE";
    const transient = new Set([
      "MEDIA_FETCH_FAILED",
      "MEDIA_QUEUE_BUSY",
      "ESTOQUENOW_PHOTO_SOURCE_UNAVAILABLE",
    ]).has(reason);
    return NextResponse.json(
      { error: "Foto indisponível.", reason, ...((blockedHost || sourceHost) ? { sourceHost: blockedHost || sourceHost } : {}) },
      {
        status: transient ? 503 : 404,
        headers: transient
          ? { "cache-control": "no-store", "retry-after": "5" }
          : { "cache-control": "private, max-age=60" },
      },
    );
  }
}
