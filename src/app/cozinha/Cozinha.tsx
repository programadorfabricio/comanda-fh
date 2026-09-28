"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { bip, liberarSom, useAoVivo, useTelaAcesa } from "@/lib/aoVivo";
import { mensagemErro, minutosDesde } from "@/lib/formato";
import type { Empresa } from "@/lib/contexto";
import BarraOperacao from "@/components/BarraOperacao";

type Pedido = {
  id: string;
  setor: "cozinha" | "balcao";
  status: "novo" | "preparando" | "pronto";
  mesa_numero: number | null;
  comanda_numero: number;
  origem: string;
  criado_em: string;
  pronto_em: string | null;
  itens: { id: string; descricao: string; quantidade: number; observacao: string; cancelado: boolean }[];
};

type Filtro = "todos" | "cozinha" | "balcao";

export default function Cozinha({ empresa, gestao }: { empresa: Empresa; gestao: boolean }) {
  const supabase = useRef(criarClienteNavegador()).current;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [som, setSom] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [, setTique] = useState(0);
  const conhecidos = useRef<Set<string> | null>(null);
  const somRef = useRef(false);
  somRef.current = som;
  useTelaAcesa();

  useEffect(() => {
    try {
      const f = localStorage.getItem("cfh-cozinha-filtro") as Filtro | null;
      if (f) setFiltro(f);
    } catch {}
    const t = setInterval(() => setTique((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - 16 * 3600_000).toISOString();
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, setor, status, mesa_numero, comanda_numero, origem, criado_em, pronto_em, itens(id, descricao, quantidade, observacao, cancelado)")
      .in("status", ["novo", "preparando", "pronto"])
      .gte("criado_em", desde)
      .order("criado_em");
    if (error) return setErro(mensagemErro(error));
    setErro(null);
    const lista = (data ?? []) as Pedido[];
    // bip quando chega pedido novo (não no primeiro carregamento)
    const novos = lista.filter((p) => p.status === "novo" && conhecidos.current && !conhecidos.current.has(p.id));
    if (novos.length && somRef.current) bip(3, 988);
    conhecidos.current = new Set(lista.map((p) => p.id));
    setPedidos(lista);
  }, [supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useAoVivo(empresa.id, ["pedidos", "itens"], carregar, 10_000);

  async function mudar(p: Pedido, status: string) {
    setOcupado(p.id);
    // muda na tela na hora; se der erro, recarrega
    setPedidos((l) => l.map((x) => (x.id === p.id ? { ...x, status: status as Pedido["status"], pronto_em: status === "pronto" ? new Date().toISOString() : x.pronto_em } : x)));
    const { error } = await supabase.rpc("mudar_pedido", { p_id: p.id, p_status: status });
    setOcupado(null);
    if (error) setErro(mensagemErro(error));
    carregar();
  }

  function escolher(f: Filtro) {
    setFiltro(f);
    try {
      localStorage.setItem("cfh-cozinha-filtro", f);
    } catch {}
  }

  const visiveis = pedidos
    .map((p) => ({ ...p, itens: p.itens.filter((i) => !i.cancelado) }))
    .filter((p) => p.itens.length && (filtro === "todos" || p.setor === filtro));
  const agora = Date.now();
  const colunas: { status: Pedido["status"]; titulo: string }[] = [
    { status: "novo", titulo: "Novos" },
    { status: "preparando", titulo: "Preparando" },
    { status: "pronto", titulo: "Prontos · esperando garçom" },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <BarraOperacao titulo="Cozinha" empresa={empresa.nome} gestao={gestao}>
        <div className="hidden gap-1 rounded-lg bg-white/5 p-1 text-sm sm:flex">
          {(["todos", "cozinha", "balcao"] as const).map((f) => (
            <button key={f} onClick={() => escolher(f)} className={`rounded-md px-3 py-1 ${filtro === f ? "bg-white/15" : "text-zinc-400"}`}>
              {f === "todos" ? "Tudo" : f === "cozinha" ? "Cozinha" : "Balcão"}
            </button>
          ))}
        </div>
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
          Toque aqui para ligar o som de pedido novo
        </button>
      )}
      {erro && <p className="bg-rose-500/20 px-4 py-2 text-sm text-rose-200">{erro}</p>}

      <div className="flex gap-1 p-2 text-sm sm:hidden">
        {(["todos", "cozinha", "balcao"] as const).map((f) => (
          <button key={f} onClick={() => escolher(f)} className={`flex-1 rounded-md py-1.5 ${filtro === f ? "bg-white/15" : "bg-white/5 text-zinc-400"}`}>
            {f === "todos" ? "Tudo" : f === "cozinha" ? "Cozinha" : "Balcão"}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-3 p-3 md:grid-cols-3">
        {colunas.map((col) => {
          const lista = visiveis.filter((p) => p.status === col.status);
          const mostrar = col.status === "pronto" ? lista.slice(-12).reverse() : lista;
          return (
            <section key={col.status} className="flex min-h-0 flex-col rounded-2xl bg-white/[0.03] p-2">
              <h2 className="px-2 py-1 text-sm font-semibold text-zinc-300">
                {col.titulo} <span className="text-zinc-500">({lista.length})</span>
              </h2>
              <div className="flex flex-col gap-2 overflow-y-auto">
                {mostrar.length === 0 && <p className="px-2 py-6 text-center text-sm text-zinc-600">—</p>}
                {mostrar.map((p) => {
                  const min = minutosDesde(p.criado_em, agora);
                  const cor =
                    p.status === "pronto" ? "bg-emerald-500/20 text-emerald-200" : min >= 20 ? "bg-rose-500 text-white" : min >= 10 ? "bg-amber-400 text-black" : "bg-white/10 text-zinc-200";
                  return (
                    <article
                      key={p.id}
                      className={`rounded-xl border p-3 ${
                        p.status === "novo" ? "border-orange-500/60 bg-orange-500/10" : p.status === "preparando" ? "border-sky-500/40 bg-sky-500/5" : "border-white/10 bg-black/20 opacity-80"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-xl font-bold">{p.mesa_numero ? `Mesa ${p.mesa_numero}` : p.origem === "caixa" ? "Caixa" : "Balcão"}</p>
                        <span className="text-sm text-zinc-400">#{p.comanda_numero}</span>
                        {filtro === "todos" && (
                          <span className="rounded bg-white/10 px-1.5 text-[11px] uppercase text-zinc-300">{p.setor === "cozinha" ? "cozinha" : "balcão"}</span>
                        )}
                        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cor}`}>{min} min</span>
                      </div>
                      <ul className="space-y-1">
                        {p.itens.map((i) => (
                          <li key={i.id} className="leading-tight">
                            <span className="text-lg font-semibold">
                              {Number(i.quantidade)}× {i.descricao}
                            </span>
                            {i.observacao && <span className="block text-sm font-medium text-amber-300">→ {i.observacao}</span>}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex gap-2">
                        {p.status === "novo" && (
                          <>
                            <button disabled={ocupado === p.id} onClick={() => mudar(p, "preparando")} className="flex-1 rounded-lg bg-sky-500 py-2.5 font-semibold text-black">
                              Começar
                            </button>
                            <button disabled={ocupado === p.id} onClick={() => mudar(p, "pronto")} className="flex-1 rounded-lg bg-emerald-500 py-2.5 font-semibold text-black">
                              Pronto
                            </button>
                          </>
                        )}
                        {p.status === "preparando" && (
                          <button disabled={ocupado === p.id} onClick={() => mudar(p, "pronto")} className="flex-1 rounded-lg bg-emerald-500 py-3 text-lg font-semibold text-black">
                            Pronto ✓
                          </button>
                        )}
                        {p.status === "pronto" && (
                          <button disabled={ocupado === p.id} onClick={() => mudar(p, "preparando")} className="rounded-lg px-3 py-1 text-xs text-zinc-400 hover:bg-white/10">
                            Voltar para preparando
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
