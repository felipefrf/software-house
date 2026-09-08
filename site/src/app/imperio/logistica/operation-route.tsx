"use client";

import { useEffect, useState } from "react";
import { Button, mapsPointUrl } from "./ui";

type RouteSnapshot = {
  session: { id: string; consented_at: string; stopped_at: string | null } | null;
  points: Array<{ id: string; device_captured_at: string; latitude: number; longitude: number; accuracy: number; mocked: boolean }>;
  truncated: boolean;
};

const when = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function OperationRoute({ operationId }: { operationId: string }) {
  const [data, setData] = useState<RouteSnapshot | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let disposed = false;
    let pending = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (document.hidden || pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 15_000);
      try {
        const response = await fetch(`/api/imperio/operation-route?operationId=${encodeURIComponent(operationId)}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) {
          if (!disposed && [401, 403, 404].includes(response.status)) setData(null);
          throw new Error("Não foi possível atualizar a localização. Verifique sua sessão e tente novamente.");
        }
        const snapshot: RouteSnapshot = await response.json();
        if (!snapshot || typeof snapshot.truncated !== "boolean" || !Array.isArray(snapshot.points)
          || snapshot.points.length > 100
          || (snapshot.session === null ? snapshot.points.length !== 0
            : !snapshot.session || typeof snapshot.session.id !== "string"
              || !Number.isFinite(Date.parse(snapshot.session.consented_at))
              || (snapshot.session.stopped_at !== null && !Number.isFinite(Date.parse(snapshot.session.stopped_at))))
          || snapshot.points.some(point => !point || typeof point.id !== "string"
            || !Number.isFinite(Date.parse(point.device_captured_at))
            || !Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90
            || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180
            || !Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > 1_000
            || typeof point.mocked !== "boolean"))
          throw new Error("O servidor retornou uma localização inválida. Tente novamente.");
        if (!disposed) { setData(snapshot); setError(""); setNow(Date.now()); }
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error && failure.name !== "AbortError"
          ? failure.message : "A consulta demorou demais. Tente novamente.");
      } finally { window.clearTimeout(timeout); pending = false; }
    };
    void load();
    const interval = window.setInterval(() => { setNow(Date.now()); void load(); }, 30_000);
    const onVisible = () => { void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true; controller?.abort(); window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [operationId, attempt]);
  const point = data?.points[0];
  const stale = point && now - Date.parse(point.device_captured_at) > 5 * 60_000;
  return <section className="mt-5 border-t border-imp-line pt-4" aria-label="Localização da equipe">
    <h3 className="text-[17px] font-semibold">Localização da equipe</h3>
    <p className="mt-1 text-[13px] text-imp-muted">GPS do app de campo, não do EstoqueNOW. Consulta a cada 30 segundos enquanto esta tela estiver visível.</p>
    {error && <div role="alert" className="mt-3 text-sm text-imp-amber">
      <p>{error} {data && "Os dados abaixo são da última consulta recebida."}</p>
      <Button className="mt-2" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button>
    </div>}
    {!data && !error && <p role="status" className="mt-3 text-sm text-imp-muted">Consultando localização…</p>}
    {data && !point && <p className="mt-3 text-sm text-imp-muted">{data.session ? "Sessão registrada, ainda sem posições recebidas." : "Nenhuma rota registrada pelo app nesta operação."}</p>}
    {point && <>
      <p className={`mt-3 text-[15px] font-semibold ${stale && !data?.session?.stopped_at ? "text-imp-amber" : "text-imp-ink"}`}>
        {data?.session?.stopped_at ? "Rastreamento encerrado" : stale ? "Posição sem atualização há mais de 5 minutos" : "Posição recebida recentemente"}
      </p>
      <p className="mt-1 text-sm tabular-nums text-imp-muted">Capturada em {when(point.device_captured_at)} · precisão aproximada de {Math.round(point.accuracy)} m{point.mocked ? " · localização simulada" : ""}</p>
      <a href={mapsPointUrl(point.latitude, point.longitude)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-imp-green underline">Abrir última posição no Google Maps</a>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer py-3 font-semibold">Posições da última sessão ({data!.points.length}{data!.truncated ? "+" : ""})</summary>
        <p className="mb-2 text-imp-muted">{data!.truncated ? "Exibindo somente as 100 posições mais recentes." : "Mais recentes primeiro."} Horários de Brasília. Abrir o mapa compartilha a posição com o Google.</p>
        <ol className="max-h-64 overflow-y-auto divide-y divide-imp-line">
          {data!.points.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="tabular-nums text-imp-muted">{when(item.device_captured_at)} · {Math.round(item.accuracy)} m{item.mocked ? " · simulada" : ""}</span>
            <a className="inline-flex min-h-11 items-center font-semibold text-imp-green underline" href={mapsPointUrl(item.latitude, item.longitude)} target="_blank" rel="noreferrer" aria-label={`Abrir posição de ${when(item.device_captured_at)} no Google Maps`}>Ver no mapa</a>
          </li>)}
        </ol>
      </details>
    </>}
  </section>;
}
