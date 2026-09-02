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

## EstoqueNOW somente leitura

O harness aceita apenas GETs logísticos em allowlist, nunca imprime o token e
substitui valores da resposta por tipos e formatos. A flag de importação deve
continuar falsa.

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
de data/hora; PDFs exibem apenas status, tipo e tamanho. O arquivo local deve manter
`ESTOQUENOW_IMPORT_ENABLED=false` e não deve definir a escrita como habilitada.

### Matriz de integração

| Capacidade | Produto | Evidência atual | Escrita externa |
| --- | --- | --- | --- |
| Listar logística por período | Torre web | GET real em produção; paginação e contrato sanitizados | Nenhuma |
| Pré-visualizar candidatos | Torre web | Fluxo real, manager-only, sem persistência | Nenhuma |
| Detalhe, PDF e checklist logístico | Harness local | Rotas GET em allowlist; ainda sem homologação runtime | Nenhuma |
| Confirmar entrega ou retorno | Cliente server-only | Schema e contrato cobertos por mock | Bloqueada por padrão; não homologada no EstoqueNOW |
| Importar uma operação no Postgres da Império | Torre web | Confirmação individual, idempotente por ID externo e protegida por ambiente | Não escreve no EstoqueNOW |
| Importação em lote | Nenhum | Bloqueada até prévia válida e autorização específica | Nenhuma |
| Locação, inventário e financeiro | Nenhum | Não implementado sem evidência do contrato real | Nenhuma |

O runtime da listagem observado em 02/09/2026 usa `client_name`, `local_name`,
`movement_date` e `movement_time`; datas vieram em `YYYY-MM-DD` e horas em
`HH:MM[:SS]`. Os 94 movimentos do período correspondiam a 47 IDs logísticos e
estão aptos à importação individual após revisão da prévia.
