"use client";

import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

import { operationStages, stageLabels, stageState } from "./action";
import type { Operation, OperationStage } from "./types";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

export function StageRail({
  operation,
  selectedStage,
  onStageSelect,
}: {
  operation: Operation;
  selectedStage?: OperationStage;
  onStageSelect?: (stage: OperationStage) => void;
}) {
  const current = operationStages.indexOf(operation.stage);
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);
  const stages = operationStages.map((stage, index) => {
    const event = operation.events.find(
      (item) => item.stage === stage && item.event_type === "stage_completed",
    );
    const state = stageState(index, current, operation.status, Boolean(event));
    const referenceTime = event?.server_received_at ??
      (state === "active" ? operation.stage_started_at : null);
    return { index, referenceTime, stage, state };
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    const active = currentRef.current;
    if (!viewport || !active) return;
    const viewportBox = viewport.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    viewport.scrollLeft = Math.max(
      0,
      viewport.scrollLeft +
        activeBox.left -
        viewportBox.left -
        (viewport.clientWidth - active.clientWidth) / 2,
    );
  }, [operation.id, operation.stage]);

  return (
    <div className="mt-5 min-w-0">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">
            Etapa {current + 1} de {operationStages.length}
          </p>
          <strong className="text-sm">{stageLabels[operation.stage]}</strong>
        </div>
        <span className="text-xs text-[#5f7067]">
          {onStageSelect ? "Selecione uma etapa" : "Deslize para ver todas"}
        </span>
      </div>

      <div
        className="mt-3 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${operationStages.length}, minmax(0, 1fr))`,
        }}
        aria-hidden="true"
      >
        {stages.map(({ stage, state }) => {
          return (
            <span
              key={stage}
              className={`h-1.5 rounded-full ${
                state === "done"
                  ? "bg-[#2d7461]"
                  : state === "active"
                    ? "bg-[#5b4bcc]"
                    : "bg-[#d5dcd8]"
              }`}
            />
          );
        })}
      </div>

      <div
        ref={viewportRef}
        data-stage-rail-viewport
        className="mt-3 max-w-full overflow-x-auto px-4 pb-2 pt-1"
      >
        <ol
          className="grid w-max min-w-full gap-2 scroll-smooth"
          style={{
            gridTemplateColumns: `repeat(${operationStages.length}, minmax(88px, 1fr))`,
          }}
          aria-label="Etapas da operação"
        >
          {stages.map(({ index, referenceTime, stage, state }) => {
            const done = state === "done";
            const active = state === "active";
            const stateText = done
              ? "Concluída"
              : active
                ? "Etapa atual"
                : "Aguardando";
            const content = (
              <>
                <span
                  className={`mx-auto grid size-11 place-items-center rounded-full border-2 text-xs font-bold ${
                    done
                      ? "border-[#287258] bg-[#e8f3ef] text-[#287258]"
                      : active
                        ? "border-[#5b4bcc] bg-[#5b4bcc] text-white ring-4 ring-[#ebe8fb]"
                        : "border-[#d5dcd8] bg-white text-[#5f7067]"
                  }`}
                >
                  {done ? <Check size={16} /> : index + 1}
                </span>
                <span className="mt-2 block text-xs font-medium">
                  {stageLabels[stage]}
                </span>
                <time
                  className="mt-1 block font-mono text-xs tabular-nums text-[#5f7067]"
                  dateTime={referenceTime ?? undefined}
                >
                  {referenceTime ? timeFormatter.format(new Date(referenceTime)) : "--:--"}
                </time>
                <span className="mt-0.5 block text-xs text-[#5f7067]">{stateText}</span>
              </>
            );
            return (
              <li
                ref={index === current ? currentRef : undefined}
                className="min-w-0 text-center"
                key={stage}
              >
                {onStageSelect ? (
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    aria-pressed={selectedStage === stage}
                    onClick={() => onStageSelect(stage)}
                    className={`w-full rounded-lg px-1 pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b4bcc] ${
                      selectedStage === stage ? "bg-[#f3f0fd]" : ""
                    }`}
                  >
                    {content}
                  </button>
                ) : (
                  <div aria-current={active ? "step" : undefined}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
