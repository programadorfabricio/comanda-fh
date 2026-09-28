import { exigirTela } from "@/lib/contexto";
import { ehGestao } from "@/lib/papeis";
import Balanca from "./Balanca";

export const dynamic = "force-dynamic";

export default async function PaginaBalanca() {
  const { empresa, papel } = await exigirTela(["balanca"]);
  return <Balanca empresa={empresa} gestao={ehGestao(papel)} />;
}
