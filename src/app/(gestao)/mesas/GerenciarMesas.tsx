"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/formato";
import { Aviso, botao, campo } from "@/components/ui";

type Mesa = { id: string; numero: number; ativa: boolean };

export default function GerenciarMesas({ empresaId, mesas }: { empresaId: string; mesas: Mesa[] }) {
  const router = useRouter();
  const supabase = criarClienteNavegador();
  const [ate, setAte] = useState(String((mesas.at(-1)?.numero ?? 0) + 1));
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const alvo = Number(ate);
    if (!Number.isInteger(alvo) || alvo < 1 || alvo > 500) return setErro("Número inválido.");
    const existentes = new Set(mesas.map((m) => m.numero));
    const novas = Array.from({ length: alvo }, (_, i) => i + 1)
      .filter((n) => !existentes.has(n))
      .map((numero) => ({ empresa_id: empresaId, numero }));
    if (!novas.length) return setErro(`Já existem mesas até a ${alvo}.`);
    const { error } = await supabase.from("mesas").insert(novas);
    if (error) setErro(mensagemErro(error));
    router.refresh();
  }

  async function alternar(m: Mesa) {
    const msg = m.ativa
      ? `Desativar a mesa ${m.numero}? O tablet dessa mesa para de aceitar pedidos.`
      : `Reativar a mesa ${m.numero}?`;
    if (!window.confirm(msg)) return;
    const { error } = await supabase.from("mesas").update({ ativa: !m.ativa }).eq("id", m.id);
    if (error) setErro(mensagemErro(error));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={adicionar} className="flex flex-wrap items-center gap-2 text-sm">
        Ter mesas de 1 até
        <input value={ate} onChange={(e) => setAte(e.target.value)} inputMode="numeric" className={`${campo} w-20`} />
        <button className={botao}>Criar as que faltam</button>
      </form>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-12">
        {mesas.map((m) => (
          <button
            key={m.id}
            onClick={() => alternar(m)}
            className={`rounded-lg border py-3 text-center font-semibold ${
              m.ativa ? "border-white/10 bg-white/[0.04]" : "border-white/5 text-zinc-600 line-through"
            }`}
            title={m.ativa ? "Tocar para desativar" : "Tocar para ativar"}
          >
            {m.numero}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">Toque numa mesa para desativar/ativar (mesa desativada não recebe pedido).</p>
    </div>
  );
}
