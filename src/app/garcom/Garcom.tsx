"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { bip, liberarSom, useAoVivo, useTelaAcesa } from "@/lib/aoVivo";
import { mensagemErro, minutosDesde } from "@/lib/formato";
import type { Empresa } from "@/lib/contexto";
import BarraOperacao from "@/components/BarraOperacao";
import LancarPedido from "./LancarPedido";

type Pedido = {
  id: string;
  setor: "cozinha" | "balcao";
  status: "novo" | "preparando" | "pronto";
  mesa_numero: number | null;
  comanda_numero: number;
  criado_em: string;
  pronto_em: string | null;
  itens: { id: string; descricao: string; quantidade: number; observacao: string; cancelado: boolean }[];
};
type Chamado = { id: string; mesa_numero: number; criado_em: string };

export default function Garcom({ empresa, gestao, mesas }: { empresa: Empresa; gestao: boolean; mesas: number[] }) {
  const supabase = useRef(criarClienteNavegador()).current;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [minhas, setMinhas] = useState<number[]>([]);
  const [escolhendo, setEscolhendo] = useState(false);
  const [som, setSom] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lancando, setLancando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, setTique] = useState(0);
  const vistos = useRef<Set<string> | null>(null);
  const somRef = useRef(false);
  somRef.current = som;
  const minhasRef = useRef<number[]>([]);
  minhasRef.current = minhas;
  useTelaAcesa();

  useEffect(() => {
    try {
      setMinhas(JSON.parse(localStorage.getItem("cfh-garcom-mesas") ?? "[]"));
    } catch {}
    const t = setInterval(() => setTique((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - 16 * 3600_000).toISOString();
    const [p, c] = await Promise.all([
      supabase
        .from("pedidos")
        .select("id, setor, status, mesa_numero, comanda_numero, criado_em, pronto_em, itens(id, descricao, quantidade, observacao, cancelado)")
        .or("status.eq.pronto,and(setor.eq.balcao,status.in.(novo,preparando))")
        .not("mesa_numero", "is", null)
        .gte("criado_em", desde)
        .order("criado_em"),
      supabase.from("chamados").select("id, mesa_numero, criado_em").is("atendido_em", null).order("criado_em"),
    ]);
    if (p.error || c.error) return setErro(mensagemErro(p.error ?? c.error));
    setErro(null);
    const lp = (p.data ?? []) as Pedido[];
    const lc = (c.data ?? []) as Chamado[];
    const doMeu = (mesa: number | null) => !minhasRef.current.length || (mesa != null && minhasRef.current.includes(mesa));
    // avisa quando fica pronto algo novo ou chega chamado (nas minhas mesas)
    const chaves = [...lp.filter((x) => x.status === "pronto").map((x) => `p${x.id}`), ...lc.map((x) => `c${x.id}`)];
    const novidade =
      vistos.current &&
      [...lp.filter((x) => x.status === "pronto" && doMeu(x.mesa_numero)).map((x) => `p${x.id}`), ...lc.filter((x) => doMeu(x.mesa_numero)).map((x) => `c${x.id}`)].some(
        (k) => !vistos.current!.has(k)
      );
    if (novidade && somRef.current) bip(2, 1175);
    vistos.current = new Set(chaves);
    setPedidos(lp);
    setChamados(lc);
  }, [supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useAoVivo(empresa.id, ["pedidos", "chamados"], carregar, 10_000);

  async function entregar(p: Pedido) {
    setPedidos((l) => l.filter((x) => x.id !== p.id));
    const { error } = await supabase.rpc("mudar_pedido", { p_id: p.id, p_status: "entregue" });
    if (error) setErro(mensagemErro(error));
    carregar();
  }

  async function atender(c: Chamado) {
    setChamados((l) => l.filter((x) => x.id !== c.id));
    const { error } = await supabase.rpc("atender_chamado", { p_id: c.id });
    if (error) setErro(mensagemErro(error));
    carregar();
  }

  function alternarMesa(n: number) {
    const nova = minhas.includes(n) ? minhas.filter((x) => x !== n) : [...minhas, n].sort((a, b) => a - b);
    setMinhas(nova);
    try {
      localStorage.setItem("cfh-garcom-mesas", JSON.stringify(nova));
    } catch {}
  }

  const doMeu = (mesa: number | null) => !minhas.length || (mesa != null && minhas.includes(mesa));
  const prontos = pedidos.filter((p) => p.status === "pronto" && doMeu(p.mesa_numero));
  const balcao = pedidos.filter((p) => p.status !== "pronto" && doMeu(p.mesa_numero));
  const meusChamados = chamados.filter((c) => doMeu(c.mesa_numero));
  const agora = Date.now();
  const limpar = (p: Pedido) => p.itens.filter((i) => !i.cancelado);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <BarraOperacao titulo="Garçom" empresa={empresa.nome} gestao={gestao}>
        <button onClick={() => setEscolhendo(true)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-zinc-300">
          {minhas.length ? `Mesas ${minhas.join(", ")}` : "Todas as mesas"}
        </button>
      </BarraOperacao>

      {!som && (
        <button
          onClick={() => {
            liberarSom();
            setSom(true);
            bip(1);
          }}
          className="bg-amber-500 px-4 py-3 text-center font-semibold text-black"
        >
          Toque aqui para ligar o som e a vibração
        </button>
      )}
      {erro && <p className="bg-rose-500/20 px-4 py-2 text-sm text-rose-200">{erro}</p>}

      {aviso && <p className="bg-emerald-500 px-4 py-2.5 text-center font-semibold text-black">{aviso}</p>}

      <main className={`mx-auto w-full max-w-xl flex-1 space-y-5 p-3 ${empresa.garcom_lanca ? "pb-24" : ""}`}>
        {meusChamados.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-amber-300">Chamando ({meusChamados.length})</h2>
            {meusChamados.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-amber-500/50 bg-amber-500/15 p-3">
                <p className="text-2xl font-bold">Mesa {c.mesa_numero}</p>
                <span className="text-sm text-amber-200">há {minutosDesde(c.criado_em, agora)} min</span>
                <button onClick={() => atender(c)} className="ml-auto rounded-lg bg-amber-400 px-4 py-2.5 font-semibold text-black">
                  Fui atender
                </button>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-emerald-300">Pronto para levar ({prontos.length})</h2>
          {prontos.length === 0 && <p className="rounded-xl bg-white/[0.03] p-4 text-center text-sm text-zinc-500">Nada pronto agora.</p>}
          {prontos.map((p) => (
            <div key={p.id} className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">Mesa {p.mesa_numero}</p>
                <span className="text-sm text-zinc-400">
                  #{p.comanda_numero} · {p.setor === "cozinha" ? "cozinha" : "balcão"}
                </span>
                <span className="ml-auto text-xs text-emerald-200">pronto há {minutosDesde(p.pronto_em ?? p.criado_em, agora)} min</span>
              </div>
              <ul className="my-2 space-y-0.5">
                {limpar(p).map((i) => (
                  <li key={i.id}>
                    <b>{Number(i.quantidade)}×</b> {i.descricao}
                    {i.observacao && <span className="text-sm text-amber-300"> ({i.observacao})</span>}
                  </li>
                ))}
              </ul>
              <button onClick={() => entregar(p)} className="w-full rounded-lg bg-emerald-500 py-3 font-semibold text-black">
                Entreguei na mesa
              </button>
            </div>
          ))}
        </section>

        {balcao.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-zinc-300">Do balcão, ainda não pego ({balcao.length})</h2>
            <p className="px-1 text-xs text-zinc-500">Bebidas e itens prontos. Se ninguém do balcão marcou, pegue e entregue.</p>
            {balcao.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Mesa {p.mesa_numero} <span className="text-sm font-normal text-zinc-400">#{p.comanda_numero} · {minutosDesde(p.criado_em, agora)} min</span>
                  </p>
                  <p className="truncate text-sm text-zinc-300">{limpar(p).map((i) => `${Number(i.quantidade)}× ${i.descricao}`).join(", ")}</p>
                </div>
                <button onClick={() => entregar(p)} className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm">
                  Entreguei
                </button>
              </div>
            ))}
          </section>
        )}
      </main>

      {empresa.garcom_lanca && !lancando && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3">
          <button
            onClick={() => {
              setAviso(null);
              setLancando(true);
            }}
            className="mx-auto block w-full max-w-xl rounded-2xl bg-orange-500 py-4 text-lg font-bold text-black shadow-2xl"
          >
            + Lançar pedido
          </button>
        </div>
      )}
      {lancando && (
        <LancarPedido
          mesas={mesas}
          onFechar={() => setLancando(false)}
          onEnviado={(m) => {
            setLancando(false);
            setAviso(m);
            setTimeout(() => setAviso(null), 5000);
          }}
        />
      )}

      {escolhendo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setEscolhendo(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-t-2xl bg-zinc-900 p-5 sm:rounded-2xl">
            <h2 className="font-semibold">Quais mesas são suas?</h2>
            <p className="text-sm text-zinc-400">Nenhuma marcada = vê todas.</p>
            <div className="grid grid-cols-6 gap-2">
              {mesas.map((n) => (
                <button
                  key={n}
                  onClick={() => alternarMesa(n)}
                  className={`rounded-lg py-2.5 font-semibold ${minhas.includes(n) ? "bg-orange-500 text-black" : "bg-white/5"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMinhas([]);
                  try {
                    localStorage.removeItem("cfh-garcom-mesas");
                  } catch {}
                }}
                className="flex-1 rounded-lg border border-white/10 py-2 text-sm"
              >
                Todas
              </button>
              <button onClick={() => setEscolhendo(false)} className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-black">
                Pronto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
