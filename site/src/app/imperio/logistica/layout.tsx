import { IBM_Plex_Sans } from "next/font/google";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-imperio-body",
  display: "swap",
});

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
