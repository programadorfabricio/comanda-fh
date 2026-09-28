import { exigirTela } from "@/lib/contexto";
import { Titulo } from "@/components/ui";
import GerenciarCardapio from "./GerenciarCardapio";
import type { Categoria, Produto } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaCardapio() {
  const { supabase, empresa } = await exigirTela([]);
  const [{ data: categorias }, { data: produtos }] = await Promise.all([
    supabase.from("categorias").select("id, nome, ordem, ativa").order("ordem").order("nome"),
    supabase.from("produtos").select("id, categoria_id, nome, descricao, preco, foto, setor, disponivel, ordem").eq("ativo", true).order("ordem").order("nome"),
  ]);

  return (
    <>
      <Titulo sub="O que aparece no tablet da mesa. Marque “Acabou” quando faltar algo no dia.">Cardápio</Titulo>
      <GerenciarCardapio empresaId={empresa.id} categorias={(categorias ?? []) as Categoria[]} produtos={(produtos ?? []) as Produto[]} />
    </>
  );
}
