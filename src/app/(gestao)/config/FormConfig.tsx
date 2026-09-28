"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { lerNumero, mensagemErro } from "@/lib/formato";
import type { Empresa } from "@/lib/contexto";
import { Aviso, botao, campo } from "@/components/ui";

const txt = (n: number) => (n ? String(n).replace(".", ",") : "");

function Chave({ titulo, explica, valor, onMudar }: { titulo: string; explica: string; valor: boolean; onMudar: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="block font-medium">{titulo}</span>
        <span className="block text-xs text-zinc-400">{explica}</span>
      </span>
      <input type="checkbox" checked={valor} onChange={(e) => onMudar(e.target.checked)} className="h-5 w-5 shrink-0 accent-orange-500" />
    </label>
  );
}

export default function FormConfig({ empresa }: { empresa: Empresa }) {
  const router = useRouter();
  const [nome, setNome] = useState(empresa.nome);
  const [quilo, setQuilo] = useState(empresa.usa_quilo);
  const [preco, setPreco] = useState(txt(Number(empresa.preco_quilo)));
  const [multa, setMulta] = useState(txt(Number(empresa.multa_comanda)));
  const [semEntrada, setSemEntrada] = useState(empresa.abrir_no_pedido);
  const [garcom, setGarcom] = useState(empresa.garcom_lanca);
  const [cobraTaxa, setCobraTaxa] = useState(Number(empresa.taxa_servico) > 0);
  const [taxa, setTaxa] = useState(Number(empresa.taxa_servico) > 0 ? txt(Number(empresa.taxa_servico)) : "10");
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>({});
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const p = preco.trim() ? lerNumero(preco) : 0;
    const m = multa.trim() ? lerNumero(multa) : 0;
    const t = cobraTaxa ? lerNumero(taxa) : 0;
    if (p == null || p < 0) return setMsg({ erro: "Preço do quilo inválido." });
    if (m == null || m < 0) return setMsg({ erro: "Multa inválida." });
    if (quilo && !p) return setMsg({ erro: "Com o por quilo ligado, informe o preço do quilo." });
    if (t == null || t < 0 || t > 20) return setMsg({ erro: "Taxa de serviço entre 0 e 20%." });
    setSalvando(true);
    const { error } = await criarClienteNavegador().rpc("salvar_config", {
      p_nome: nome,
      p_usa_quilo: quilo,
      p_preco_quilo: p,
      p_multa: m,
      p_abrir_no_pedido: semEntrada,
      p_garcom_lanca: garcom,
      p_taxa_servico: t,
    });
    setSalvando(false);
    if (error) return setMsg({ erro: mensagemErro(error) });
    setMsg({ ok: "Salvo." });
    router.refresh();
  }

  const caixa = "space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4";

  return (
    <form onSubmit={salvar} className="max-w-lg space-y-5">
      <label className="block space-y-1">
        <span className="text-sm text-zinc-300">Nome do estabelecimento</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} maxLength={60} />
      </label>

      <div className={caixa}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Como funciona a casa</p>
        <Chave
          titulo="Sem entrada (comanda abre sozinha)"
          explica="Para lugares sem catraca ou sem ninguém na porta: a comanda abre no primeiro pedido do tablet. A tela de Entrada continua funcionando se quiser usar."
          valor={semEntrada}
          onMudar={setSemEntrada}
        />
        <Chave
          titulo="Garçom lança pedido"
          explica="Aparece o botão “Lançar pedido” no celular do garçom, para quem não quer usar o tablet."
          valor={garcom}
          onMudar={setGarcom}
        />
      </div>

      <div className={caixa}>
        <Chave
          titulo="Taxa de serviço"
          explica="O caixa vê a taxa já marcada e pode tirar se o cliente não quiser pagar. Não incide sobre multa de comanda."
          valor={cobraTaxa}
          onMudar={setCobraTaxa}
        />
        {cobraTaxa && (
          <label className="flex items-center gap-2 text-sm">
            <input value={taxa} onChange={(e) => setTaxa(e.target.value)} inputMode="decimal" className="w-20 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-orange-500/70" />
            <span className="text-zinc-400">% sobre o consumo</span>
          </label>
        )}
      </div>

      <div className={caixa}>
        <Chave
          titulo="Comida por quilo"
          explica="Liga a tela da Balança e o botão “Peso (kg)” no caixa."
          valor={quilo}
          onMudar={setQuilo}
        />
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
