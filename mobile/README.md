# Império Logística — app de campo

Aplicativo Expo/React Native para iOS e Android. Usa o mesmo Supabase da torre web, respeitando Auth, RLS, Storage e a RPC idempotente já existentes.

## Rodar no celular

```bash
cp .env.example .env
# preencha somente URL e publishable key
npm ci
npx expo start
```

Abra o QR code no Expo Go. Câmera, localização, SQLite, cache e fila funcionam em iOS e Android; para binários próprios, use EAS Build com os identificadores já definidos em `app.json`.

Variáveis permitidas:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA_AQUI
```

Nunca use `service_role`, secret key ou senha do banco no app.

## Fluxo real

1. Trabalhador entra com e-mail/senha do Supabase.
2. O app carrega somente operações autorizadas pela RLS e salva a última escala no SQLite.
3. Checklist, foto persistente, GPS foreground, horário e responsável formam uma ação com `device_action_id` único.
4. A ação entra na fila SQLite como `pending`; passa por `sending` e termina em `confirmed`, `conflict` ou `failed`.
5. A foto vai para o bucket privado `operation-evidence`; a RPC `confirm_operation_action` confirma idempotentemente e a torre passa a exibir a evidência.
6. O app tenta a fila ao abrir, voltar ao primeiro plano, recuperar conexão e por ação manual. O retry automático para após três tentativas; o manual continua disponível.
7. A tela Evidências lê `operation_events` do servidor e cria URLs privadas com validade de 60 segundos.

Ocorrências usam a RPC idempotente `create_operation_incident` e exigem conexão nesta versão. Avaria e item faltante exigem foto.
Se a resposta da RPC for perdida ou ambígua, as evidências local e remota são preservadas para retry ou reconciliação; o app não tenta apagá-las automaticamente.

## Limites explícitos

- Não existe sincronização, GPS ou rastreamento em background.
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

```bash
npm test
npm run typecheck
npx expo-doctor
npx expo export --platform ios
npx expo export --platform android
```
