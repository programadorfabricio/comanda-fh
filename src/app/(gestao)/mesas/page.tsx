import { exigirTela } from "@/lib/contexto";
import { Titulo } from "@/components/ui";
import GerenciarMesas from "./GerenciarMesas";

export const dynamic = "force-dynamic";

export default async function PaginaMesas() {
  const { supabase, empresa } = await exigirTela([]);
  const { data } = await supabase.from("mesas").select("id, numero, ativa").order("numero");
  return (
    <>
      <Titulo sub="Cada tablet é configurado com o número da mesa em que fica.">Mesas</Titulo>
      <GerenciarMesas empresaId={empresa.id} mesas={data ?? []} />
    </>
  );
}
