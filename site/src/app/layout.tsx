import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ápice | Software de Elite",
  description: "Dois irmãos engenheiros do ITA e do MIT. Construímos software que faz diferença: agentes de IA, automação, sites e sistemas completos.",
  keywords: ["software house", "automação", "agentes de IA", "desenvolvimento web", "ITA", "MIT", "Brasil"],
  openGraph: { title: "Ápice | Software de Elite", description: "Dois irmãos engenheiros do ITA e do MIT.", type: "website", locale: "pt_BR" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}>
      <body className="min-h-full flex flex-col bg-[#faf9f7] text-[#1a1a1a]">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
