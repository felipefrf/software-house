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

# Preferido: injeta os segredos diretamente do projeto Vercel vinculado.
npx vercel env run -e production -- npm run estoquenow:readonly -- token
npx vercel env run -e production -- npm run estoquenow:readonly -- get '/v1/logistic?page=1&per_page=25'

# Alternativa local: exporte ESTOQUENOW_CLIENT_ID e ESTOQUENOW_CLIENT_SECRET
# a partir de um arquivo .env* ignorado e mantenha:
export ESTOQUENOW_IMPORT_ENABLED=false
npm run estoquenow:readonly -- get '/v1/logistic/123'
```

O token temporário fica com permissão `0600` no diretório temporário do sistema.
Respostas JSON exibem somente envelope, nomes de campos, nulabilidade e formatos
de data/hora; PDFs exibem apenas status, tipo e tamanho.
