---
name: "Império Logística"
description: "Prancheta de carga: torre de controle e app de campo com uma cor de ação, papel quente e serifa de display."
colors:
  ground: "#f6f4ef"
  surface: "#ffffff"
  ink: "#17211d"
  muted: "#5a645e"
  line: "#e3dfd6"
  line-strong: "#c4bfb3"
  green: "#1f5c46"
  green-deep: "#173d34"
  green-tint: "#e3efe8"
  amber: "#8f4c00"
  amber-tint: "#fbf0dc"
  red: "#a63a30"
  red-tint: "#fae8e5"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontWeight: 600
    sizes: "26 / 30 / 36px, line-height 1.1, tracking -0.01em"
  body:
    fontFamily: "Albert Sans, Segoe UI, system-ui, sans-serif"
    sizes: "13 / 14 / 15 / 16 / 17 / 20px"
    numerals: "tabular"
rounded:
  control: "12px"
  card: "16px"
  pill: "999px"
shadow:
  soft: "0 1px 2px rgba(23,33,29,.04), 0 1px 3px rgba(23,33,29,.06)"
  card: "0 1px 2px rgba(23,33,29,.04), 0 4px 16px -4px rgba(23,33,29,.08)"
  lift: "0 8px 30px -8px rgba(31,92,70,.22)"
---

# Design System: Império Logística

Implementado em `site/src/app/imperio/logistica/` (tokens em `globals.css` sob
`.imperio-shell`, primitivos em `ui.tsx`). Este documento descreve o que está
no produto, não uma intenção.

## Princípios

1. **Próxima ação em uma varredura.** Cada tela abre com o que exige ação
   agora; métricas e histórico vêm depois ou recolhidos.
2. **Exceção antes de decoração.** Âmbar e vermelho aparecem só com texto
   explicando o fato e o que fazer. Estados normais são neutros.
3. **Uma cor de ação.** O verde Império marca ação primária, concluído e
   seleção. Não há roxo nem segunda cor de marca.
4. **Origem e estado sempre em texto.** "EstoqueNOW · ID", "Cadastro
   interno", "Demonstração: nada é salvo" e "Sem conexão" são frases, nunca
   só cor ou ícone.
5. **Detalhe em um lugar só.** A operação completa vive em Operações; Hoje e
   Agenda apontam para ela.

## Cor

Campo de papel quente (`ground`) com superfícies brancas. Tinta verde-preta
para texto. Verde Império para ação, concluído, item de navegação ativo e
marca; verde-escuro para o cabeçalho do app de campo. Âmbar para atenção,
bloqueio e pendência do executor; vermelho para crítico e avaria. Tintas
claras acompanham cada cor semântica e só aparecem em avisos e pílulas.

Contraste medido: texto atenuado 5,6:1 sobre o campo; âmbar, vermelho e
verde sobre suas tintas acima de 5,4:1. Estado desabilitado usa cor sólida
(`line` com texto `muted`), nunca opacidade.

## Tipografia

Newsreader (serifa, 500–600) para títulos de página, nome do evento, horários
grandes e números de destaque. Albert Sans para todo o resto. Sem
monoespaçada, sem caixa alta decorativa; o único rótulo em caixa alta foi
removido. Horários e contagens usam numerais tabulares.

## Layout

- **Torre (desktop):** trilho lateral fixo com dois grupos, "Operação"
  (Hoje, Operações, Agenda, Ocorrências, Evidências) e "Cadastros" (Pessoas
  e equipes, Frota, Integrações). Abaixo de 1024px o trilho vira grade de
  quatro colunas com ícone e rótulo curto.
- **Hoje:** data, resumo em uma frase, "Exige decisão agora" (aviso por
  operação com botão que leva ao controle real), quadro "Em andamento hoje"
  (hora, evento, rota em nove pontos, escala) e "Próximos 7 dias".
- **Operações:** filtros, lista cronológica (ativas primeiro) e painel de
  detalhe ao lado a partir de 1280px; abaixo disso o detalhe substitui a
  lista com "Voltar à lista". Detalhe: cabeçalho, bloco "Agora", avisos,
  rota com foco por etapa e seções recolhíveis (Escala, Itens da carga,
  Dados do pedido, Linha do tempo, Cancelar).
- **Campo:** cabeçalho verde-escuro, lista de hoje em cartões grandes,
  "Próximas" e "Encerradas" depois. Tela da operação: etapa com rota
  compacta, avisos, itens da carga abertos só nas etapas de carga, "Próxima
  ação" com checklist e requisitos (foto, local, responsável), ocorrência
  recolhida, info e mapa. Botão principal fixo acima da navegação inferior
  (Hoje, Evidências, Envios).

## Componentes

- **Card:** `rounded-2xl`, borda `line/70`, `shadow-card`. Sem mosaico de
  cartões KPI.
- **Pill:** `rounded-full`, anel interno, tinta semântica. Só para estado.
- **Notice:** faixa lateral de 6px na cor semântica, superfície tingida,
  título + frase + ação opcional. Vermelho recebe `role="alert"`.
- **Button:** `rounded-xl`, 44px, primário verde com sombra suave e "lift"
  no hover; secundário branco com borda; fantasma verde; perigo vermelho.
- **Rota da operação:** nove marcos numerados ligados por linha; concluído
  verde com check, atual tinta com anel, futuro vazado. Rola na horizontal
  com máscara nas bordas; `RouteDots` é a versão em nove pontos para listas.
- **CheckMark:** `todo` (âmbar) para quem executa, `neutral` para quem só
  acompanha.
- **Disclosure:** `<details>` nativo com chevron; meta à direita.
- **Toast:** canto inferior, some em 5s quando é sucesso curto.

## Motion

Uma entrada por troca de vista (`imp-rise`, 400ms). Transições só em cor,
sombra e escala de botão. `prefers-reduced-motion` desliga tudo.

## Não fazer

- Roxo, gradientes, glassmorphism, mono ou eyebrows em caixa alta.
- Cor como único sinal de estado.
- Repetir a mesma pílula de risco em lista, fila e detalhe.
- Mostrar o detalhe da operação em mais de uma vista.
- Afirmar que algo foi salvo em modo de demonstração.
