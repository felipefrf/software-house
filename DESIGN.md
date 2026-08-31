---
name: "Império Logística"
description: "Route Canvas: uma camada operacional leve e precisa para a logística de eventos."
colors:
  ground: "#f8faf7"
  surface: "#ffffff"
  ink: "#22302a"
  muted: "#64716b"
  line: "#d9dfdc"
  line-strong: "#bcc7c1"
  course-purple: "#5b4bcc"
  course-purple-soft: "#f0edfb"
  pale-sage: "#dce8de"
  completion-green: "#237452"
  exception-amber: "#8a5a00"
  exception-amber-soft: "#fff7e6"
  exception-red: "#a93b3b"
  exception-red-soft: "#fff0ed"
typography:
  display:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 760
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  display-compact:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 760
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.45
  title:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.45
  body:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.45
rounded:
  subtle: "8px"
  control: "10px"
  compact-surface: "12px"
  surface: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  2xl: "20px"
  3xl: "24px"
  4xl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.course-purple}"
    textColor: "{colors.surface}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "13px"
  button-primary-hover:
    backgroundColor: "#493aa8"
    textColor: "{colors.surface}"
  button-mobile-action:
    backgroundColor: "{colors.course-purple}"
    textColor: "{colors.surface}"
    typography: "{typography.headline}"
    padding: "15px 18px"
    width: "100%"
  button-mobile-action-disabled:
    backgroundColor: "#9b94c7"
    textColor: "{colors.surface}"
    typography: "{typography.headline}"
    padding: "14px 18px"
    width: "100%"
  surface-operational:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  chip-support:
    backgroundColor: "#edf3ee"
    textColor: "#345044"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  notice-exception:
    backgroundColor: "{colors.exception-amber-soft}"
    textColor: "{colors.exception-amber}"
    typography: "{typography.label}"
    rounded: "{rounded.subtle}"
    padding: "16px"
---

# Design System: Império Logística

## Overview

**Creative North Star: "Route Canvas"**

Route Canvas traduz a precisão e a leitura em camadas de uma rota em um software operacional contemporâneo. O fundo quase branco, a tipografia verde-preta e as regras finas mantêm o ambiente leve; a rota abstrata concentra o estado do evento sem se passar por mapa ou localização ao vivo.

A composição é equilibrada e orientada a decisão: liderança e campo reconhecem evento, etapa ativa, bloqueio e próxima ação em segundos. O roxo de percurso aparece apenas onde há atividade ou ação; verde confirma, âmbar ou vermelho interrompe. A interface é calma, direta e humana, sem a estética preto/dourado dos rascunhos nem acabamento genérico de interface gerada por IA.

**Key Characteristics:**

- Uma rota operacional compartilhada como mecanismo central.
- Cada etapa abre um foco único de checklist, evidências e registros.
- Leveza visual com densidade calma e hierarquia precisa.
- Exceções acima de decoração e estados sempre acompanhados por texto.
- Uma ação principal proporcional ao contexto.
- Dados demonstrativos e limites de integração explicitamente rotulados.
- Exemplo, alteração da sessão e persistência real são estados explicitamente distintos.

## Colors

A paleta combina campo quase branco e tinta verde-preta com um único percurso roxo; sálvia sustenta estados neutros, verde confirma e âmbar ou vermelho sinaliza exceções.

### Primary

- **Roxo de Percurso:** reservado à etapa ativa, à ação principal, aos links operacionais e ao estado selecionado.

### Secondary

- **Verde de Conclusão:** confirma etapas, recursos e registros concluídos.
- **Sálvia Pálida:** apoia seleção, contagens e agrupamentos sem competir com a rota.

### Tertiary

- **Âmbar de Exceção:** sinaliza bloqueios e pendências que exigem leitura imediata.
- **Vermelho de Exceção:** reservado a falhas ou avarias de maior gravidade; não é decoração.

### Neutral

