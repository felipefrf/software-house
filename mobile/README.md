# Império Logística — app de campo

Aplicativo Expo/React Native para iOS e Android. Usa o mesmo Supabase da torre web, respeitando Auth, RLS, Storage e a RPC idempotente já existentes.

## Rodar no celular

```bash
cp .env.example .env
# preencha somente URL e publishable key
npm ci
npx expo start
```

O Expo Go serve apenas para desenvolvimento dos fluxos em primeiro plano. O
rastreamento de rota em segundo plano exige um build próprio da Império; use o
perfil EAS `preview` descrito abaixo.

Variáveis permitidas:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_AQUI
```

Nunca use `service_role`, secret key ou senha do banco no app.

A sessão do Supabase fica no Keychain/Keystore via SecureStore. Cache, outbox,
consentimentos e pontos de rota usam SQLite com SQLCipher e chave aleatória de
256 bits guardada no SecureStore. Como o app ainda não foi distribuído, builds de
desenvolvimento anteriores com SQLite aberto devem limpar os dados locais antes
de instalar o primeiro preview cifrado.

## Fluxo real

1. Trabalhador entra com e-mail/senha do Supabase.
2. O app carrega somente operações autorizadas pela RLS e salva a última escala no SQLite.
3. Checklist, foto persistente, GPS, horário e responsável formam uma ação com `device_action_id` único.
4. A ação entra na fila SQLite como `pending`; passa por `sending` e termina em `confirmed`, `conflict` ou `failed`.
5. A foto vai para o bucket privado `operation-evidence`; a RPC `confirm_operation_action` confirma idempotentemente e a torre passa a exibir a evidência.
6. O app tenta a fila ao abrir, voltar ao primeiro plano, recuperar conexão e por ação manual. O retry automático para após três tentativas; o manual continua disponível.
7. A tela Evidências lê `operation_events` do servidor e cria URLs privadas com validade de 60 segundos.

A fila envia etapas na ordem operacional, mesmo se o relógio do aparelho mudar.
Uma etapa com falha, conflito ou envio em andamento bloqueia somente as etapas
seguintes da mesma operação. O retry individual segue a mesma regra. Fotos locais
e remotas não são apagadas automaticamente em conflito; a limpeza exige confirmação
do servidor ou descarte explícito.

Ao confirmar a saída, o app exige aceite explícito dos termos versionados e as
permissões de localização em primeiro e segundo plano. Depois disso, registra a
rota automaticamente, solicitando ao sistema intervalos de 60 segundos ou 100 metros, inclusive com o app em
segundo plano, e encerra no retorno, conclusão, cancelamento ou logout. Sessões e
pontos ficam em uma outbox SQLite e são enviados em lotes idempotentes. O aceite
registra usuário, operação, versão e horários do aparelho e do servidor.

O sistema operacional pode adiar a coleta: esses intervalos não são uma garantia
de frequência. A sincronização compartilha uma execução por usuário, limita cada
sessão a quatro lotes por ciclo e confirma somente IDs presentes no lote enviado.
No logout, o app tenta interromper a tarefa nativa mesmo se o banco local falhar;
uma falha de encerramento não é ocultada como logout bem-sucedido.

Ocorrências usam a RPC idempotente `create_operation_incident` e exigem conexão nesta versão. Avaria e item faltante exigem foto.
Se a resposta da RPC for perdida ou ambígua, as evidências local e remota são preservadas para retry ou reconciliação; o app não tenta apagá-las automaticamente.

## Limites explícitos

- A saída exige conexão para registrar o consentimento no servidor. Ações de etapa
  são preservadas offline e a interface projeta a próxima etapa a partir da fila
  contígua. Etapas locais aparecem como “Local”, sem alterar eventos, horário ou
  status do servidor. Conflitos, lacunas e chegada com acesso bloqueado interrompem
  essa projeção. A inspeção local permanece aguardando confirmação final. Não
  considerar uma operação inteira offline homologada antes do teste em aparelho.
- Checklist de itens e ocorrências ainda exigem conexão nesta versão.
- O rastreamento em background não funciona no Expo Go e pode ser encerrado pelo
  sistema se o usuário matar o app; precisa ser homologado nos aparelhos reais.
- O texto versionado de consentimento é um contrato técnico e ainda precisa de
  aprovação do cliente/jurídico, junto da política de retenção e acesso.
- Fotos capturadas continuam como arquivos privados do sandbox do app, mas não
  possuem criptografia adicional; definir retenção e limpeza antes do piloto.
- `conflict` nunca é reenviado automaticamente nem sobrescreve a etapa do servidor.
- Logout usa escopo local, remove cache e confirmações locais, mas preserva por usuário ações e fotos não resolvidas para retomada no mesmo aparelho.
- Descartar uma falha ou conflito exige conexão; o registro SQLite e a foto local só são removidos depois que o Storage confirma a remoção remota.
- A primeira troca de senha continua no portal web porque o backend revogou `mark_password_changed` do cliente autenticado; o app bloqueia e abre o portal seguro.
- O app não chama o EstoqueNOW diretamente. Operações, contexto, itens e checks
  chegam pela API da Império/Supabase; fotos passam pelo proxy autenticado da
  Império, sem expor a URL assinada externa. Operações manuais continuam rotuladas
  como internas.
- Não há dado simulado no aplicativo.

## Validar

Execute a suíte com Node.js 24; o teste de persistência usa `node:sqlite` do runtime.

Em 08/09/2026: 25 testes locais passaram, incluindo ordem e projeção da fila,
conciliação após avanço de outro aparelho, evidência imutável no retry, GPS recente,
concorrência e falha do banco durante logout. Um teste com SQLite real confirmou
durabilidade após reabertura e isolamento entre usuários, sem simular criptografia.
Falhas na obtenção da chave segura não deixam a inicialização permanentemente rejeitada.
TypeScript e export dos bundles
iOS/Android passaram. Esses testes usam mocks; bundles não são builds assinados
e não substituem o gate de aparelho físico abaixo.

```bash
npm test
npm run typecheck
npx expo-doctor
npx expo export --platform ios
npx expo export --platform android
```

## Builds EAS

Em 08/09/2026, `eas whoami` retornou `Not logged in` neste ambiente. O responsável
precisa autenticar o CLI e confirmar a conta/projeto antes da geração de builds;
nenhum build pago, assinatura ou submissão foi iniciado.

O `eas.json` mantém três perfis mínimos:

- `development`: binário interno instalável. Não é development client, pois o
  projeto não inclui `expo-dev-client`.
- `preview`: candidato interno para QA em aparelho físico. No Android, gera APK
  instalável diretamente; no iOS, usa distribuição interna.
- `production`: gera o artefato de loja, mas não publica nem submete nada.

Antes de iniciar um build, cadastre no ambiente correspondente do projeto EAS
somente as variáveis públicas abaixo. Não grave valores reais no repositório nem
adicione `service_role`, secret key, senha do banco ou credenciais do
EstoqueNOW.

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Depois da autenticação e configuração do projeto EAS pelo responsável, os
comandos são:

```bash
# candidato instalável para QA
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview

