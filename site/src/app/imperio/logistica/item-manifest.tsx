"use client";

import { Check, ImageOff } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import type { Operation } from "./types";
import { formatDate, postJson, type Run } from "./workspace";

const PHOTO_LOAD_CONCURRENCY = 4;

export function ItemManifest({
  operation,
  configured,
  busy,
  online = true,
  refresh,
  run,
}: {
  operation: Operation;
  configured: boolean;
  busy: boolean;
  online?: boolean;
  refresh: () => Promise<void>;
  run: Run;
}) {
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const [loadedPhotos, setLoadedPhotos] = useState<Set<string>>(new Set());
  const settledPhotos = useRef(new Set<string>());
  const items = operation.estoquenow_context?.items ?? [];
  const photoVersion = operation.imported_at ?? "unversioned";
  const manifestPhotoKey = `${operation.id}:${photoVersion}`;
  const [photoQueue, setPhotoQueue] = useState({
    key: manifestPhotoKey,
    limit: PHOTO_LOAD_CONCURRENCY,
  });
  if (!items.length) return null;
  const photoLoadLimit = photoQueue.key === manifestPhotoKey
    ? photoQueue.limit
    : PHOTO_LOAD_CONCURRENCY;
  const advancePhotoQueue = () => setPhotoQueue((current) => ({
    key: manifestPhotoKey,
    limit: Math.min(
      items.length,
      (current.key === manifestPhotoKey ? current.limit : PHOTO_LOAD_CONCURRENCY) + 1,
    ),
  }));
  const settlePhoto = (photoKey: string, loaded: boolean) => {
    if (settledPhotos.current.has(photoKey)) return;
    settledPhotos.current.add(photoKey);
    if (loaded) setLoadedPhotos((current) => new Set(current).add(photoKey));
    else setFailedPhotos((current) => new Set(current).add(photoKey));
    advancePhotoQueue();
  };

  const checks = new Map(
    operation.item_checks.map((item) => [item.source_item_id, item]),
  );
  const checked = items.filter((item) => checks.has(item.id)).length;
  const percent = Math.round((checked / items.length) * 100);
  const editable = configured && online && operation.status === "active";

  return (
    <section className="mt-5 border-t border-[#d7dfd9] pt-5" aria-labelledby={`items-${operation.id}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">
            Manifesto de carga
          </p>
          <h4 id={`items-${operation.id}`} className="mt-1 text-xl font-semibold">
            {checked} de {items.length} conferidos
          </h4>
        </div>
        <strong className="text-sm text-[#2d6654]">{percent}%</strong>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-[#e1e7e3]"
        role="progressbar"
        aria-label="Progresso da conferência dos equipamentos"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={checked}
      >
        <span
          className="block h-full rounded-full bg-[#2d7461] transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {!online && (
        <p className="mt-3 rounded-lg bg-[#fff3d1] p-3 text-sm text-[#705817]">
          Conecte o aparelho para atualizar a conferência.
        </p>
      )}
      <ul className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        {items.map((item, itemIndex) => {
          const check = checks.get(item.id);
          const isChecked = Boolean(check);
          const photoKey = `${operation.id}:${photoVersion}:${item.id}`;
          const photoLoaded = loadedPhotos.has(photoKey);
          return (
            <li key={item.id}>
              <label
                className={`grid min-h-28 cursor-pointer grid-cols-[96px_minmax(0,1fr)] overflow-hidden rounded-lg border transition-colors ${
                  isChecked
                    ? "border-[#9fc8b9] bg-[#eef5f1]"
                    : "border-[#d7dfd9] bg-white hover:border-[#aec2b8]"
                } ${!editable || busy ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span className="relative flex min-h-28 flex-col items-center justify-center gap-2 overflow-hidden border-r border-[#d7dfd9] bg-[#edf1ee] px-2 text-center text-[#687970]">
                  {!photoLoaded && (
                    <>
                      <ImageOff size={22} aria-hidden="true" />
                      <small className="text-[11px] leading-tight">
                        {!online
                          ? "Foto exige conexão"
                          : failedPhotos.has(photoKey)
                            ? "Foto não disponível"
                            : itemIndex < photoLoadLimit
                              ? "Carregando foto"
                              : "Foto aguardando carregamento"}
                      </small>
                    </>
                  )}
                  {online && itemIndex < photoLoadLimit && !failedPhotos.has(photoKey) && (
                    <Image
                      unoptimized
                      loading="eager"
                      fill
                      sizes="96px"
                      src={`/api/imperio/item-photo?operationId=${encodeURIComponent(operation.id)}&itemId=${encodeURIComponent(item.id)}&version=${encodeURIComponent(photoVersion)}`}
                      alt={`Foto de ${item.name}`}
                      className="object-cover"
                      onLoad={() => settlePhoto(photoKey, true)}
                      onError={() => settlePhoto(photoKey, false)}
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-col justify-between gap-3 p-3">
                  <span>
                    <strong className="line-clamp-2 block text-[15px] leading-5">{item.name}</strong>
                    <small className="mt-1 block break-all font-mono text-[#687970]">Item {item.itemId}</small>
                  </span>
                  <span className="flex min-h-11 items-center gap-3 border-t border-[#d7dfd9] pt-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!editable || busy}
                      className="size-6 shrink-0 accent-[#2d7461]"
                      onChange={(event) => {
                        const next = event.currentTarget.checked;
                        void run(async () => {
                          await postJson("set-operation-item-checked", {
                            operationId: operation.id,
                            item,
                            checked: next,
                          });
                          await refresh();
                        }, next ? "Item conferido." : "Conferência removida.");
                      }}
                    />
                    <span className="text-sm font-semibold">
                      {isChecked ? (
                        <span className="text-[#285f50]">
                          <Check className="mr-1 inline" size={15} aria-hidden="true" />
                          Conferido
                        </span>
                      ) : "Marcar como conferido"}
                      {check && <small className="mt-0.5 block font-normal text-[#5f7067]">{formatDate(check.checked_at)}</small>}
                    </span>
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {operation.status !== "active" && (
        <p className="mt-3 text-xs text-[#5f7067]">Operação encerrada: checklist preservado somente para consulta.</p>
      )}
    </section>
  );
}
