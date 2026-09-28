import { exigirTela } from "@/lib/contexto";
import { ehGestao } from "@/lib/papeis";
import Garcom from "./Garcom";

export const dynamic = "force-dynamic";

export default async function PaginaGarcom() {
  const { supabase, empresa, papel } = await exigirTela(["garcom"]);
  const { data } = await supabase.from("mesas").select("numero").eq("ativa", true).order("numero");
  return <Garcom empresa={empresa} gestao={ehGestao(papel)} mesas={(data ?? []).map((m) => m.numero)} />;
}
