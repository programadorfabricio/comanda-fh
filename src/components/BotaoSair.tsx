"use client";

import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";

export default function BotaoSair() {
  const router = useRouter();

  async function sair() {
    await criarClienteNavegador().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button onClick={sair} className="h-9 shrink-0 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 hover:bg-white/10">
      Sair
    </button>
  );
}
