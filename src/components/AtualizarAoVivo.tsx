"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";

// Recarrega a página (dados do servidor) quando algo muda no banco.
// Também atualiza a cada 60 s, caso o tempo real caia.
export default function AtualizarAoVivo({ empresaId, tabelas }: { empresaId: string; tabelas: string[] }) {
  const router = useRouter();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chave = tabelas.join(",");

  useEffect(() => {
    const supabase = criarClienteNavegador();
    const atualizar = () => {
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => router.refresh(), 500);
    };
    let canal = supabase.channel(`pagina-${empresaId}-${chave}`);
    for (const tabela of chave.split(",")) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: tabela, filter: `empresa_id=eq.${empresaId}` }, atualizar);
    }
    canal.subscribe();
    const relogio = setInterval(atualizar, 60_000);
    return () => {
      if (espera.current) clearTimeout(espera.current);
      clearInterval(relogio);
      supabase.removeChannel(canal);
    };
  }, [empresaId, chave, router]);

  return null;
}
