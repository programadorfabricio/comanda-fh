"use server";

import { revalidatePath } from "next/cache";
import { contexto } from "@/lib/contexto";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { emailDoUsuario, PAPEIS, type Papel } from "@/lib/papeis";

type Resposta = { erro?: string; ok?: string };

async function soDono() {
  const ctx = await contexto();
  if (ctx.papel !== "dono" || !ctx.empresa) throw new Error("Só o dono pode mexer na equipe.");
  const admin = criarClienteAdmin();
  if (!admin) throw new Error("Falta configurar a SUPABASE_SECRET_KEY na Vercel.");
  return { ...ctx, empresa: ctx.empresa, admin };
}

// Confere se o login é desta empresa e não é o dono
async function vinculoDaEmpresa(admin: NonNullable<ReturnType<typeof criarClienteAdmin>>, empresaId: string, userId: string) {
  const { data } = await admin.from("usuarios_empresa").select("papel, empresa_id").eq("user_id", userId).maybeSingle();
  if (!data || data.empresa_id !== empresaId) throw new Error("Login não encontrado.");
  if (data.papel === "dono") throw new Error("O login do dono não pode ser mudado por aqui.");
  return data;
}

export async function criarAcesso(form: { papel: Papel; nome: string; usuario: string; senha: string }): Promise<Resposta> {
  try {
    const { empresa, admin } = await soDono();
    const papel = form.papel;
    if (!PAPEIS.some((p) => p.papel === papel) || papel === "dono") return { erro: "Escolha a função." };
    const nome = form.nome.trim().slice(0, 40);
    const usuario = form.usuario.trim().toLowerCase();
    if (!usuario.includes("@") && !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(usuario)) {
      return { erro: "Usuário: de 3 a 30 letras minúsculas, números, ponto ou traço. Sem espaço e sem acento." };
    }
    const minimo = papel === "gerente" ? 8 : 6;
    if (form.senha.length < minimo) return { erro: `A senha precisa ter pelo menos ${minimo} caracteres.` };

    const { data, error } = await admin.auth.admin.createUser({ email: emailDoUsuario(usuario), password: form.senha, email_confirm: true });
    if (error || !data.user) {
      return { erro: /already|registered|exists/i.test(error?.message ?? "") ? "Esse usuário já existe. Escolha outro nome." : "Não foi possível criar o login." };
    }
    const { error: e2 } = await admin.from("usuarios_empresa").insert({ user_id: data.user.id, empresa_id: empresa.id, papel, nome });
    if (e2) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { erro: "Não foi possível ligar o login ao estabelecimento." };
    }
    revalidatePath("/equipe");
    return { ok: `Login “${usuario}” criado.` };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

export async function trocarSenhaAcesso(userId: string, senha: string): Promise<Resposta> {
  try {
    const { empresa, admin } = await soDono();
    const v = await vinculoDaEmpresa(admin, empresa.id, userId);
    const minimo = v.papel === "gerente" ? 8 : 6;
    if (senha.length < minimo) return { erro: `A senha precisa ter pelo menos ${minimo} caracteres.` };
    const { error } = await admin.auth.admin.updateUserById(userId, { password: senha });
    if (error) return { erro: "Não foi possível trocar a senha." };
    return { ok: "Senha trocada." };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

export async function removerAcesso(userId: string): Promise<Resposta> {
  try {
    const { empresa, admin } = await soDono();
    await vinculoDaEmpresa(admin, empresa.id, userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { erro: "Não foi possível remover." };
    revalidatePath("/equipe");
    return { ok: "Login removido." };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
