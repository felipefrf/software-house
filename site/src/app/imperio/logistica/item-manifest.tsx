"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import type { Operation } from "./types";
import { CheckMark, formatTime, formatShortDate, Notice } from "./ui";
import { postJson, type Run } from "./workspace";

const PHOTO_LOAD_CONCURRENCY = 4;

export const manifestSummary = (operation: Operation) => {
  const items = operation.estoquenow_context?.items ?? [];
  const checks = new Set(operation.item_checks.map((item) => item.source_item_id));
  const checked = items.filter((item) => checks.has(item.id)).length;
  return { total: items.length, checked, complete: items.length > 0 && checked === items.length };
};

/**
 * Manifesto de carga: itens da origem EstoqueNOW com foto (proxy autenticado) e
 * conferência persistida. Sem título próprio: quem embute decide o cabeçalho.
 */
export function ItemManifest({
  operation,
  configured,
  busy,
  online = true,
  refresh,
  run,
  dense = false,
}: {
  operation: Operation;
  configured: boolean;
  busy: boolean;
  online?: boolean;
  refresh: () => Promise<void>;
  run: Run;
  dense?: boolean;
}) {
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const [loadedPhotos, setLoadedPhotos] = useState<Set<string>>(new Set());
  const settledPhotos = useRef(new Set<string>());
  const items = operation.estoquenow_context?.items ?? [];
  const photoVersion = operation.imported_at ?? "unversioned";
  const manifestPhotoKey = `${operation.id}:${photoVersion}`;
  const [photoQueue, setPhotoQueue] = useState({ key: manifestPhotoKey, limit: PHOTO_LOAD_CONCURRENCY });
  if (!items.length) return null;
  const photoLoadLimit = photoQueue.key === manifestPhotoKey ? photoQueue.limit : PHOTO_LOAD_CONCURRENCY;
  const advancePhotoQueue = () =>
    setPhotoQueue((current) => ({
      key: manifestPhotoKey,
      limit: Math.min(items.length, (current.key === manifestPhotoKey ? current.limit : PHOTO_LOAD_CONCURRENCY) + 1),
    }));
  const settlePhoto = (photoKey: string, loaded: boolean) => {
    if (settledPhotos.current.has(photoKey)) return;
    settledPhotos.current.add(photoKey);
    if (loaded) setLoadedPhotos((current) => new Set(current).add(photoKey));
    else setFailedPhotos((current) => new Set(current).add(photoKey));
    advancePhotoQueue();
  };

  const checks = new Map(operation.item_checks.map((item) => [item.source_item_id, item]));
  const checked = items.filter((item) => checks.has(item.id)).length;
  const percent = Math.round((checked / items.length) * 100);
  const editable = configured && online && operation.status === "active";
  const photoBox = dense ? "size-14" : "size-16";

  return (
    <div className="@container">
      <div className="flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-sm bg-imp-line"
          role="progressbar"
          aria-label="Progresso da conferência dos itens"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={checked}
        >
          <span className="block h-full rounded-sm bg-imp-green transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[14px] font-semibold tabular-nums text-imp-muted">{percent}%</span>
      </div>
      {!online && (
        <div className="mt-3">
          <Notice tone="amber" title="Sem conexão">Conecte o aparelho para marcar itens conferidos.</Notice>
        </div>
      )}
      <ul className={`mt-3 divide-y divide-imp-line rounded-xl border border-imp-line bg-imp-surface ${dense ? "" : "@2xl:grid @2xl:grid-cols-2 @2xl:divide-y-0 @2xl:gap-px @2xl:bg-imp-line"}`}>
        {items.map((item, itemIndex) => {
          const check = checks.get(item.id);
          const isChecked = Boolean(check);
          const photoKey = `${operation.id}:${photoVersion}:${item.id}`;
          const photoLoaded = loadedPhotos.has(photoKey);
          const photoState = !online
            ? "Foto exige conexão"
            : failedPhotos.has(photoKey)
              ? "Foto não disponível"
              : itemIndex < photoLoadLimit
                ? "Carregando"
                : "Aguardando";
          return (
            <li key={item.id} className={`${dense ? "" : "@2xl:bg-imp-surface"}`}>
              <label
                className={`flex min-h-16 items-center gap-3 px-3 py-2.5 has-focus-visible:outline-3 has-focus-visible:outline-imp-green has-focus-visible:-outline-offset-3 ${
                  editable && !busy ? "cursor-pointer hover:bg-imp-ground/60" : "cursor-default"
                } ${isChecked ? "bg-imp-green-tint/50" : ""}`}
              >
                <span className={`relative ${photoBox} shrink-0 overflow-hidden rounded bg-imp-ground text-imp-muted`}>
                  {!photoLoaded && (
                    <span className={`absolute inset-0 grid place-items-center ${!online || failedPhotos.has(photoKey) ? "" : "animate-pulse"}`}>
                      {(!online || failedPhotos.has(photoKey)) && <ImageOff size={18} aria-hidden="true" />}
                      <span className="sr-only">{photoState}</span>
                    </span>
                  )}
                  {online && itemIndex < photoLoadLimit && !failedPhotos.has(photoKey) && (
                    <Image
                      unoptimized
                      loading="eager"
                      fill
                      sizes="64px"
                      src={`/api/imperio/item-photo?operationId=${encodeURIComponent(operation.id)}&itemId=${encodeURIComponent(item.id)}&version=${encodeURIComponent(photoVersion)}`}
                      alt={`Foto de ${item.name}`}
                      className="object-cover"
                      onLoad={() => settlePhoto(photoKey, true)}
                      onError={() => settlePhoto(photoKey, false)}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[15px] font-medium leading-5">{item.name}</span>
                  <span className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[13px] text-imp-muted">
                    <span>Item {item.itemId}</span>
                    {check && <span className="text-imp-green">Conferido {formatShortDate(check.checked_at)} às {formatTime(check.checked_at)}</span>}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={!editable || busy}
                  aria-label={`${item.name} conferido`}
                  className="sr-only"
                  onChange={(event) => {
                    const next = event.currentTarget.checked;
                    void run(async () => {
                      await postJson("set-operation-item-checked", { operationId: operation.id, item, checked: next });
                      await refresh();
                    }, next ? "Item conferido." : "Conferência removida.");
                  }}
                />
                <CheckMark checked={isChecked} />
              </label>
            </li>
          );
        })}
      </ul>
      {operation.status !== "active" && (
        <p className="mt-2 text-[13px] text-imp-muted">Operação encerrada: conferência preservada somente para consulta.</p>
      )}
    </div>
  );
}
