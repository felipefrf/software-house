# Império Locações — especificação do produto demonstrável

## 1. Objetivo

Construir uma demonstração frontend persistente que pareça um produto entregue e permita provar, em uma única sessão, o caminho completo:

`inspiração → produtos → carrinho → checkout do evento → proposta → reserva → produção → separação → entrega → retorno → inspeção → estoque`

Todos os dados e integrações são simulados. A interface deve deixar essa condição visível sem reduzir a fidelidade operacional da demonstração.

## 2. Princípios do produto

1. O cliente escolhe peças antes de preencher dados longos do evento.
2. Foto de evento não é decoração: cada ambiente revela e adiciona os produtos usados.
3. Disponibilidade só existe para quantidade e intervalo operacional, incluindo preparação e retorno.
4. Uma conta pode ter vários eventos, cada um com carrinho, proposta, documentos e andamento próprios.
5. Reserva futura e estado físico da peça são conceitos separados.
6. Produção concluída cria peças rastreáveis e as recebe no estoque.
7. Retorno nunca libera uma peça antes da inspeção.
8. Todo dado comercial relevante acompanha o evento até fábrica, logística e financeiro.
9. Nenhum botão decorativo: controles visíveis precisam alterar estado, abrir conteúdo ou explicar por que estão indisponíveis.
10. Falta de estoque é um problema a resolver, não uma ordem de produção automática.

## 3. Escopo geográfico da demonstração

Base operacional simulada em São José dos Campos, atendendo:

- Vale do Paraíba: São José dos Campos, Jacareí, Caçapava, Taubaté, Pindamonhangaba, Guaratinguetá, Lorena, Aparecida e Cruzeiro.
- Serra da Mantiqueira: Campos do Jordão e Santo Antônio do Pinhal.
- Litoral Norte: Caraguatatuba, São Sebastião, Ilhabela e Ubatuba.
- Grande São Paulo e eixo Dutra: Mogi das Cruzes, Guarulhos e São Paulo.
- Fora da rota padrão: endereço pode ser enviado para análise logística, sem prometer preço instantâneo.

O transporte considera zona, distância simulada, volume, número de veículos, pedágio, equipe, acesso e janela de carga.

## 4. Jornadas públicas

### 4.1 Descoberta e mural comprável

- Home com proposta clara, regiões atendidas e acesso ao catálogo/conta.
- Mural de eventos reais ou representativos, com tipo, cidade e estilo.
- Ao abrir uma foto, mostrar os produtos vinculados à composição, quantidades sugeridas e pontos identificáveis sobre a imagem.
- Ações: adicionar uma peça, adicionar o ambiente completo, ajustar quantidades ou seguir para o catálogo.
- O mural deve preservar a referência visual no projeto enviado ao comercial.

### 4.2 Catálogo e produto

- Busca e filtros por categoria, estilo e ambiente.
- Cards com foto, acabamento, dimensões, diária e saldo indicativo.
- Quantidade ajustável sem exigir datas.
- Resumo persistente do carrinho com miniaturas, quantidade, subtotal e ação “Revisar seleção”.
- Estado vazio útil e confirmação visual após inclusão.

### 4.3 Carrinho

- Lista editável de produtos e referências visuais anexadas.
- Estimativa apenas de locação antes do endereço/período.
- Explicação de que disponibilidade, transporte e equipe serão calculados no checkout.
- Ação primária “Continuar para os dados do evento”.

### 4.4 Checkout do evento

Ordem dos passos:

1. Conta e evento: entrar na conta simulada, escolher evento existente ou criar novo.
2. Evento: nome, tipo, convidados, ambiente, área útil e observações de layout.
3. Local: cidade, espaço, endereço e opção fora da rota padrão.
4. Operação: entrega, montagem, início do evento, retirada, acesso, doca/elevador/escada, pavimento, estacionamento e janela autorizada.
5. Disponibilidade: cruzar quantidades e período; mostrar acervo próprio, falta, alternativa, sublocação ou produção.
6. Revisão: peças, valores estimados, transporte, equipe, contato e consentimento de análise comercial.

