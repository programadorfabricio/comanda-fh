"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { lerNumero, mensagemErro } from "@/lib/formato";
import type { Empresa } from "@/lib/contexto";
import { Aviso, botao, campo } from "@/components/ui";

const txt = (n: number) => (n ? String(n).replace(".", ",") : "");

export default function FormConfig({ empresa }: { empresa: Empresa }) {
  const router = useRouter();
  const [nome, setNome] = useState(empresa.nome);
  const [quilo, setQuilo] = useState(empresa.usa_quilo);
  const [preco, setPreco] = useState(txt(Number(empresa.preco_quilo)));
  const [multa, setMulta] = useState(txt(Number(empresa.multa_comanda)));
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>({});
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const p = preco.trim() ? lerNumero(preco) : 0;
    const m = multa.trim() ? lerNumero(multa) : 0;
    if (p == null || p < 0) return setMsg({ erro: "Preço do quilo inválido." });
    if (m == null || m < 0) return setMsg({ erro: "Multa inválida." });
    if (quilo && !p) return setMsg({ erro: "Com o por quilo ligado, informe o preço do quilo." });
    setSalvando(true);
    const { error } = await criarClienteNavegador().rpc("salvar_config", { p_nome: nome, p_usa_quilo: quilo, p_preco_quilo: p, p_multa: m });
    setSalvando(false);
    if (error) return setMsg({ erro: mensagemErro(error) });
    setMsg({ ok: "Salvo." });
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="max-w-md space-y-5">
      <label className="block space-y-1">
        <span className="text-sm text-zinc-300">Nome do estabelecimento</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} maxLength={60} />
      </label>

      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">Comida por quilo</span>
            <span className="block text-xs text-zinc-400">Liga a tela da Balança e o botão “Lançar peso” no caixa.</span>
          </span>
          <input type="checkbox" checked={quilo} onChange={(e) => setQuilo(e.target.checked)} className="h-5 w-5 accent-orange-500" />
        </label>
        {quilo && (
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Preço do quilo (R$)</span>
            <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="69,90" className={campo} />
          </label>
        )}
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-zinc-300">Multa por comanda perdida (R$)</span>
        <input value={multa} onChange={(e) => setMulta(e.target.value)} inputMode="decimal" placeholder="0 = sem multa" className={campo} />
        <span className="block text-xs text-zinc-500">Aparece impressa na comanda. O caixa lança quando o cliente perde.</span>
      </label>

      {msg.erro && <Aviso>{msg.erro}</Aviso>}
      {msg.ok && <Aviso tipo="ok">{msg.ok}</Aviso>}
      <button disabled={salvando} className={botao}>
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
