# QA Agency — Prospecção automática de leads

Sistema de prospecção de médicos e advogados em Salvador (BA) para vendevolvimento de sites, apps, sistemas de agendamento e automação de WhatsApp. Ticket-alvo: R$5k.

## Estrutura

```
ai-agency/
├── prompts/
│   ├── scout.md         # Prompt do agente Scout (busca)
│   └── diagnoser.md     # Prompt do agente Diagnoser (diagnóstico + mensagem)
├── state/
│   ├── leads.csv        # Leads qualificados (gerado pelo Scout)
│   ├── scout.log        # Log de execuções
│   ├── diagnoses/       # Diagnóstico individual por lead
│   └── messages/        # Mensagem de abordagem por lead
├── scripts/
│   ├── scout.py         # Script de prospecção (Apify + Instagram)
│   └── run-scout.sh     # Wrapper para cron
├── .env.example         # Template de variáveis de ambiente
└── README.md            # Este arquivo
```

## Setup

### 1. Dependências
```bash
pip install apify-client
```

### 2. Token do Apify
1. Crie conta em https://console.apify.com
2. Pegue seu API token em https://console.apify.com/account/integrations
3. Copie `.env.example` para `.env` e preencha:
   ```bash
   cp .env.example .env
   # Edite .env e cole seu token
   ```
4. Carregue no ambiente:
   ```bash
   source .env
   ```

> Custo: Apify tem free tier ($5/mês de créditos). O scraper Instagram custa ~$0.30 por 1000 resultados.
> Para 50 leads/semana × 17 keywords = 850 buscas/mês ≈ $0.25/mês. Suficiente no free tier.

### 3. Rodar o Scout
```bash
# Buscar médicos e advogados (50 perfis por keyword)
python scripts/scout.py --niche all --limit 50

# Só médicos
python scripts/scout.py --niche medico --limit 50

# Só advogados
python scripts/scout.py --niche advogado --limit 50

# Ser mais seletivo (score >= 7)
python scripts/scout.py --niche all --limit 50 --min-score 7
```

### 4. Automatizar (cron diário)
```bash
crontab -e
# Adicione:
0 9 * * * /caminho/para/ai-agency/scripts/run-scout.sh
```

## Fluxo de trabalho

```
Scout (diário)
  ↓
leads.csv (score >= 5)
  ↓
[Revisão humana — você aprova]
  ↓
Diagnoser (Claude Code lê scout.md + diagnoser.md)
  ↓
state/diagnoses/@handle.md
state/messages/@handle.txt
  ↓
[Você manda o WhatsApp manualmente]
  ↓
state/approved_leads.md (respostas positivas)
  ↓
Builder (posta) → Lovable / código
```

## Filtros de qualificação (auto-explicativos)

| Critério | Pontos |
|---|---|
| Sem link na bio | +3 |
| Link = Linktree só Zap | +2 |
| Link = site One-page antigo | +2 |
| Link = iFood/social | +2 |
| < 10k seguidores | +1 |
| 10k–50k seguidores | +1 |
| Postou nos últimos 7 dias | +1 |
| WhatsApp na bio | +1 |
| Endereço/Salvador na bio | +1 |
| Especialidade/área na bio | +1 |

**Mínimo para abordar: score >= 5**

## Volume esperado

- 17 keywords × 50 perfis = 850 perfis/busca
- Após filtro de < 100k + ativo: ~300–500 restam
- Após filtro de score >= 5: ~30–80 leads/semana
- Meta: 50 leads/semana abordados manualmente

## Próximos passos (após Scout funcionar)

1. **Diagnoser** (Claude Code + prompt detalhado): para cada lead aprovado, gerar diagnóstico + mensagem de WhatsApp
2. **Builder**: gerar site/landing page de mockup para os top 5 leads/dia
3. **Pitcher**: poner fila de envio (inicialmente manual — depois WhatsApp Business API)
4. **Checker**: revisar mensagens antes do envio (LLM com rubric de anti-spam)

## Compliance

- ❌ Não enviar mensagem genérica/massa — sempre personalizada
- ✅ Rigor: verificar se realmente não têm site (não só por "não tem link na bio")
- ✅ Respeitar horário comercial (9h–18h)
- ✅ Não usar listas compradas/arquivoid de emails
- ✅ Respeitar LGPD se coletar dados pessoais
- ✅ Não mentir sobre competidores ou 错误de dados