Ao concluir, criar um novo evento na conta e o mesmo pedido no CRM interno. Nada fica reservado antes da confirmação da proposta/sinal.

O checkout não pode ser aberto sem que o usuário tenha passado pela revisão do carrinho. Datas, conta e endereço nunca aparecem antes dessa etapa no roteiro principal.

## 5. Área da conta

- Perfil único “Marina Souza” com pelo menos três eventos: um novo pedido, um confirmado e um concluído.
- Seletor de evento e criação de novo evento.
- Por evento: status, timeline, peças, referência visual, local, agenda, proposta, pagamento e contato comercial.
- Ações demonstráveis: abrir proposta, aprovar proposta e sinal, acompanhar reserva e iniciar outro projeto.
- O evento criado no checkout deve aparecer imediatamente e permanecer após recarregar a página.
- Cada evento possui `accountId`, `eventId` e `orderId` próprios. Alternar ou criar um evento não pode alterar outro.
- Rascunhos podem ser editados diretamente. Depois de proposta aprovada/reserva criada, mudanças de quantidade, período ou endereço criam uma revisão explícita que recalcula preço, capacidade e alocação; cancelamento libera reservas, mas preserva o histórico.

## 6. Operação interna

### 6.1 Central e CRM

- Entrada imediata do pedido enviado pelo site.
- Funil lead → proposta → reserva → separação → rota → evento → retorno.
- Próxima ação, responsável e alerta de capacidade.
- Seleção de evento compartilhada entre todos os módulos.

### 6.2 Cadastro de produtos

- Modelo: nome, SKU, categoria, descrição, acabamento, dimensões, peso, volume, preço, custo de reposição, custo/lead de fabricação, localização base e política de rastreio.
- Fotos: upload local com prévia e galeria simulada; a imagem cadastrada passa a aparecer no acervo da operação.
- Entrada inicial: gerar peças individuais ou lote e identificadores rastreáveis.

### 6.3 Estoque e reservas

- Visão por modelo e por unidade/tag.
- Para cada peça: estado físico, condição, localização, fonte, reserva futura e último movimento.
- Disponibilidade por período, com conflitos existentes e margem operacional.
- Holds de proposta têm validade; expiração ou cancelamento libera a alocação sem apagar o histórico.
- O intervalo bloqueado inclui preparação, separação, retorno, limpeza e manutenção prevista, não apenas os dias do evento.
- Estados físicos: disponível, separação, fora, inspeção, manutenção e baixada.
- Reserva futura não altera o estado físico atual, mas bloqueia a peça no intervalo.

### 6.4 Produção

- Falta no pedido cria `shortageQty` e abre uma decisão de cobertura; não cria ordem de produção.
- A decisão compara `produzir`, `substituir`, `sublocar` e `reduzir`, registrando alternativa, quantidade, custo, prazo e responsável.
- Somente a decisão humana “Aprovar produção” define `approvedProductionQty` e cria uma ordem de produção.
- Etapas: planejamento, CNC/estrutura, acabamento/tapeçaria, qualidade e recebimento.
- Concluir qualidade e receber gera novas tags, entrada no galpão e alocação ao pedido.
- Reprovação não libera estoque.

### 6.5 Inteligência de decisão