- **Campo Quase Branco:** plano contínuo da aplicação e base da sensação de leveza.
- **Superfície Branca:** áreas operacionais, barras e grupos sobre o campo.
- **Tinta Verde-Preta:** texto principal e ação móvel neutra.
- **Texto Atenuado:** contexto, horários secundários e metadados.
- **Linha Suave / Linha Forte:** estrutura, separação e trechos futuros da rota.

### Named Rules

**The Course Purple Rule.** O roxo marca somente o caminho ativo, a seleção atual e a próxima ação; sua raridade preserva a hierarquia.

**The Exception Has Words Rule.** Âmbar e vermelho nunca comunicam sozinhos: toda exceção explica o fato e a ação necessária.

## Typography

**Display Font:** Avenir Next (com Avenir, Segoe UI e sans-serif como fallbacks)
**Body Font:** Avenir Next (com Avenir, Segoe UI e sans-serif como fallbacks)
**Label/Mono Font:** a mesma família; horários e contadores usam numerais tabulares.

**Character:** Uma única sans de trabalho sustenta leitura rápida, números alinhados e linguagem direta. Peso, tamanho e cor criam a hierarquia; não há contraste ornamental entre famílias.

### Hierarchy

- **Display:** nome do evento ou tarefa corrente; compacto, firme e com entreletra apertada.
- **Headline:** títulos de rota, grupos e ações importantes.
- **Title:** títulos de recursos, listas e confirmações.
- **Body:** instruções e contexto operacional, com frases curtas e leitura confortável.
- **Label:** estados, horários, origem dos dados e metadados; nunca abaixo do mínimo legível estabelecido.

### Named Rules

**The Workhorse Rule.** A tipografia serve à operação: sem tipo gigante, contraste editorial ou texto miúdo usado para acomodar excesso de informação.

## Layout

No desktop, uma navegação leve de largura fixa abre uma área fluida. O evento e a rota dominam a coluna central, as operações do dia e a decisão ocupam a coluna lateral, e pessoas, veículo e evidências formam uma base alinhada. A composição usa superfícies contíguas e regras internas em vez de mosaico de cartões KPI.

Em larguras intermediárias, a navegação e a coluna lateral se estreitam, estados secundários da rota desaparecem e recursos passam de três para duas colunas. Abaixo de 900px, a navegação lateral sai de cena e é substituída por uma faixa web compacta, horizontal e rolável; a coluna de decisão entra no fluxo e as operações do dia também se tornam uma faixa horizontal. Abaixo de 620px, a rota vira uma janela horizontal rolável com etapas largas o suficiente para toque e leitura.

O fluxo móvel dedicado limita o conteúdo a 430px, mantém contexto do evento no topo e uma ação principal alcançável pelo polegar acima da navegação inferior. A rota mostra uma janela compacta ao redor da etapa ativa; bloqueio e confirmações vêm antes da ação.

Superfícies de consulta usam uma faixa de ferramentas acima do conteúdo para busca, filtros, troca de período e criação. A agenda mantém cinco dias úteis em colunas e faixas horárias em linhas, preservando rolagem horizontal quando não cabe. Selecionar evento ou pessoa abre um drawer modal lateral de até 500px; em telas compactas, ele ocupa a largura inteira sem alterar a hierarquia interna.

**The One Shared Route Rule.** A troca de evento redesenha a mesma rota no lugar; não empilha mapas, trilhas ou painéis concorrentes.

## Elevation & Depth

O sistema é plano por padrão. Bordas, fundos tonais e continuidade de linhas estabelecem a maior parte da profundidade. A única sombra estrutural observada enquadra a simulação do aparelho em telas largas; a rota ativa usa um halo tonal, não uma sombra realista.

### Shadow Vocabulary

- **Phone Frame:** sombra ambiente ampla aplicada apenas ao contêiner móvel quando ele é apresentado fora do telefone.
- **Active Route Halo:** anel roxo suave que fixa a etapa atual sem elevar o restante da interface.

### Named Rules

