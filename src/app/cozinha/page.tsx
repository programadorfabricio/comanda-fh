import { exigirTela } from "@/lib/contexto";
import { ehGestao } from "@/lib/papeis";
import Cozinha from "./Cozinha";

export const dynamic = "force-dynamic";

export default async function PaginaCozinha() {
  const { empresa, papel } = await exigirTela(["cozinha"]);
  return <Cozinha empresa={empresa} gestao={ehGestao(papel)} />;
}
