# Império Logística — direção visual

Status: exploração visual, sem vínculo com produção.

## Objetivo

Comparar três linguagens para a Torre de Controle antes de expandir o desenho para detalhe do evento e operação mobile.

## Variantes

- `calm`: clareza operacional. Inspirada na densidade calma e na hierarquia de Customer.io, com linguagem própria de marcos e despacho. Recomendada.
- `ledger`: mesa de despacho. Mais densa, rápida para operadores experientes e orientada a tabela.
- `route`: mapa de marcos. Mais autoral e visual, prioriza movimento e posição no fluxo.

Abra `index.html?variant=calm`, `index.html?variant=ledger` ou `index.html?variant=route`.

Capturas geradas: `calm.jpg`, `calm-mobile.jpg`, `ledger.jpg` e `route.jpg`.

## Iteração A2

`a2-refined.html` mantém a arquitetura da variante A e refina tipografia, densidade, hierarquia e linguagem operacional. Em desktop, mostra a Torre de Controle; em viewport mobile, mostra a etapa guiada de saída.

Capturas: `a2-desktop.jpg` e `a2-mobile.jpg`.

## Mapa das demais telas

`other-screens.html` expande a A2 em uma navegação única com Operações, Agenda, Equipes, Frota, Ocorrências, Cadastros e Integrações. Todos os registros são exemplos visuais; a matriz de Integrações diferencia fonte prevista, fonte interna e pontos ainda não verificados.

Capturas: `screen-operations.jpg`, `screen-calendar.jpg`, `screen-teams.jpg`, `screen-fleet.jpg`, `screen-incidents.jpg`, `screen-registry.jpg` e `screen-integrations.jpg`.

## App de campo

`mobile-app.html` apresenta uma visão mobile navegável com turno, detalhe da operação, saída, deslocamento, montagem, ocorrências, retorno e fila offline. A fila é apenas um estado visual e declara explicitamente que o backend de sincronização ainda não existe.

Capturas: `app-home.jpg`, `app-operation.jpg`, `app-departure.jpg`, `app-route.jpg`, `app-assembly.jpg`, `app-incidents.jpg`, `app-return.jpg` e `app-sync.jpg`.

Os nomes, horários, locais, equipes e veículos são dados de exemplo. Nenhuma capacidade de API é presumida pelo protótipo.