- Responder “vale produzir para este pedido?” com regras auditáveis: prazo, custo, receita atual, margem, demanda antiga destravada e utilização futura.
- Comparar produzir, substituir, sublocar ou reduzir quantidade em uma tabela de custo, prazo, receita preservada e margem.
- Mostrar pedidos antigos compatíveis que voltariam a ser atendíveis.
- Na demo, usar cálculo determinístico e rotular “recomendação simulada”, não fingir um modelo de IA em produção.
- Horizonte simulado: 120 dias. Demanda perdida só é recuperável se quantidade e janela não conflitam com reservas aceitas. Produção considera custo unitário, receita preservada do evento e receita compatível recuperável; sublocação usa custo unitário simulado; substituição usa produto compatível disponível; redução explicita receita perdida. Não mostrar “confiança” para uma regra determinística.
- Fase futura: previsão de demanda, sugestão de mix e leitura de briefing/fotos com IA, sempre com decisão humana.

### 6.6 Logística

- Pull list por evento: previsto, reservado, separado, carregado e pendente.
- Veículos, equipe, rota, janela de montagem, acesso e responsável no local.
- Transições simuladas alteram a localização/custódia das tags.
- Retorno parcial e divergência impedem encerramento silencioso.
- O módulo Logística possui checklist clicável do evento ativo; cada ação atualiza contagem e custódia em vez de mover todas as tags de uma só vez.

### 6.7 Retorno, avaria e manutenção

- Toda peça retornada entra em inspeção.
- Decisões: aprovar, limpar, enviar para revisão, marcar faltante ou dar baixa.
- Avaria registra descrição, severidade, evidência fotográfica simulada, etapa provável, custo e possível cobrança.
- Revisão remove a peça da disponibilidade; aprovação posterior a devolve ao estoque.
- Manutenção possui fila própria, ordem de serviço, custo e decisão de reparar ou baixar.
- Histórico da tag não é apagado por baixa ou recuperação.

### 6.8 Financeiro e integrações

- Valores ligados ao evento: locação, transporte, equipe, sinal, caução, saldo e avaria.
- Integrações exibidas por gatilho, dado, direção e estado real da demo.
- Site/CRM, WhatsApp, pagamento, mapas, QR, ERP/NF-e, CNC e armazenamento de fotos ficam explicitamente marcados como “simulação frontend” ou “planejada”. Nenhuma aparece como ativa ou afirma retorno externo auditado.

## 7. Estado e persistência da demonstração

- Um estado raiz versionado contém contas, produtos, cenas do mural, eventos, peças, reservas, ordens de produção, inspeções, movimentos e sinais de demanda perdida.
- Cálculos de disponibilidade, preço, falta, logística e recomendação são derivados desse estado, evitando contadores duplicados.
- `localStorage` mantém a sessão após recarga; botão “Restaurar demonstração” retorna aos dados iniciais.
- A hidratação valida versão e JSON; estado inválido volta ao seed e informa a restauração.
- Não haverá backend real nesta etapa.
- Imagens enviadas pelo cadastro usam `data:` URL redimensionada apenas para a demonstração local. Se o armazenamento exceder o limite ou a imagem não puder ser restaurada, o modelo persiste com placeholder e aviso “prévia local indisponível”. Não usar `blob:` URL como dado persistido.

## 8. Direção de interface

- Paleta: Azul acervo `#10243B`, azul ação `#2C63D6`, latão `#D7AD5D`, eucalipto `#1B674C`, papel `#F5F7F6`, alerta `#A65B18`.
- Tipografia: serif editorial para títulos/fotografia, sans legível para tarefas e mono para códigos, tags e horários.
- Layout: site público fotográfico e arejado; conta organizada por projetos; operação densa e pragmática.
- Elemento de assinatura: fotos do mural com marcadores de produtos e uma “bandeja do evento” persistente, transformando inspiração diretamente em seleção comprável.
- Acessibilidade: foco visível, rótulos, estados ativos, feedback em `aria-live`, teclado e redução de movimento.

## 9. Critérios de aceite da demo

