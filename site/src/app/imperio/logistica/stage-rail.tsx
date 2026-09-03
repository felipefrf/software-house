"use client";

import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

import { operationStages, stageLabels, stageState } from "./action";
import type { Operation, OperationStage } from "./types";
import { formatTime } from "./ui";

/**
 * Rota da operação: nove marcos ligados por uma linha. Concluídos em verde,
 * atual em tinta com anel, futuros vazados. Rola horizontalmente quando não cabe.
 */
export function StageRail({
  operation,
  selectedStage,
  onStageSelect,
  compact = false,
}: {
  operation: Operation;
  selectedStage?: OperationStage;
  onStageSelect?: (stage: OperationStage) => void;
  compact?: boolean;
}) {
  const current = operationStages.indexOf(operation.stage);
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);
  const stages = operationStages.map((stage, index) => {
    const event = operation.events.find(
      (item) => item.stage === stage && item.event_type === "stage_completed",
    );
    const state = stageState(index, current, operation.status, Boolean(event));
    const referenceTime =
      event?.server_received_at ?? (state === "active" ? operation.stage_started_at : null);
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
      viewport.scrollLeft + activeBox.left - viewportBox.left - (viewport.clientWidth - active.clientWidth) / 2,
    );
  }, [operation.id, operation.stage]);

  const nodeSize = compact ? "size-8 text-[13px]" : "size-10 text-[15px]";
  const minCol = compact ? 76 : 96;

  return (
    <div ref={viewportRef} className={`imp-scroll-x -mx-1 max-w-full overflow-x-auto px-1 pb-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]`}>
      <ol
        className="relative grid w-max min-w-full"
        style={{ gridTemplateColumns: `repeat(${operationStages.length}, minmax(${minCol}px, 1fr))` }}
        aria-label={`Rota da operação, etapa ${current + 1} de ${operationStages.length}`}
      >
        {stages.map(({ index, referenceTime, stage, state }) => {
          const done = state === "done";
          const active = state === "active";
          const stateText = done ? "Concluída" : active ? "Etapa atual" : "Aguardando";
          const lineLeft = index > 0 ? (stages[index - 1].state === "done" ? "bg-imp-green" : "bg-imp-line-strong") : "bg-transparent";
          const lineRight =
            index < stages.length - 1 ? (done ? "bg-imp-green" : "bg-imp-line-strong") : "bg-transparent";
          const content = (
            <>
              <span className="relative block h-10">
                <span aria-hidden="true" className={`absolute left-0 right-1/2 top-1/2 h-0.5 -translate-y-1/2 ${lineLeft}`} />
                <span aria-hidden="true" className={`absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 ${lineRight}`} />
                <span
                  className={`absolute left-1/2 top-1/2 grid ${nodeSize} -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 font-imp-display font-semibold ${
                    done
                      ? "border-imp-green bg-imp-green text-white"
                      : active
                        ? "border-imp-ink bg-imp-ink text-white ring-4 ring-imp-ink/12"
                        : "border-imp-line-strong bg-imp-surface text-imp-muted"
                  }`}
                >
                  {done ? <Check size={compact ? 14 : 17} strokeWidth={3} aria-hidden="true" /> : index + 1}
                  <span className="sr-only">{stateText}</span>
                </span>
              </span>
              <span className={`mt-1.5 block text-[13px] leading-4 ${active ? "font-semibold text-imp-ink" : done ? "font-medium text-imp-ink" : "text-imp-muted"}`}>
                {stageLabels[stage]}
              </span>
              {!compact && (
                <time className="mt-0.5 block text-[13px] tabular-nums text-imp-muted" dateTime={referenceTime ?? undefined}>
                  {referenceTime ? formatTime(referenceTime) : "—"}
                </time>
              )}
            </>
          );
          return (
            <li ref={index === current ? currentRef : undefined} className="min-w-0 text-center" key={stage}>
              {onStageSelect ? (
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  aria-pressed={selectedStage === stage}
                  onClick={() => onStageSelect(stage)}
                  className={`w-full rounded-xl pb-2 pt-1 ${selectedStage === stage ? "bg-imp-ground" : "hover:bg-imp-ground/70"}`}
                >
                  {content}
                </button>
              ) : (
                <div aria-current={active ? "step" : undefined} className="pb-1 pt-1">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