**The Flat Operational Field Rule.** Superfícies permanecem planas em repouso; profundidade só aparece para contexto de dispositivo ou estado ativo.

## Shapes

Superfícies operacionais usam cantos suavemente curvos; controles e navegação usam curvas um pouco menores, enquanto contagens e indicadores circulares assumem formato de pílula. Os marcos da rota são círculos exatos e os checkboxes de campo são quadrados, preservando distinção sem ornamentação. Bordas finas, recortes controlados e separadores internos mantêm o desenho preciso.

## Components

### Buttons

- **Shape:** controle suavemente curvo, nunca cápsula.
- **Primary:** roxo de percurso, texto branco e largura proporcional no desktop; no campo, ocupa toda a borda inferior disponível.
- **Hover / Focus:** escurece no hover e recebe anel de foco violeta visível, sem depender de movimento.
- **Disabled:** no fluxo de campo, a ação final permanece violeta atenuada, indisponível e acompanhada pela quantidade de tarefas pendentes; só assume o roxo ativo quando todo o checklist estiver concluído.
- **Secondary:** ações auxiliares usam fundo roxo suave e texto roxo; links operacionais permanecem textuais.

### Chips

- **Style:** pílula de sálvia clara com tinta verde; serve a contagens e contexto compacto.
- **State:** não substitui alerta nem ação e nunca usa o roxo apenas para ornamentação.

### Cards / Containers

- **Corner Style:** superfície suavemente curva.
- **Background:** branco sobre o campo quase branco; exceções recebem fundo âmbar suave.
- **Shadow Strategy:** plana por padrão, conforme a regra de elevação.
- **Border:** linha suave externa e divisores internos precisos.
- **Internal Padding:** densidade compacta, normalmente entre os passos grandes da escala de espaçamento.

### Navigation

Navegação desktop é clara, textual e acompanha ícones lineares simples. Hover usa fundo neutro; o item ativo recebe sálvia e texto verde escuro. Quando a barra lateral desaparece, uma faixa web compacta e rolável mantém os destinos principais abaixo do cabeçalho. No app de campo, três destinos persistem na borda inferior e o ativo é identificado por texto, peso e cor.

### Iconography

Ícones são SVGs lineares inline, com `fill` ausente, traço herdando a cor do controle e espessura consistente. Servem para reconhecer ação ou domínio sem substituir texto. Botões somente com ícone têm nome acessível explícito; SVG decorativo fica oculto da árvore de acessibilidade.

### Operational Route

A rota é uma sequência abstrata de marcos, não um mapa. Etapas concluídas usam verde; a atual recebe disco roxo e halo; futuras mantêm borda neutra. Rótulo, horário e estado textual acompanham cada marco. No mobile, a sequência rola horizontalmente e preserva alvos amplos.

### Stage Focus & Checklist

Selecionar um marco atualiza um único foco de etapa abaixo da rota. O cabeçalho combina ordem, nome e estado textual; a área principal reúne tarefas à esquerda e evidências à direita, empilhando as duas partes em telas estreitas. Checkboxes âmbar indicam pendência, verde com marca explícita indica registro concluído, e o progresso móvel acompanha a contagem real.

### Evidence Gallery & GPS Demo

Fotos aparecem em galerias de recorte consistente, agrupadas por evento e etapa. GPS, horário, checklist e cronômetro usam linhas ou blocos de sinal próprios, sempre com estado textual. Captura de câmera e GPS em protótipo muda somente a resposta visual local e permanece rotulada como demonstração; imagem ou coordenada de exemplo nunca conta como evidência real.

### Operational Imagery

Retratos sintéticos tornam equipe e responsabilidade reconhecíveis em avatares circulares compactos ou cartões de pessoa. Imagens de veículos e operação usam recorte documental, `object-fit: cover`, legenda ou contexto operacional e texto alternativo; não funcionam como hero decorativo. Toda imagem sintética ou de referência é identificada como demonstrativa, e os retratos não representam funcionários reais.

### Weekly Agenda & Filters

