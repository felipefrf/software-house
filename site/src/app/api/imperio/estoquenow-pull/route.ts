import { NextResponse } from "next/server";

import {
  inspectEstoqueNowOperations,
  readEstoqueNowItems,
} from "@/app/imperio/logistica/data";
import {
  beginEstoqueNowSyncRun,
  confirmEstoqueNowCandidate,
  failEstoqueNowSyncRun,
  finishEstoqueNowSyncRun,
  isAuthorizedEstoqueNowPull,
  loadEstoqueNowQuarantine,
  loadExistingEstoqueNowOperationsForPull,
  readEstoqueNowPullConfig,
  recordEstoqueNowDetailFailure,
  runEstoqueNowPull,
  shouldContinueEstoqueNowDrain,
  type EstoqueNowPullResult,
  type EstoqueNowSyncDatabase,
} from "@/app/imperio/logistica/estoquenow-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedEstoqueNowPull(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  ))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let config;
  try {
    config = readEstoqueNowPullConfig(process.env);
  } catch {
    return NextResponse.json(
      { ok: false, error: "incremental_pull_configuration_invalid" },
      { status: 503 },
    );
  }

  if (!config.enabled)
    return NextResponse.json({
      ok: true,
      status: "disabled",
      mode: "disabled",
      startDate: config.startDate,
      endDate: config.endDate,
      batchSize: config.batchSize,
    });

  const admin = createSupabaseAdminClient();
  if (!admin)
    return NextResponse.json(
      { ok: false, error: "incremental_pull_database_unavailable" },
      { status: 503 },
    );
  const database = admin as unknown as EstoqueNowSyncDatabase;

  let claimedRunId: string | null = null;
  try {
    const startedAt = Date.now();
    let completedRuns = 0;
    let imported = 0;
    let updated = 0;
    let reconciled = 0;
    let failed = 0;
    let result: EstoqueNowPullResult | undefined;

    do {
      const claim = await beginEstoqueNowSyncRun(database, config);
      if (!claim.started) {
        if (result) break;
        return NextResponse.json({
          ok: true,
          status: claim.status,
          mode: config.applyEnabled ? "apply" : "observe",
          startDate: config.startDate,
          endDate: config.endDate,
          batchSize: claim.batchLimit,
        });
      }
      if (!claim.runId) throw new Error("ESTOQUENOW_SYNC_BEGIN_CONTRACT_INVALID");
      claimedRunId = claim.runId;
      result = await runEstoqueNowPull(config, {
        inspectOperations: inspectEstoqueNowOperations,
        loadExisting: (externalIds) =>
          loadExistingEstoqueNowOperationsForPull(database, externalIds),
        loadQuarantined: (candidates) =>
          loadEstoqueNowQuarantine(database, candidates),
        readItems: readEstoqueNowItems,
        recordDetailFailure: (input) =>
          recordEstoqueNowDetailFailure(database, { ...input, runId: claim.runId! }),
        confirm: (input) =>
          confirmEstoqueNowCandidate(database, { ...input, runId: claim.runId! }),
      });
      await finishEstoqueNowSyncRun(database, claim.runId, result);
      claimedRunId = null;
      completedRuns += 1;
      imported += result.counts.imported;
      updated += result.counts.updated;
      reconciled += result.counts.reconciled;
      failed += result.counts.failed;
    } while (shouldContinueEstoqueNowDrain(result, completedRuns, Date.now() - startedAt));

    if (!result) throw new Error("ESTOQUENOW_SYNC_RESULT_MISSING");
    return NextResponse.json(
      {
        ok: result.status !== "failed",
        status: result.status,
        mode: result.mode,
        startDate: result.startDate,
        endDate: result.endDate,
        batchSize: result.batchSize,
        counts: result.counts,
        drain: { runs: completedRuns, imported, updated, reconciled, failed },
      },
      { status: result.status === "failed" ? 502 : 200 },
    );
  } catch {
    if (claimedRunId) {
      try {
        await failEstoqueNowSyncRun(database, claimedRunId, "internal");
      } catch {
        // The route response stays sanitized; the unfinished run remains visible to health checks.
      }
    }
    return NextResponse.json(
      { ok: false, error: "incremental_pull_failed" },
      { status: 502 },
    );
  }
}
