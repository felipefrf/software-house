import {
  CreditCard,
  MessageSquare,
  FileText,
  BarChart3,
  Globe,
  Eye,
  type LucideIcon,
} from "lucide-react";

export type ProjectVisualKey =
  | "payroll"
  | "whatsapp"
  | "credit"
  | "legal"
  | "scraper"
  | "sec";

export interface ProjectMetric {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
}

export interface Project {
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  icon: LucideIcon;
  highlight?: string;
  visual: ProjectVisualKey;
  metric: ProjectMetric;
  accent: string;
}

export const projects: Project[] = [
  {
    title: "Portal de Folha de Pagamento",
    subtitle: "Centenas de funcionários, zero dor de cabeça",
    description:
      "Construímos do zero o portal de gestão de folha de pagamento de uma das maiores fintechs do Brasil. Onboarding de funcionários, cálculo de impostos, holerites e relatórios de compliance. Tudo integrado e funcionando para centenas de pessoas, todo mês, sem falha.",
    tags: ["Next.js", "PostgreSQL", "FinTech"],
    icon: CreditCard,
    highlight: "Centenas de usuários ativos todo mês",
    visual: "payroll",
    accent: "#0A2473",
    metric: {
      value: 99.9,
      suffix: "%",
      decimals: 1,
      label: "Uptime mensal",
    },
  },
  {
    title: "Agente de Renegociação via WhatsApp",
    subtitle: "Negociação que não dorme",
    description:
      "Criamos um agente de IA que conversa com clientes inadimplentes pelo WhatsApp, analisa o histórico de cada um, propõe o melhor plano de pagamento e fecha o acordo. Roda 24 horas por dia, 7 dias por semana. O time financeiro só recebe os casos resolvidos.",
    tags: ["IA", "WhatsApp", "Automação"],
    icon: MessageSquare,
    highlight: "Negociação autônoma 24/7",
    visual: "whatsapp",
    accent: "#A31F34",
    metric: {
      value: 24,
      suffix: "h",
      label: "Negociando todo dia",
    },
  },
  {
    title: "Pipeline de Análise de Crédito",
    subtitle: "De 4 horas para 20 minutos",
    description:
      "Automatizamos a coleta e análise de dados de crédito de múltiplos provedores. O que antes levava 4 horas de um analista sênior agora sai em 20 minutos, com mais precisão e zero trabalho manual. A equipe de crédito passou a analisar 5x mais casos.",
    tags: ["Dados", "Crédito", "ETL"],
    icon: BarChart3,
    highlight: "Redução de 90% no tempo de análise",
    visual: "credit",
    accent: "#0A2473",
    metric: {
      value: 90,
      suffix: "%",
      label: "Menos tempo de análise",
    },
  },
  {
    title: "Triagem Automática de Documentos Jurídicos",
    subtitle: "Um funcionário inteiro substituído",
    description:
      "Um escritório recebia centenas de intimações e ofícios por email todo dia. Uma pessoa passava o dia inteiro só separando o que era relevante. Construímos uma IA que lê, classifica e encaminha cada documento automaticamente. A pessoa agora faz trabalho de verdade.",
    tags: ["IA", "Documentos", "Jurídico"],
    icon: FileText,
    highlight: "100% de automação na triagem",
    visual: "legal",
    accent: "#A31F34",
    metric: {
      value: 100,
      suffix: "%",
      label: "Automação na triagem",
    },
  },
  {
    title: "Analisador Competitivo Web",
    subtitle: "Saiba exatamente o que seus concorrentes fazem",
    description:
      "Desenvolvemos uma ferramenta que analisa automaticamente os sites dos principais concorrentes: design, copy, táticas de conversão, posicionamento. Os dados alimentam um modelo que melhora continuamente a performance dos sites gerados. Inteligência de mercado, automatizada.",
    tags: ["Web Scraping", "Análise", "Python"],
    icon: Globe,
    highlight: "Inteligência competitiva em escala",
    visual: "scraper",
    accent: "#0A2473",
    metric: {
      value: 50,
      suffix: "+",
      label: "Concorrentes monitorados",
    },
  },
  {
    title: "Analisador de Relatórios Financeiros (SEC)",
    subtitle: "Horas de leitura viram minutos",
    description:
      "Gestores de portfólio precisavam ler dezenas de relatórios 10-K de empresas americanas antes de cada reunião com investidores. Automatizamos o processo: o sistema lê, resume dados financeiros e de risco, e entrega tudo estruturado numa planilha. O que levava horas, agora leva minutos.",
    tags: ["NLP", "Finanças", "Google Sheets"],
    icon: Eye,
    highlight: "De horas para minutos por análise",
    visual: "sec",
    accent: "#A31F34",
    metric: {
      value: 95,
      suffix: "%",
      label: "Tempo economizado",
    },
  },
];