1. Abrir uma cena do mural revela marcadores e a lista dos SKUs visíveis; é possível adicionar uma única peça ou o ambiente e preservar a foto no evento.
2. O usuário percorre mural/produto → catálogo → carrinho e somente depois inicia checkout; conta, local e datas não são exigidos para adicionar peças.
3. Alterar/remover quantidades no carrinho atualiza miniaturas, itens e subtotal de locação.
4. Checkout valida cidade, opção fora da rota, datas, horários, espaço e acesso antes da revisão final.
5. Enviar cria evento na conta e pedido no CRM com os mesmos `eventId/orderId`, itens e referência.
6. Criar um quarto evento e alternar entre eventos prova que editar A não muda B. Evento confirmado exige revisão/cancelamento explícito.
7. Aprovar proposta cria hold/reserva temporal com buffers simulados de 24 h antes da entrega e 12 h após o retorno. Um conflito dentro do buffer é visível; expirar/cancelar libera alocação sem apagar histórico.
8. Falta aparece como `shortageQty` e na comparação de alternativas, mas não na Fábrica antes de “Aprovar produção”.
9. Aprovar produzir cria OP; concluir produção cria novas tags, reserva o período do evento correto e elimina a falta correspondente.
10. Logística permite separar/carregar itens do evento e mantém contagem pendente; uma divergência ou retorno parcial impede encerrar o evento.
11. Retorno gera inspeção. Uma avaria percorre inspeção → OS de manutenção → reparo → qualidade → estoque, com custo refletido no evento.
12. Cadastro de modelo usa apenas campos consumidos por telas/cálculos, respeita política de rastreio e permite imagem local com prévia/fallback.
13. Nenhuma cidade, telefone ou claim do Nordeste permanece; cidades atendidas partem de São José dos Campos e existe “fora da rota — análise manual”.
14. Integrações aparecem somente como “simulação frontend” ou “planejada”; simular abre payload fictício sem alegar chamada externa.
15. Atualizar a página preserva eventos, produtos, peças e etapas; estado inválido/version mismatch oferece restauração segura.
16. Controles do roteiro têm efeito verificável: abrir cena, adicionar/remover item, revisar carrinho, avançar/voltar checkout, enviar evento, alternar/criar evento, aprovar proposta, decidir cobertura, avançar OP, separar/carregar/retornar tag, inspecionar/reparar, cadastrar modelo/entrada, simular integração e restaurar demo. Outros controles são removidos.
17. Todos os fluxos funcionam em desktop e mobile, com teclado e feedback de estado.
18. Lint e build de produção passam sem erros.

## 10. Fora do escopo desta entrega frontend

- Autenticação, autorização e isolamento real por cliente.
- Banco de dados, upload permanente e API.
- Pagamento, WhatsApp, mapas, NF-e, CNC ou QR reais.
- Otimização de rota, previsão estatística e visão computacional reais.
- Contratos jurídicos, regras fiscais e LGPD completas.

Esses itens entram na implementação real após validação do fluxo e definição das integrações disponíveis na empresa.

## 11. Estimativa para a versão de produção

Estimativa inicial, antes de discovery técnico com Estoque Now, ERP, meios de pagamento e CNC:

| Frente | Horas |
|---|---:|
| Discovery, processos, arquitetura e UX/UI | 160–220 |
| Site público, mural, catálogo, conta e checkout | 280–380 |
| CRM, propostas, reservas e financeiro | 220–320 |
| Acervo, tags, movimentações e inventário | 240–340 |
| Fábrica, logística, retorno e manutenção | 280–400 |
| Backend, autenticação, arquivos e auditoria | 240–340 |
| Integrações prioritárias | 160–280 |
| QA, segurança, migração, treinamento e go-live | 180–260 |
| **Total estimado** | **1.760–2.540 h** |

Com uma equipe de três pessoas em dedicação principal, o intervalo corresponde aproximadamente a 5–8 meses. A primeira operação real pode entrar antes, em ondas: comercial/conta, acervo/reservas e depois fábrica/logística/financeiro. Integrações sem API documentada, saneamento do estoque atual e migração de dados podem ampliar a estimativa.
