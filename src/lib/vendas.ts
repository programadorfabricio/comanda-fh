import type { SupabaseClient } from "@supabase/supabase-js";

export type Relatorio = {
  total: number;
  desconto: number;
  servico: number;
  contas: number;
  pagamentos: number;
  por_forma: Record<string, number>;
  top: { descricao: string; tipo: string; quantidade: number; valor: number }[];
  por_hora: Record<string, number>;
  cancelados: number;
  tempo_medio_cozinha_min: number | null;
};

export async function relatorio(supabase: SupabaseClient, inicio: Date, fim: Date) {
  const { data, error } = await supabase.rpc("relatorio_vendas", { p_inicio: inicio.toISOString(), p_fim: fim.toISOString() });
  if (error) throw new Error(error.message);
  return data as Relatorio;
}

export type ContaAberta = {
  id: string;
  comanda_numero: number;
  mesa_numero: number | null;
  aberta_em: string;
  total: number;
  itens: number;
};

// Comandas em uso agora, com o valor consumido até o momento
export async function contasAbertas(supabase: SupabaseClient): Promise<ContaAberta[]> {
  const { data } = await supabase
    .from("contas")
    .select("id, comanda_numero, mesa_numero, aberta_em, itens(total, cancelado)")
    .eq("status", "aberta")
    .order("comanda_numero");
  return (data ?? []).map((c) => {
    const itens = ((c.itens ?? []) as { total: number; cancelado: boolean }[]).filter((i) => !i.cancelado);
    return {
      id: c.id,
      comanda_numero: c.comanda_numero,
      mesa_numero: c.mesa_numero,
      aberta_em: c.aberta_em,
      total: itens.reduce((s, i) => s + Number(i.total), 0),
      itens: itens.length,
    };
  });
}
