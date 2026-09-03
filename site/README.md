This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## EstoqueNOW

O harness aceita apenas GETs logísticos em allowlist, nunca imprime o token e
substitui valores da resposta por tipos e formatos. Ele é a ferramenta de
diagnóstico; a torre usa o mesmo cliente server-only para prévia, detalhe e
importação no Postgres da Império.

```bash
npm run estoquenow:readonly -- self-test

# Crie site/.env.estoquenow.local (ignorado pelo Git) e nunca use o token do chat.
set -a
source .env.estoquenow.local
set +a
npm run estoquenow:readonly -- get '/v1/logistic/123'
```

O token temporário fica com permissão `0600` no diretório temporário do sistema.
Respostas JSON exibem somente envelope, nomes de campos, nulabilidade e formatos
de data/hora; PDFs exibem apenas status, tipo e tamanho. Nunca habilite
`ESTOQUENOW_WRITE_ENABLED`: entrega e devolução ainda não foram homologadas no
EstoqueNOW.

### Pull incremental

`GET /api/imperio/estoquenow-pull` é exclusivo do Vercel Cron e exige
`Authorization: Bearer $CRON_SECRET`. O cron consulta uma janela móvel com
sobreposição porque a API homologada não oferece cursor de atualização confiável.
No plano Hobby, o agendamento padrão é diário às 09:00 UTC. Para operação a cada
15 minutos, altere a expressão para `*/15 * * * *` somente depois de migrar o
projeto para um plano Vercel que aceite essa frequência.

Ativação segura:

1. Defina `CRON_SECRET` e `ESTOQUENOW_PULL_MANAGER_ID` somente na Vercel.
2. Mantenha `ESTOQUENOW_INCREMENTAL_PULL_ENABLED=false` até aplicar a migration e
   validar o endpoint em modo desabilitado.
3. Habilite `ESTOQUENOW_INCREMENTAL_PULL_ENABLED=true` com
   `ESTOQUENOW_PULL_APPLY_ENABLED=false`. Esse modo lê e registra somente métricas
   sanitizadas; não cria nem altera operações.
4. Para um lote autorizado, habilite `ESTOQUENOW_PULL_APPLY_ENABLED=true` com
   `ESTOQUENOW_PULL_BATCH_SIZE` entre 1 e 5. Somente operações novas e atualizações
   mutáveis são elegíveis; divergências canônicas e histórico protegido continuam
   na fila manual.
5. Depois do lote, reconcilie contagens e volte a flag de aplicação para `false`
   antes de ampliar o limite operacional.

Nenhum run armazena payload bruto, nome de cliente, endereço, token, URL assinada
ou mensagem livre do provedor. `ESTOQUENOW_WRITE_ENABLED=false` permanece um gate
independente e obrigatório.

### Matriz de integração

| Capacidade | Produto | Evidência atual | Escrita externa |
| --- | --- | --- | --- |
| Listar logística por período | Torre web | GET real em produção; paginação e contrato sanitizados | Nenhuma |
| Pré-visualizar candidatos | Torre web | Fluxo real, manager-only, sem persistência | Nenhuma |
| Detalhe e itens logísticos | Torre, app de campo e harness | GET real; 22 linhas importadas e reconciliadas na operação piloto | Nenhuma |
| Fotos dos itens | Torre e app de campo | `item_url_image` real; proxy autenticado, origem exata, MIME e tamanho limitados | Nenhuma |
| Checklist dos itens | Torre e app de campo | Estado interno protegido por RLS/RPC; não altera o snapshot externo | Nenhuma |
| Confirmar entrega ou retorno | Cliente server-only | Schema e contrato cobertos por mock | Bloqueada por padrão; não homologada no EstoqueNOW |
| Importar uma operação no Postgres da Império | Torre web | Confirmação individual, idempotente por ID externo e protegida por ambiente | Não escreve no EstoqueNOW |
| Pull incremental | Vercel Cron + torre | Janela móvel, ledger sanitizado e single-flight; aplicação começa desabilitada | Não escreve no EstoqueNOW |
| Lote controlado | Scheduler | Máximo de cinco por run, somente após flag específica e reconciliação | Não escreve no EstoqueNOW |
| Locação, inventário e financeiro | Nenhum | Não implementado sem evidência do contrato real | Nenhuma |

O runtime da listagem observado em 02/09/2026 usa `client_name`, `local_name`,
`movement_date` e `movement_time`; datas vieram em `YYYY-MM-DD` e horas em
`HH:MM[:SS]`. Os 94 movimentos do período correspondiam a 47 IDs logísticos e
estão aptos à importação individual após revisão da prévia.

O detalhe real confirmou `id`, `item_id`, `order_id`, `item_name` e
`item_url_image` nas linhas do pedido. Nome/telefone de cliente, campos financeiros
e payloads desconhecidos não são persistidos no contexto operacional. O fuso não
vem explícito na API; horários são interpretados em `America/Sao_Paulo` até
confirmação formal do contrato.
