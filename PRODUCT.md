# Império Logística

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Coordenação e liderança logística:** acompanha várias operações simultâneas, distribui equipe, motorista e veículo, identifica atrasos e decide sobre exceções.
- **Líder de campo:** conduz cada evento do preparo ao retorno, confirma marcos, registra ocorrências e produz evidências sem depender de memória ou mensagens soltas.
- **Equipe de campo:** executa tarefas objetivas no celular, inclusive em locais sem sinal e com diferentes níveis de familiaridade digital.
- **Administração da Império:** mantém pessoas, acessos, equipes, escalas e demais dados que não pertencem ao EstoqueNOW.

## Product Purpose

Substituir uma operação logística guiada por memória, WhatsApp e disciplina individual por um fluxo operacional único, rastreável e acionável. O primeiro módulo deve transformar dados reais do EstoqueNOW em uma torre de controle para a liderança e em uma jornada guiada no celular para a equipe de campo.

Sucesso significa saber o que está acontecendo em cada evento, qual é a próxima ação, quem é responsável e quando e onde cada marco foi registrado, reduzindo omissões, retrabalho e atraso.

## Positioning

O produto não é um novo ERP de locação nem uma cópia do EstoqueNOW. É a camada operacional de execução da Império: reúne o pedido e a logística existentes com escala interna, fluxo por etapa, evidências de campo e gestão de exceções em uma única linha do tempo compartilhada entre escritório e rua.

## Operating Context

- A Império executa eventos simultâneos, por vezes com centenas de peças e múltiplos caminhões.
- O EstoqueNOW continua como sistema de origem no curto prazo para pedidos, locações, logística, inventário e disponibilidade conforme a cobertura real da API.
- O fluxo logístico previsto é: preparação, saída, deslocamento, chegada, montagem, evento/entrega, desmontagem, retorno e inspeção/conclusão.
- Saída, chegada, montagem, desmontagem e retorno podem exigir checklist, foto tirada ao vivo, horário, localização, observação, responsável e registro de divergência ou avaria.
- A chegada pode ser liberada ou bloqueada; bloqueio exige motivo e tempo de espera.
- A operação de campo pode ocorrer sem conexão. Registros locais devem permanecer identificados como pendentes até sincronização confirmada.
- O primeiro corte utilizável cobre torre de controle e preparação/saída no celular. As demais etapas orientam a arquitetura e os protótipos, mas não devem ser apresentadas como prontas.

## Capabilities and Constraints

- Integração EstoqueNOW exclusivamente no servidor, com OAuth2 Client Credentials, cache de token, renovação após 401 e tratamento de limite 429.
- `client_id` e `client_secret` vêm apenas de ambiente e nunca chegam ao navegador ou ao repositório.
- Nenhuma escrita na conta da cliente acontece sem autorização explícita. Até as credenciais chegarem, o fallback é demonstrativo e deve estar rotulado como tal; o smoke test preparado é somente leitura.
- Dados devem ser cadastrados internamente apenas quando não existirem ou não puderem ser mantidos no EstoqueNOW. Pessoas, acessos, equipes, escalas e evidências de campo são internos até validação contrária pela API real.
- Web de liderança e experiência mobile compartilham o mesmo evento operacional. O mobile atual é web responsiva/PWA, não aplicativo nativo.
- O estado persistido localmente é base para sincronização posterior, não prova de que conflito, upload resiliente ou reconciliação offline já estejam resolvidos.
- Comercial/CRM, financeiro, produção, catálogo próprio e gamificação são módulos posteriores e não ampliam o aceite do primeiro módulo de logística.
- Usuários de campo precisam de controles grandes, uma ação principal por etapa, linguagem direta, pouco texto e mínima digitação.

## Brand Commitments

- Nome de trabalho: **Império Logística**, parte da plataforma modular da Império Eventos.
- Voz operacional, direta e humana; alertas explicam a ação necessária, não apenas exibem cor ou código.
- Customer.io é referência vinculante de clareza, densidade calma e hierarquia de produto, não um layout para copiar.
- Os rascunhos enviados pela cliente são referência funcional. Preto/dourado, grid, componentes e estética gerada por IA não são compromissos visuais.

## Evidence on Hand

- Transcrição da reunião de 27/08/2026: `/Users/felipefrf/Downloads/Ápice __ Império - 2026_08_27 15_30 GMT-03_00 - Notes by Gemini.md`.
- Doze rascunhos funcionais enviados pela cliente em `/Users/felipefrf/Downloads/WhatsApp Image 2026-08-27 at 16.00.*.jpeg`.
- Referência visual indicada por Felipe: `https://customer.io/` e captura anexada na conversa.
- Documentação oficial: `https://api.estoquenow.com.br/docs/v1/` e collection Postman oficial.
- Protótipos atuais em `.planning/sketches/imperio-logistics-direction/`; contêm dados de exemplo e não provam disponibilidade de campos da API.
- Cliente ainda precisa fornecer `client_id` e `client_secret`; sem eles, respostas reais, cobertura de campos e mapeamentos finais permanecem não verificados.

## Product Principles

1. **Próxima ação inequívoca:** cada pessoa deve entender o que fazer agora sem interpretar um painel inteiro.
2. **Exceção antes de decoração:** atraso, bloqueio, divergência e avaria devem emergir antes de métricas genéricas.
3. **O sistema registra; a pessoa confirma:** horário, localização e identidade vêm do sistema sempre que possível, reduzindo digitação e achismo.
4. **Uma verdade compartilhada:** escritório e campo enxergam o mesmo evento, com origem e estado de sincronização explícitos.
5. **Escopo honesto:** dado demonstrativo, ação local e capacidade futura nunca aparecem como integração concluída.

## Accessibility & Inclusion

- A experiência de campo deve funcionar para pessoas com diferentes níveis de escolaridade e familiaridade digital.
- Ações não podem depender apenas de cor, gestos ocultos ou precisão motora fina.
- Alvos de toque amplos, foco visível, contraste legível, rótulos explícitos e fluxo operável por teclado são requisitos mínimos.
