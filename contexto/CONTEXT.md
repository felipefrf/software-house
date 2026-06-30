# Contexto da Software House (Ápice)

> Documento cross-chat: carregue este arquivo no início de qualquer
> conversa sobre a software house para dar contexto ao agente.

## Quem somos

**Ápice** é uma software house de dois irmãos — Felipe e Rafael.

- **Felipe** — ITA (Engenharia). Lida com o lado comercial, prospecção e的关系. Prefere comunicação por X (Twitter). Não tem medo de abordagem fria.
- **Rafael** — MIT (Engenharia/CS). Lida com o lado técnico, arquitetura e implementação. Curte sistemas complexos, IA e vision.

Formação de elite (ITA + MIT) é o diferencial de posicionamento. Usar em
toda comunicação externa: *"Enquanto outras software houses terceirizam o
código, a gente escreve e arquiteta."*

## O que vendemos

6 serviços (espelham `site/src/data/services.ts`):

1. **Agentes de IA & Chatbots** — WhatsApp/web/email, negociação autônoma,
   integração com CRM
2. **Automação de Processos** — documentos, emails, formulários, dashboards
3. **Sites & Aplicações Web** — landing pages, portais, dashboards
4. **Dados & Inteligência** — extração, relatórios, análise competitiva
5. **Visão Computacional** — inspeção, detecção, processamento de vídeo
6. **Sistemas Sob Medida** — do zero, APIs, modernização

## Precificação

| Tipo | Faixa |
|---|---|
| Site institucional + landing | R$ 5-15K |
| Automação de processo | R$ 10-40K |
| Sistema web completo | R$ 30-100K |
| Agente de IA / chatbot | R$ 15-60K |

Sempre em 3 marcos: 40% / 30% / 30%. Nunca abaixo de R$ 5K.

## Stack técnica

- Next.js (App Router) + TypeScript + Tailwind
- Vercel (deploy)
- Python (scripts de automação/scraping)
- Apify (scraping Instagram/Google Maps)

## Repositório

```
/Users/felipefrf/development/personal/software-house
├── site/                   # Site da Ápice (Next.js)
│   ├── src/app/            # Páginas
│   ├── src/components/    # Hero, Services, Portfolio, Contact...
│   └── src/data/           # services.ts, projects.ts
├── funil/                  # Sistema de prospecção (Scout + Diagnoser)
│   ├── prompts/            # scout.md, diagnoser.md
│   ├── scripts/            # scout.py (Apify + IG)
│   └── state/              # leads.csv, diagnoses/, messages/
├── contexto/              # Docs de negócio (cross-chat)
│   ├── CONTEXT.md          # Este arquivo
│   ├── STRATEGY.md         # Estratégia de entrada no mercado
│   ├── PLAYBOOK.md         # Scripts de venda
│   └── SALES.md            # Funil e KPIs
```

## Próximos passos do negócio

1. Fechar primeiros 2-3 contratos (foco: clínicas e advogados em Salvador)
2. Validar mensagem de abordagem e ticket-alvo (R$5k inicial)
3. Escalar prospecção automatizada (Scout rodando diário via cron)
4. Iniciar retainers de manutenção (~R$2-8K/mês por cliente)
5. Em 12-24 meses: transformar padrão recorrente em SaaS

## Documentos relacionados

- `contexto/STRATEGY.md` — estratégia completa de entrada no mercado
- `contexto/PLAYBOOK.md` — playbook de vendas (mensagens, objeções, follow-up)
- `contexto/SALES.md` — funil atual, KPIs, deals
- `funil/README.md` — documentação do sistema de prospecção
- `.claude/pending.md` — pendências abertas entre sessões