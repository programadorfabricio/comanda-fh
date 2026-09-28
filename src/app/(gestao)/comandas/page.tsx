import { exigirTela } from "@/lib/contexto";
import { Titulo } from "@/components/ui";
import GerenciarComandas, { type ComandaLinha } from "./GerenciarComandas";
import AtualizarAoVivo from "@/components/AtualizarAoVivo";

export const dynamic = "force-dynamic";

export default async function PaginaComandas() {
  const { supabase, empresa } = await exigirTela([]);
  const { data } = await supabase
    .from("comandas")
    .select("id, numero, status, perdida, conta:contas!comandas_conta_fk(aberta_em, mesa_numero)")
    .order("numero");

  return (
    <>
      <AtualizarAoVivo empresaId={empresa.id} tabelas={["comandas"]} />
      <Titulo sub="Os cartões com QR que o cliente pega na entrada. Imprima, plastifique e pronto.">Comandas</Titulo>
      <GerenciarComandas comandas={(data ?? []) as unknown as ComandaLinha[]} multa={Number(empresa.multa_comanda)} />
    </>
  );
}
