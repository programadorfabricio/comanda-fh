"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { bip, liberarSom, useAoVivo, useTelaAcesa } from "@/lib/aoVivo";
import { hora, mensagemErro } from "@/lib/formato";
import type { Empresa } from "@/lib/contexto";
import BarraOperacao from "@/components/BarraOperacao";
import CampoLeitura from "@/components/CampoLeitura";
import LeitorQR from "@/components/LeitorQR";

type Resultado = { ok: boolean; texto: string; em: number };
type Aberta = { comanda: number; conta_id: string; em: string };

export default function Entrada({ empresa, gestao }: { empresa: Empresa; gestao: boolean }) {
  const supabase = useRef(criarClienteNavegador()).current;
  const [camera, setCamera] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [historico, setHistorico] = useState<Aberta[]>([]);
  const [dentro, setDentro] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const ocupadoRef = useRef(false);
  useTelaAcesa();

  useEffect(() => {
    try {
      setCamera(localStorage.getItem("cfh-entrada-camera") === "1");
    } catch {}
  }, []);

  const contar = useCallback(async () => {
    const { count } = await supabase.from("contas").select("id", { count: "exact", head: true }).eq("status", "aberta");
    setDentro(count ?? 0);
  }, [supabase]);
  useEffect(() => {
    contar();
  }, [contar]);
  useAoVivo(empresa.id, ["contas"], contar, 30_000);

  // some a mensagem depois de uns segundos
  useEffect(() => {
    if (!resultado) return;
    const t = setTimeout(() => setResultado(null), resultado.ok ? 3500 : 6000);
    return () => clearTimeout(t);
  }, [resultado]);

  const abrir = useCallback(
    async (leitura: string) => {
      if (ocupadoRef.current) return;
      ocupadoRef.current = true;
      setOcupado(true);
      liberarSom();
      const { data, error } = await supabase.rpc("abrir_comanda", { p_leitura: leitura });
      ocupadoRef.current = false;
      setOcupado(false);
      if (error) {
        bip(2, 330);
        setResultado({ ok: false, texto: mensagemErro(error), em: Date.now() });
        return;
      }
      const r = data as { comanda: number; conta_id: string };
      bip(1, 1320);
      setResultado({ ok: true, texto: `Comanda ${r.comanda} liberada`, em: Date.now() });
      setHistorico((h) => [{ comanda: r.comanda, conta_id: r.conta_id, em: new Date().toISOString() }, ...h].slice(0, 8));
      contar();
    },
    [supabase, contar]
  );

  async function desfazer(a: Aberta) {
    const { error } = await supabase.rpc("cancelar_abertura", { p_conta: a.conta_id });
    if (error) return setResultado({ ok: false, texto: mensagemErro(error), em: Date.now() });
    setHistorico((h) => h.filter((x) => x.conta_id !== a.conta_id));
    setResultado({ ok: true, texto: `Abertura da comanda ${a.comanda} desfeita`, em: Date.now() });
    contar();
  }

  function alternarCamera() {
    setCamera((c) => {
      try {
        localStorage.setItem("cfh-entrada-camera", c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <BarraOperacao titulo="Entrada" empresa={empresa.nome} gestao={gestao}>
        <span className="hidden rounded-lg bg-white/5 px-3 py-1.5 text-sm sm:block">
          Dentro agora: <b>{dentro ?? "…"}</b>
        </span>
      </BarraOperacao>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-4 p-4 md:grid-cols-2">
        <div className="space-y-3">
          {camera ? (
            <LeitorQR onLer={abrir} pausado={ocupado} className="aspect-[4/3] w-full" />
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 p-6 text-center text-zinc-400">
              <p className="text-lg text-zinc-200">Leitor de código</p>
              <p className="text-sm">Aponte a comanda no leitor (USB/Bluetooth) ou digite o número abaixo. Se preferir, use a câmera do aparelho.</p>
            </div>
          )}
          <button onClick={alternarCamera} className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-zinc-300">
            {camera ? "Desligar câmera" : "Usar a câmera para ler"}
          </button>
          <CampoLeitura onLer={abrir} ocupado={ocupado} />
        </div>

        <div className="space-y-4">
          <div
            className={`flex min-h-40 flex-col items-center justify-center rounded-2xl p-6 text-center transition-colors ${
              !resultado ? "bg-white/[0.03]" : resultado.ok ? "bg-emerald-500 text-black" : "bg-rose-600 text-white"
            }`}
          >
            {!resultado && <p className="text-zinc-400">Leia a comanda do cliente para liberar a entrada.</p>}
            {resultado && (
              <>
                <p className="text-4xl font-black">{resultado.ok ? "✓" : "✕"}</p>
                <p className="mt-1 text-2xl font-bold">{resultado.texto}</p>
                {resultado.ok && <p className="mt-1 font-medium">Pode passar.</p>}
              </>
            )}
          </div>

          <p className="text-center text-sm text-zinc-400 sm:hidden">
            Dentro agora: <b className="text-zinc-100">{dentro ?? "…"}</b>
          </p>

          {historico.length > 0 && (
            <section className="rounded-2xl bg-white/[0.03] p-3">
              <h2 className="mb-2 px-1 text-sm font-semibold text-zinc-300">Últimas liberadas</h2>
              {historico.map((a) => (
                <div key={a.conta_id} className="flex items-center gap-3 border-b border-white/5 px-1 py-2 last:border-0">
                  <b className="text-lg">#{a.comanda}</b>
                  <span className="text-sm text-zinc-400">{hora(a.em)}</span>
                  <button onClick={() => desfazer(a)} className="ml-auto rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/10">
                    Desfazer (engano)
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
