# AGENTS.md — Instruções para agentes de IA trabalhando neste repositório

> Carregue este arquivo no início de qualquer conversa sobre o
> repositório `software-house`.

## Contexto essencial (ler primeiro)

Antes de tocar em qualquer coisa, leia (todos em `contexto/`):
1. `contexto/CONTEXT.md` — quem é a Ápice, o que vende, precificação, stack
2. `contexto/STRATEGY.md` — estratégia de entrada no mercado
3. `contexto/PLAYBOOK.md` — playbook de vendas (mensagens, objeções, follow-up)
4. `contexto/SALES.md` — funil atual, KPIs, deals
5. `.claude/pending.md` — pendências abertas entre sessões
6. `funil/README.md` — sistema de prospecção Scout + Diagnoser

## Estrutura do repositório

```
software-house/
├── AGENTS.md              # Este arquivo (instruções para agentes)
├── README.md              # Overview do repo
├── .gitignore
│
├── site/                  # Site institucional da Ápice (Next.js)
│   ├── src/               # páginas, componentes, dados
│   ├── public/            # imagens e logos
│   └── ...configs Next.js (package.json, tsconfig, etc.)
│
├── funil/                 # Sistema de prospecção de leads
│   ├── prompts/           # prompts dos agentes (scout.md, diagnoser.md)
│   ├── scripts/           # scout.py (Apify + IG), run-scout.sh
│   ├── state/             # leads.csv, diagnoses/, messages/ (gitignored)
│   ├── .env.example       # template APIFY_API_TOKEN
│   └── README.md
│
├── contexto/              # Docs de negócio (cross-chat)
│   ├── CONTEXT.md
│   ├── STRATEGY.md
│   ├── PLAYBOOK.md
│   └── SALES.md
│
└── .claude/
    └── pending.md
```

### 1. Site da Ápice (`site/`)
Next.js 14 (App Router) + TypeScript + Tailwind 4.
Deploy: Vercel (Root Directory = `site/`).

- `site/src/app/` — páginas
- `site/src/components/` — Hero, Services, Portfolio, Contact...
- `site/src/data/` — `services.ts` (6 serviços), `projects.ts` (portfólio)

**Não confundir estrutura do site com estrutura do negócio.**

### 2. Sistema de prospecção (`funil/`)
Automação de leads (médicos + advogados em Salvador).

### 3. Documentação de negócio (`contexto/`)
Documentos cross-chat — carregue em qualquer sessão sobre vendas/estratégia.

## Convenções

### Código (site/)
- TypeScript estrito. Sem `any`. Sem `@ts-ignore`.
- Tailwind para estilo. Sem CSS modules.
- Componentes server por default; `"use client"` só quando necessário.
- Lucide icons (ver `site/src/data/services.ts` para padrão).

### Python (funil/)
- Python 3.9+ (macOS default).
- `pip3 install` em user space (não tem venv configurado — pode criar).
- Tipo hints em todas as funções públicas.
- Carregar `.env` via helper próprio (não depende de `source`).

### Variáveis de ambiente
- `.env` **nunca** deve ser commitado. `.gitignore` já cobre `.env*`.
- Tokens (Apify etc.) vão em `funil/.env`, nunca hardcoded.

## Comandos úteis

### Site
```bash
cd site
npm install            # se necessário
npm run dev           # http://localhost:3000
npm run build         # build de produção
npm run lint          # ESLint (Next config)
```

### Prospecção
```bash
pip3 install apify-client
cp funil/.env.example funil/.env   # preencher APIFY_API_TOKEN
python3 funil/scripts/scout.py --niche medico --limit 30
python3 funil/scripts/scout.py --niche advogado --limit 30
python3 funil/scripts/scout.py --niche all --limit 50
```

## Estado atual (Jun 2026)

- Site da Ápice: rodando em Vercel. **Atenção**: após reorganização de
  pastas, a "Root Directory" do projeto Vercel deve apontar para `site/`.
- Sistema Scout: funcional — busca N perfis/keyword, classifica com
  score 0-10, filtra Salvador/BA, escreve em `funil/state/leads.csv`.
- Diagnoser: prompt pronto (`funil/prompts/diagnoser.md`), ainda não
  automatizado (gera mensagem manualmente via Claude Code).
- Pendências: ver `.claude/pending.md`.

## Papéis

- **Felipe (ITA)** — comercial, prospecção, atendimento ao cliente,
  X (Twitter). Fala com leads via WhatsApp.
- **Rafael (MIT)** — técnico, arquitetura, implementação,
  visão computacional, IA.

Os agentes às vezes falam com ambos — identificar o interlocutor pelo
contexto da mensagem.

## Não fazer

- ❌ Commitar `.env` com tokens reais
- ❌ Commitar dados de leads (`funil/state/leads.csv` etc. — já no .gitignore)
- ❌ Publicar dados de leads (são pré-clientes)
- ❌ Commitar mudanças no `site/` sem rodar `npm run lint` (rodar de dentro de `site/`)
- ❌ Adicionar emojis em código ou markdown (instrução do usuário)
- ❌ Criar arquivos de documentação sem solicitação explicit

## Quando uma pendência for resolvida

Editar `.claude/pending.md` e trocar `- [ ]` por `- [x]`.
O statusline ignora `- [x]` automaticamente.