import { createClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
};

const supabaseUrl = required("SUPABASE_URL");
const secretKey = required("SUPABASE_SECRET_KEY");
const managerEmail = required("IMPERIO_MANAGER_EMAIL").toLowerCase();
const managerName = required("IMPERIO_MANAGER_FULL_NAME");
const temporaryPassword = process.env.IMPERIO_MANAGER_TEMPORARY_PASSWORD;

if (!/^\S+@\S+\.\S+$/.test(managerEmail))
  throw new Error("IMPERIO_MANAGER_EMAIL não é um e-mail válido.");
if (managerName.length < 2)
  throw new Error("IMPERIO_MANAGER_FULL_NAME deve ter ao menos 2 caracteres.");
if (!temporaryPassword || temporaryPassword.length < 10)
  throw new Error(
    "IMPERIO_MANAGER_TEMPORARY_PASSWORD deve ter ao menos 10 caracteres.",
  );

const admin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function managerIds() {
  const result = await admin.from("profiles").select("id").eq("role", "manager");
  if (result.error)
    throw new Error(`Não foi possível contar gestores: ${result.error.message}`);
  return result.data.map((profile) => profile.id);
}

async function ensureEmailIsUnused() {
  let page = 1;
  while (page) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1_000 });
    if (result.error)
      throw new Error(`Não foi possível consultar usuários: ${result.error.message}`);
    const matches = result.data.users.filter(
      (user) => user.email?.toLowerCase() === managerEmail,
    );
    if (matches.length)
      throw new Error(
        `Já existe usuário Auth para ${managerEmail}; nenhuma alteração foi feita.`,
      );
    page = result.data.nextPage ?? 0;
  }
}

async function bootstrap() {
  const existingManagers = await managerIds();
  if (existingManagers.length !== 0)
    throw new Error(
      `Bootstrap recusado: já existem ${existingManagers.length} gestor(es).`,
    );
  await ensureEmailIsUnused();

  const created = await admin.auth.admin.createUser({
    email: managerEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: managerName },
  });
  if (created.error || !created.data.user)
    throw new Error(
      `Não foi possível criar o primeiro gestor: ${created.error?.message ?? "usuário ausente"}`,
    );

  const userId = created.data.user.id;
  try {
    const promoted = await admin
      .from("profiles")
      .update({
        full_name: managerName,
        role: "manager",
        must_change_password: true,
      })
      .eq("id", userId)
      .eq("role", "worker")
      .select("id,role,must_change_password")
      .single();
    if (
      promoted.error ||
      promoted.data.role !== "manager" ||
      promoted.data.must_change_password !== true
    )
      throw new Error(
        `Perfil não promovido: ${promoted.error?.message ?? "estado inesperado"}`,
      );

    const managers = await managerIds();
    if (managers.length !== 1 || managers[0] !== userId)
      throw new Error("A verificação final não encontrou exatamente o gestor criado.");

    console.log(
      `Primeiro gestor criado para ${managerEmail}. A troca da senha temporária continua obrigatória.`,
    );
  } catch (error) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error)
      throw new Error(
        `${error instanceof Error ? error.message : "Bootstrap incompleto"} Falha ao reverter o usuário ${userId}: ${cleanup.error.message}`,
      );
    throw error;
  }
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bootstrap não concluído.");
  process.exitCode = 1;
});
