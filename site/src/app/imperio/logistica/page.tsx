import type { Metadata, Viewport } from "next";

import { getAppSnapshot } from "./server";
import { LogisticsWorkspace } from "./workspace";

export const metadata: Metadata = {
  title: "Logística | Império Eventos",
  description: "Torre de controle e operação guiada da Império Eventos.",
  manifest: "/imperio/logistica.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Império Logística",
  },
  icons: {
    apple: "/imperio/logistica-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#173d34",
};

export const dynamic = "force-dynamic";

export default async function LogisticsPage() {
  return <LogisticsWorkspace initialSnapshot={await getAppSnapshot()} />;
}
