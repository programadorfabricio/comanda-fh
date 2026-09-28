import { exigirTela } from "@/lib/contexto";
import { ehGestao } from "@/lib/papeis";
import Entrada from "./Entrada";

export const dynamic = "force-dynamic";

export default async function PaginaEntrada() {
  const { empresa, papel } = await exigirTela(["entrada"]);
  return <Entrada empresa={empresa} gestao={ehGestao(papel)} />;
}
