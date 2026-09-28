import { exigirTela } from "@/lib/contexto";
import { ehGestao } from "@/lib/papeis";
import Mesa from "./Mesa";

export const dynamic = "force-dynamic";

export default async function PaginaMesa() {
  const { empresa, papel, user } = await exigirTela(["mesa"]);
  return <Mesa empresa={empresa} gestao={ehGestao(papel)} email={user.email ?? ""} />;
}