# artefatos de produção; executar somente após aprovação do release
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

Esses comandos apenas criam builds. Não use `eas submit` enquanto a publicação
nas lojas não estiver autorizada. O build iOS pode solicitar ao responsável a
configuração de assinatura e aparelhos; não compartilhe credenciais no terminal,
README, commit ou chat.

### Gate de aparelho físico para aprovar o preview

Execute primeiro todos os comandos de `Validar`. Depois, instale o preview em
um Android e um iPhone reais, caso ambas as plataformas façam parte do release,
e registre o resultado sem dados pessoais ou segredos.

O preview só pode ser promovido quando estes cenários passarem:

1. Login e troca inicial de senha com usuário de teste de cada papel aplicável.
2. RLS: o funcionário enxerga somente operações autorizadas e não executa ações
   de gestor.
3. Permissões de câmera e localização nos estados concedido e negado, incluindo
   GPS contínuo com app em primeiro plano, segundo plano e tela bloqueada, além de
   interrupção segura quando a permissão for revogada.
4. Ação online completa, com checklist, foto, GPS, confirmação idempotente e
   evidência privada visível na torre.
5. Ação offline persistida após fechar e reabrir o app, seguida de envio ao
   recuperar a conexão.
6. Retry, falha permanente e conflito sem sobrescrever silenciosamente o estado
   do servidor; descarte somente depois da confirmação remota.
7. Ocorrência online, incluindo foto obrigatória para avaria e item faltante.
8. Logout e novo login sem mistura de cache, fila, fotos ou operações entre
   usuários.
9. Reinício do aparelho e retorno do app ao primeiro plano sem perda de ação
   pendente nem duplicação no servidor.
10. Saída, retorno, conclusão, cancelamento e logout iniciam ou encerram exatamente
    uma sessão de rota, sem exigir botão de captura e sem continuar após o término.

Registre por execução: perfil EAS, versão do artefato, plataforma/aparelho,
papel testado, data, resultado e referência da evidência sanitizada. Qualquer
P0, vazamento entre usuários, perda/duplicação de ação ou acesso indevido bloqueia
o build de produção.
