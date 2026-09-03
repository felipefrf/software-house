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
  loadExistingEstoqueNowOperationsForPull,
  readEstoqueNowPullConfig,
  runEstoqueNowPull,
  type EstoqueNowSyncDatabase,
} from "@/app/imperio/logistica/estoquenow-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const claim = await beginEstoqueNowSyncRun(database, config);
    if (!claim.started)
      return NextResponse.json({
        ok: true,
        status: claim.status,
        mode: config.applyEnabled ? "apply" : "observe",
        startDate: config.startDate,
        endDate: config.endDate,
        batchSize: claim.batchLimit,
      });
    if (!claim.runId) throw new Error("ESTOQUENOW_SYNC_BEGIN_CONTRACT_INVALID");
    claimedRunId = claim.runId;
    const result = await runEstoqueNowPull(config, {
      inspectOperations: inspectEstoqueNowOperations,
      loadExisting: (externalIds) =>
        loadExistingEstoqueNowOperationsForPull(database, externalIds),
      readItems: readEstoqueNowItems,
      confirm: (input) =>
        confirmEstoqueNowCandidate(database, { ...input, runId: claim.runId! }),
    });
    await finishEstoqueNowSyncRun(database, claim.runId, result);
    return NextResponse.json(
      {
        ok: result.status !== "failed",
        status: result.status,
        mode: result.mode,
        startDate: result.startDate,
        endDate: result.endDate,
        batchSize: result.batchSize,
        counts: result.counts,
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
