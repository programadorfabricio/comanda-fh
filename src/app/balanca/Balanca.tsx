"use client";

import { useCallback, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { bip, liberarSom, useTelaAcesa } from "@/lib/aoVivo";
import { dinheiro, hora, lerNumero, mensagemErro } from "@/lib/formato";
import type { ResumoConta } from "@/lib/tipos";
import type { Empresa } from "@/lib/contexto";
import BarraOperacao from "@/components/BarraOperacao";
import CampoLeitura from "@/components/CampoLeitura";
import LeitorQR from "@/components/LeitorQR";

type Lancado = { comanda: number; kg: number; valor: number; em: string };

// Balança do por quilo: lê a comanda e lança o peso do prato
export default function Balanca({ empresa, gestao }: { empresa: Empresa; gestao: boolean }) {
  const supabase = useRef(criarClienteNavegador()).current;
  const [conta, setConta] = useState<ResumoConta | null>(null);
  const [leitura, setLeitura] = useState("");
  const [peso, setPeso] = useState("");
  const [camera, setCamera] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ultimos, setUltimos] = useState<Lancado[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const ocupadoRef = useRef(false);
  const pesoRef = useRef<HTMLInputElement>(null);
  useTelaAcesa();

  const ler = useCallback(
    async (texto: string) => {
      if (ocupadoRef.current) return;
      ocupadoRef.current = true;
      setOcupado(true);
      liberarSom();
      const { data, error } = await supabase.rpc("ler_comanda", { p_leitura: texto });
      ocupadoRef.current = false;
      setOcupado(false);
      const falha = error ? mensagemErro(error) : (data as { erro?: string })?.erro;
      if (falha) {
        bip(2, 330);
        return setMsg({ ok: false, texto: falha });
      }
      setMsg(null);
      setConta(data as ResumoConta);
      setLeitura(texto);
      setPeso("");
      setTimeout(() => pesoRef.current?.focus(), 50);
    },
    [supabase]
  );

  const kg = (() => {
    const n = lerNumero(peso);
    if (n == null) return null;
    return n >= 10 ? n / 1000 : n;
  })();
  const valor = kg != null ? Math.round(kg * Number(empresa.preco_quilo) * 100) / 100 : 0;

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    if (!conta || kg == null || ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    const { error } = await supabase.rpc("lancar_item", { p_leitura: leitura, p_tipo: "quilo", p_quantidade: kg });
    ocupadoRef.current = false;
    setOcupado(false);
    if (error) return setMsg({ ok: false, texto: mensagemErro(error) });
    bip(1, 1320);
    setMsg({ ok: true, texto: `${kg.toFixed(3).replace(".", ",")} kg = ${dinheiro(valor)} na comanda ${conta.comanda}` });
    setUltimos((u) => [{ comanda: conta.comanda, kg, valor, em: new Date().toISOString() }, ...u].slice(0, 10));
    setConta(null);
    setPeso("");
  }

  if (!empresa.usa_quilo) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <BarraOperacao titulo="Balança" empresa={empresa.nome} gestao={gestao} />
        <p className="m-auto max-w-sm p-6 text-center text-zinc-400">O módulo “por quilo” está desligado. O dono liga em Configurações.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <BarraOperacao titulo="Balança" empresa={empresa.nome} gestao={gestao}>
        <span className="hidden text-sm text-zinc-400 sm:block">Quilo: {dinheiro(empresa.preco_quilo)}</span>
      </BarraOperacao>
      <main className="mx-auto grid w-full max-w-4xl flex-1 gap-4 p-4 md:grid-cols-2">
        <div className="space-y-3">
          {!conta ? (
            <>
              <CampoLeitura onLer={ler} ocupado={ocupado} />
              <button onClick={() => setCamera((c) => !c)} className="w-full rounded-xl border border-white/10 py-2 text-sm text-zinc-300">
                {camera ? "Desligar câmera" : "Ler com a câmera"}
              </button>
              {camera && <LeitorQR onLer={ler} pausado={ocupado} className="aspect-[4/3] w-full" />}
            </>
          ) : (
            <form onSubmit={lancar} className="space-y-3 rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">Comanda {conta.comanda}</p>
                <button type="button" onClick={() => setConta(null)} className="text-sm text-zinc-400">
                  Trocar
                </button>
              </div>
              <label className="block">
                <span className="text-sm text-zinc-300">Peso do prato (kg ou gramas)</span>
                <input
                  ref={pesoRef}
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,450"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-4xl tabular-nums outline-none focus:border-orange-500"
                />
              </label>
              <p className="text-right text-2xl font-bold tabular-nums">{kg != null ? dinheiro(valor) : "—"}</p>
              <button disabled={kg == null || ocupado} className="w-full rounded-xl bg-orange-500 py-4 text-lg font-bold text-black disabled:opacity-40">
                Lançar na comanda
              </button>
            </form>
          )}
          {msg && <p className={`rounded-xl px-4 py-3 text-lg font-semibold ${msg.ok ? "bg-emerald-500 text-black" : "bg-rose-600 text-white"}`}>{msg.texto}</p>}
        </div>

        <section className="h-fit rounded-2xl bg-white/[0.03] p-3">
          <h2 className="mb-2 px-1 text-sm font-semibold text-zinc-300">Últimos lançamentos</h2>
          {ultimos.length === 0 && <p className="px-1 py-4 text-sm text-zinc-500">Nenhum ainda.</p>}
          {ultimos.map((u, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-white/5 px-1 py-2 text-sm last:border-0">
              <b>#{u.comanda}</b>
              <span className="text-zinc-400">{u.kg.toFixed(3).replace(".", ",")} kg</span>
              <span className="text-zinc-500">{hora(u.em)}</span>
              <span className="ml-auto tabular-nums">{dinheiro(u.valor)}</span>
            </div>
          ))}
          <p className="mt-2 px-1 text-xs text-zinc-500">Lançou errado? O caixa cancela o item na hora de pagar.</p>
        </section>
      </main>
    </div>
  );
}
