import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestao, telaDoPapel, type Papel } from "@/lib/papeis";

export type Empresa = {
  id: string;
  nome: string;
  usa_quilo: boolean;
  preco_quilo: number;
  multa_comanda: number;
  abrir_no_pedido: boolean;
  garcom_lanca: boolean;
  taxa_servico: number;
};

// Usuário logado + empresa + papel. Sem login -> /login
export async function contexto() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("usuarios_empresa")
    .select("papel, nome, empresa:empresas(id, nome, usa_quilo, preco_quilo, multa_comanda, abrir_no_pedido, garcom_lanca, taxa_servico)")
    .eq("user_id", user.id)
    .maybeSingle();

  const empresa = (data?.empresa ?? null) as unknown as Empresa | null;
  return { supabase, user, empresa, papel: (data?.papel ?? null) as Papel | null, nome: data?.nome ?? "" };
}

// Garante que o login pode abrir a tela. Dono e gerente abrem todas.
export async function exigirTela(papeis: Papel[]) {
  const ctx = await contexto();
  if (!ctx.empresa || !ctx.papel) redirect("/sem-empresa");
  if (!ehGestao(ctx.papel) && !papeis.includes(ctx.papel)) redirect(telaDoPapel(ctx.papel));
  return ctx as typeof ctx & { empresa: Empresa; papel: Papel };
}
