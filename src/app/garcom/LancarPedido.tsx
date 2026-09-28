"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { dinheiro, mensagemErro } from "@/lib/formato";
import type { Categoria, Produto, ResumoConta } from "@/lib/tipos";
import LeitorQR from "@/components/LeitorQR";

type Item = { produto: Produto; quantidade: number; observacao: string };

// Garçom lança o pedido no celular (para quem não quer usar o tablet)
export default function LancarPedido({ mesas, onFechar, onEnviado }: { mesas: number[]; onFechar: () => void; onEnviado: (msg: string) => void }) {
  const supabase = useRef(criarClienteNavegador()).current;
  const [etapa, setEtapa] = useState<"comanda" | "itens">("comanda");
  const [mesa, setMesa] = useState<number | null>(null);
  const [numero, setNumero] = useState("");
  const [camera, setCamera] = useState(false);
  const [conta, setConta] = useState<ResumoConta | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [cat, setCat] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("categorias").select("id, nome, ordem, ativa").eq("ativa", true).order("ordem"),
      supabase.from("produtos").select("id, categoria_id, nome, descricao, preco, foto, setor, disponivel, ordem").eq("ativo", true).order("ordem").order("nome"),
    ]).then(([c, p]) => {
      setCategorias((c.data ?? []) as Categoria[]);
      setProdutos((p.data ?? []) as Produto[]);
    });
  }, [supabase]);

  async function conferir(leitura: string) {
    if (!mesa) return setErro("Escolha a mesa.");
    setErro(null);
    setOcupado(true);
    const { data, error } = await supabase.rpc("ler_comanda", { p_leitura: leitura });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    const r = data as ResumoConta;
    setConta(r);
    setNumero(String(r.comanda));
    setCamera(false);
    setEtapa("itens");
  }

  function mais(p: Produto) {
    setItens((l) => {
      const i = l.findIndex((x) => x.produto.id === p.id && !x.observacao);
      if (i >= 0) return l.map((x, k) => (k === i ? { ...x, quantidade: Math.min(50, x.quantidade + 1) } : x));
      return [...l, { produto: p, quantidade: 1, observacao: "" }];
    });
  }

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return produtos.filter((p) => (cat === "todas" || p.categoria_id === cat) && (!b || p.nome.toLowerCase().includes(b)));
  }, [produtos, cat, busca]);
  const total = itens.reduce((s, x) => s + x.quantidade * Number(x.produto.preco), 0);
  const qtd = itens.reduce((s, x) => s + x.quantidade, 0);

  async function enviar() {
    if (!itens.length || !conta) return;
    setErro(null);
    setOcupado(true);
    const { error } = await supabase.rpc("enviar_pedido", {
      p_leitura: String(conta.comanda),
      p_mesa: mesa,
      p_itens: itens.map((x) => ({ produto_id: x.produto.id, quantidade: x.quantidade, observacao: x.observacao })),
    });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    onEnviado(`Pedido enviado · Mesa ${mesa} · Comanda ${conta.comanda}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button onClick={etapa === "itens" ? () => setEtapa("comanda") : onFechar} className="rounded-lg px-2 py-1 text-zinc-300 hover:bg-white/10">
          ←
        </button>
        <div>
          <p className="font-semibold leading-tight">Lançar pedido</p>
          {etapa === "itens" && conta && (
            <p className="text-xs text-orange-300">
              Mesa {mesa} · Comanda {conta.comanda}
              {conta.status === "livre" ? " (abre agora)" : ` · já consumiu ${dinheiro(conta.total)}`}
            </p>
          )}
        </div>
        <button onClick={onFechar} className="ml-auto text-sm text-zinc-400">
          Cancelar
        </button>
      </header>

      {etapa === "comanda" && (
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-sm text-zinc-300">Mesa</p>
            <div className="grid grid-cols-6 gap-2">
              {mesas.map((n) => (
                <button key={n} onClick={() => setMesa(n)} className={`rounded-lg py-2.5 font-semibold ${mesa === n ? "bg-orange-500 text-black" : "bg-white/5"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (numero.trim()) conferir(numero.trim());
            }}
            className="space-y-2"
          >
            <p className="text-sm text-zinc-300">Número da comanda do cliente</p>
            <div className="flex gap-2">
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="ex.: 12"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-2xl outline-none focus:border-orange-500"
              />
              <button disabled={ocupado || !numero} className="rounded-xl bg-orange-500 px-5 font-bold text-black disabled:opacity-40">
                OK
              </button>
            </div>
          </form>
          <button onClick={() => setCamera((c) => !c)} className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-zinc-300">
            {camera ? "Fechar câmera" : "Ler o QR da comanda"}
          </button>
          {camera && <LeitorQR onLer={conferir} pausado={ocupado} className="aspect-square w-full" />}
          {erro && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{erro}</p>}
        </div>
      )}

      {etapa === "itens" && (
        <>
          <div className="space-y-2 border-b border-white/10 p-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no cardápio"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-orange-500"
            />
            <div className="sem-barra flex gap-1.5 overflow-x-auto">
              {[{ id: "todas", nome: "Tudo" }, ...categorias].map((c) => (
                <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full px-3 py-1 text-sm ${cat === c.id ? "bg-white/15" : "text-zinc-400"}`}>
                  {c.nome}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {lista.map((p) => {
              const n = itens.filter((x) => x.produto.id === p.id).reduce((s, x) => s + x.quantidade, 0);
              return (
                <button
                  key={p.id}
                  disabled={!p.disponivel}
                  onClick={() => mais(p)}
                  className="flex w-full items-center gap-3 border-b border-white/5 py-3 text-left disabled:opacity-40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.nome}</span>
                    <span className="text-sm text-zinc-400">{p.disponivel ? dinheiro(p.preco) : "acabou"}</span>
                  </span>
                  {n > 0 && <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-sm font-bold text-black">{n}</span>}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl">+</span>
                </button>
              );
            })}
          </div>

          {itens.length > 0 && (
            <div className="max-h-[45dvh] space-y-2 overflow-y-auto border-t border-white/10 bg-zinc-900 p-3">
              {itens.map((x, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{x.produto.nome}</span>
                    <button
                      onClick={() => setItens((l) => l.map((y, k) => (k === i ? { ...y, quantidade: y.quantidade - 1 } : y)).filter((y) => y.quantidade > 0))}
                      className="h-8 w-8 rounded-full bg-white/10"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-semibold">{x.quantidade}</span>
                    <button
                      onClick={() => setItens((l) => l.map((y, k) => (k === i ? { ...y, quantidade: Math.min(50, y.quantidade + 1) } : y)))}
                      className="h-8 w-8 rounded-full bg-white/10"
                    >
                      +
                    </button>
                  </div>
                  <input
                    value={x.observacao}
                    onChange={(e) => setItens((l) => l.map((y, k) => (k === i ? { ...y, observacao: e.target.value } : y)))}
                    maxLength={140}
                    placeholder="Observação (ex.: sem cebola)"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm outline-none"
                  />
                </div>
              ))}
              {erro && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{erro}</p>}
              <button onClick={enviar} disabled={ocupado} className="flex w-full items-center justify-between rounded-xl bg-orange-500 px-4 py-3.5 font-bold text-black disabled:opacity-50">
                <span>{ocupado ? "Enviando..." : `Enviar (${qtd})`}</span>
                <span>{dinheiro(total)}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