A agenda semanal combina navegação anterior/próxima, retorno à semana base, filtro por equipe e uma ação de criação. Eventos permanecem dentro da célula temporal e abrem detalhe em drawer; o filtro altera a lista sem remover os controles. Quando nenhuma operação corresponde à semana ou à equipe, o vazio ocupa a área da agenda e explica o resultado.

### Drawers & Forms

Detalhes e cadastros abrem em um drawer modal com título, descrição, fechamento rotulado, corpo rolável e ações fixadas no rodapé. Formulários usam rótulos visíveis, ajuda associada, controles nativos de data, horário e seleção, e coluna única em telas estreitas. A primeira entrada recebe foco ao abrir; erro marca `aria-invalid`, aparece como alerta textual e leva o foco ao primeiro campo inválido.

### Internal Records

Cadastros de pessoas e operações feitos no protótipo entram imediatamente na lista ou agenda, mas ficam somente na aba atual. Iniciais geradas substituem retratos inexistentes sem sugerir uma foto real. Confirmação por toast anuncia que o item foi adicionado apenas à sessão; convite, escrita remota e persistência nunca são implícitos.

### Empty States & Feedback

Estados vazios ficam dentro do painel ou grade que perderam seus resultados e preservam busca, filtros e ação de recuperação. Mensagens são diretas — por exemplo, nenhuma pessoa corresponde aos filtros — e não usam ilustração decorativa para ocupar espaço. Toasts usam região de status, erros usam alerta assertivo, e ambos descrevem o efeito real da ação.

### State Truth

**Exemplo** identifica dados pré-carregados ou demonstrativos. **Somente nesta sessão** identifica mudanças locais que desaparecem ao recarregar e não enviam convite ou escrita. **Persistido** só pode ser usado após confirmação do servidor ou integração real. A interface nunca mistura essas três condições sob um genérico “salvo”.

### Exception Notice

O aviso combina fundo âmbar suave, título de alto contraste e uma frase que explica o bloqueio. Ele aparece antes das confirmações e da ação que dependem dele.

## Do's and Don'ts

### Do:

- **Do** fazer evento, etapa atual, bloqueio e próxima ação serem compreendidos em uma varredura.
- **Do** manter estados acompanhados por rótulos explícitos, foco visível e alvos amplos.
- **Do** manter a ação móvel desabilitada e explicar quantas tarefas faltam até o checklist estar completo.
- **Do** agrupar foto, GPS, horário e checklist pela etapa que lhes dá contexto.
- **Do** identificar retratos, frota e evidências de referência como imagens demonstrativas.
- **Do** distinguir por texto dados de exemplo, alterações somente da sessão e persistência confirmada pelo servidor.
- **Do** manter filtros e ação disponíveis quando o conteúdo entra em estado vazio.
- **Do** associar erros aos campos, mover o foco ao primeiro inválido e anunciar feedback dinâmico.
- **Do** usar SVG inline com rótulo acessível em todo botão que não tenha texto visível.
- **Do** alinhar horários com numerais tabulares e preservar a leitura em telas estreitas.
- **Do** rotular dados sintéticos, estado local e integrações ainda não confirmadas.

### Don't:

- **Don't** transformar a rota abstrata em mapa, GPS ao vivo ou promessa de rastreamento real.
- **Don't** usar preto/dourado, gradientes, glassmorphism, tipo gigante ou mosaico de cartões KPI.
- **Don't** espalhar roxo por superfícies decorativas ou usar cor como único sinal de estado.
- **Don't** usar retratos ou imagens de frota como decoração sem pessoa, veículo, evento ou estado associado.
- **Don't** afirmar que um cadastro da sessão foi salvo, que um convite foi enviado ou que uma alteração chegou ao servidor.
- **Don't** substituir label, mensagem de erro ou nome acessível por ícone, placeholder ou cor.
- **Don't** apresentar câmera, sincronização sem conflitos ou escrita no EstoqueNOW como capacidades prontas.
