import type { Metadata } from "next";

import { getAppSnapshot } from "./server";
import { LogisticsWorkspace } from "./workspace";

export const metadata: Metadata = {
  title: "Logística | Império Eventos",
  description: "Torre de controle e operação guiada da Império Eventos.",
};

export const dynamic = "force-dynamic";

export default async function LogisticsPage() {
  return <LogisticsWorkspace initialSnapshot={await getAppSnapshot()} />;
}
