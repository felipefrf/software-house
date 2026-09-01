import { Hero } from "@/components/Hero";
import { TechMarquee } from "@/components/TechMarquee";
import { Services } from "@/components/Services";
import { Portfolio } from "@/components/Portfolio";
import { About } from "@/components/About";
import { Contact } from "@/components/Contact";
import { redirect } from "next/navigation";

export default function Home() {
  if (process.env.IMPERIO_DEPLOYMENT === "true") {
    redirect("/imperio/logistica");
  }

  return (
    <>
      <Hero />
      <TechMarquee />
      <Services />
      <Portfolio />
      <About />
      <Contact />
    </>
  );
}
