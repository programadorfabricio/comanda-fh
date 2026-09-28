import { exigirTela } from "@/lib/contexto";
import { ehGestao } from "@/lib/papeis";
import Caixa from "./Caixa";

export const dynamic = "force-dynamic";

export default async function PaginaCaixa() {
  const { empresa, papel } = await exigirTela(["caixa"]);
  return <Caixa empresa={empresa} gestao={ehGestao(papel)} />;
}
