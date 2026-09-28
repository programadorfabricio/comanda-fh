import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { telaDoPapel } from "@/lib/papeis";

export const dynamic = "force-dynamic";

// Cada login cai direto na tela da sua função
export default async function Inicio() {
  const { papel, empresa } = await contexto();
  if (!papel || !empresa) redirect("/sem-empresa");
  redirect(telaDoPapel(papel));
}
