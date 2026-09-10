import {
  Bot,
  Workflow,
  Globe,
  Database,
  Eye,
  Cpu,
  type LucideIcon,
} from "lucide-react";

export interface Service {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
}

export const services: Service[] = [
  {
    title: "Agentes de IA & Chatbots",
    description:
      "Criamos agentes que atendem, negociam e convertem clientes sozinhos. Seu time para de perder tempo com conversas repetitivas e passa a focar no que realmente importa.",
    icon: Bot,
    features: [
      "WhatsApp, web e email",
      "Negociação autônoma com fechamento de acordos",
      "Integração com seu CRM e base de dados",
      "Transferência inteligente para humano quando necessário",
    ],
  },
  {
    title: "Automação de Processos",
    description:
      "Aquela tarefa que consome horas do seu time todo dia? A gente automatiza. Processamento de documentos, extração de dados, geração de relatórios. Tudo rodando sem ninguém precisar tocar.",
    icon: Workflow,
    features: [
      "Documentos, emails e formulários automatizados",
      "Integração entre sistemas que não conversam",
      "Dashboards que se atualizam sozinhos",
      "Disparo automático baseado em eventos reais",
    ],
  },
  {
    title: "Sites & Aplicações Web",
    description:
      "Da landing page que vende até o dashboard que seu cliente usa todo dia. Tudo rápido, responsivo e bonito. Seu negócio merece uma presença digital que converte.",
    icon: Globe,
    features: [
      "Sites institucionais e landing pages",
      "Portais e dashboards interativos",
      "Performance e SEO de ponta",
      "Design que funciona em qualquer tela",
    ],
  },
  {
    title: "Dados & Inteligência",
    description:
      "Seus concorrentes estão deixando dados valiosos na mesa. A gente coleta, estrutura e transforma isso em decisões melhores para o seu negócio.",
    icon: Database,
    features: [
      "Extração de dados em escala",
      "Relatórios financeiros automatizados",
      "Análise competitiva a partir de dados públicos",
      "Painéis que mostram o que importa",
    ],
  },
  {
    title: "Visão Computacional",
    description:
      "Sistemas que enxergam padrões onde o olho humano não alcança. Inspeção de qualidade, detecção de objetos, análise de imagem em tempo real. Machine learning aplicado de verdade.",
    icon: Eye,
    features: [
      "Detecção e classificação de objetos",
      "Inspeção visual automatizada",
      "Processamento de vídeo ao vivo",
      "Modelos treinados para o seu caso",
    ],
  },
  {
    title: "Sistemas Sob Medida",
    description:
      "Seu negócio tem uma necessidade que nenhum software pronto resolve? A gente projeta do zero. Arquitetura, desenvolvimento e entrega. Simples assim.",
    icon: Cpu,
    features: [
      "Sistemas completos do zero",
      "APIs e integrações complexas",
      "Modernização do que você já tem",
      "Pronto para crescer com você",
    ],
  },
];
