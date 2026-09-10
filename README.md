# software-house — Ápice

Software house fundada por Felipe (ITA) e Rafael (MIT). Este repositório
contém o site institucional e o sistema de prospecção automática de leads.

Projetos e dados de clientes vivem em repositórios privados próprios.

## Estrutura

```
software-house/
├── AGENTS.md              # Instruções para agentes de IA (leia primeiro)
├── README.md              # Este arquivo
├── .gitignore
│
├── site/                  # Site institucional (Next.js + TypeScript + Tailwind)
│   ├── src/               # Páginas, componentes e dados
│   ├── public/            # Imagens e logos
│   ├── package.json
│   └── ...configs Next.js
│
├── funil/                 # Sistema de prospecção de leads (Scout + Diagnoser)
│   ├── prompts/           # Prompts dos agentes (scout.md, diagnoser.md)
│   ├── scripts/           # scout.py (Apify + IG), run-scout.sh (cron)
│   ├── state/             # dados locais privados, ignorados pelo Git
│   ├── .env.example       # Template APIFY_API_TOKEN
│   └── README.md
│
└── contexto/              # Documentos de negócio (cross-chat)
│   ├── CONTEXT.md         # Quem é a Ápice, serviços, preços, stack
│   ├── STRATEGY.md        # Estratégia de entrada no mercado
│   ├── PLAYBOOK.md        # Scripts de venda, objeções, follow-up
│   └── SALES.md           # Resumo público anonimizado do funil
```

## Começando

Antes de qualquer coisa, leia `AGENTS.md` (raiz) e os documentos em
`contexto/`. Eles dão o contexto completo do negócio.

### Site
```bash
cd site
npm install   # se necessário
npm run dev   # http://localhost:3000
npm run lint
npm run build
```

Deploy: Vercel (Root Directory do projeto Vercel deve apontar para `site/`).

### Funil
```bash
pip3 install apify-client
cp funil/.env.example funil/.env   # preencher APIFY_API_TOKEN
python3 funil/scripts/scout.py --niche all --limit 50
```

Detalhes: `funil/README.md`.
