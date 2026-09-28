"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { bip, liberarSom, useAoVivo } from "@/lib/aoVivo";
import { dinheiro, FORMAS, hora, lerNumero, mensagemErro } from "@/lib/formato";
import { qtdTexto, type Produto, type ResumoConta } from "@/lib/tipos";
import type { Empresa } from "@/lib/contexto";
import BarraOperacao from "@/components/BarraOperacao";
import CampoLeitura from "@/components/CampoLeitura";
import LeitorQR from "@/components/LeitorQR";
import { AbrirCaixa, FecharCaixa, MovimentoCaixa, type ResumoCaixa } from "./Turno";

type Aberta = { id: string; comanda_numero: number; mesa_numero: number | null; aberta_em: string; total: number };
type Pagamento = { forma: keyof typeof FORMAS; valor: string };
type Janela = { tipo: "peso" | "avulso" | "produto"; conta: ResumoConta } | null;
type Pago = { total: number; troco: number; servico: number; comandas: number[] };

const centavos = (v: number) => Math.round(v * 100) / 100;

export default function Caixa({ empresa, gestao }: { empresa: Empresa; gestao: boolean }) {
  const supabase = useRef(criarClienteNavegador()).current;
  const [abertas, setAbertas] = useState<Aberta[]>([]);
  const [selecao, setSelecao] = useState<ResumoConta[]>([]);
  const [busca, setBusca] = useState("");
  const [camera, setCamera] = useState(false);
  const [desconto, setDesconto] = useState("");
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [janela, setJanela] = useState<Janela>(null);
  const [pago, setPago] = useState<Pago | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [caixa, setCaixa] = useState<ResumoCaixa | null | undefined>(undefined); // undefined = carregando
  const [turno, setTurno] = useState<"movimento" | "fechar" | null>(null);
  const [cobrarServico, setCobrarServico] = useState(true);
  const ocupadoRef = useRef(false);
  const selecaoRef = useRef<ResumoConta[]>([]);
  selecaoRef.current = selecao;

  // ---------- dados ----------
  const carregar = useCallback(async () => {
    const cx = await supabase.rpc("caixa_atual");
    if (!cx.error) setCaixa((cx.data as ResumoCaixa | null) ?? null);
    const { data, error } = await supabase
      .from("contas")
      .select("id, comanda_numero, mesa_numero, aberta_em, itens(total, cancelado)")
      .eq("status", "aberta")
      .order("comanda_numero");
    if (error) return setErro(mensagemErro(error));
    setAbertas(
      (data ?? []).map((c) => ({
        id: c.id,
        comanda_numero: c.comanda_numero,
        mesa_numero: c.mesa_numero,
        aberta_em: c.aberta_em,
        total: ((c.itens ?? []) as { total: number; cancelado: boolean }[]).filter((i) => !i.cancelado).reduce((s, i) => s + Number(i.total), 0),
      }))
    );
    // atualiza as contas selecionadas (pedido novo chegando enquanto está no caixa)
    const sel = selecaoRef.current;
    if (sel.length) {
      const novos = await Promise.all(sel.map((s) => supabase.rpc("resumo_conta", { p_conta: s.conta_id! })));
      setSelecao(novos.map((r, i) => (r.data as ResumoConta) ?? sel[i]).filter((c) => c.status === "aberta"));
    }
  }, [supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useAoVivo(empresa.id, ["contas", "itens", "caixas", "caixa_movimentos"], carregar, 20_000);

  // ---------- selecionar comandas ----------
  const adicionarConta = useCallback((c: ResumoConta) => {
    setPago(null);
    setErro(null);
    setSelecao((s) => (s.some((x) => x.conta_id === c.conta_id) ? s.map((x) => (x.conta_id === c.conta_id ? c : x)) : [...s, c]));
    setPagamentos([]);
  }, []);

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
        setErro(falha);
        return;
      }
      bip(1, 1320);
      adicionarConta(data as ResumoConta);
    },
    [supabase, adicionarConta]
  );

  async function escolherAberta(a: Aberta) {
    const { data, error } = await supabase.rpc("resumo_conta", { p_conta: a.id });
    if (error) return setErro(mensagemErro(error));
    adicionarConta(data as ResumoConta);
  }

  function tirar(id: string) {
    setSelecao((s) => s.filter((x) => x.conta_id !== id));
    setPagamentos([]);
  }

  async function rodar(fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, conta?: string) {
    setErro(null);
    setOcupado(true);
    const { data, error } = await fn();
    setOcupado(false);
    if (error) {
      setErro(mensagemErro(error));
      return false;
    }
    if (conta && data && typeof data === "object" && "conta_id" in data) adicionarConta(data as ResumoConta);
    else await carregar();
    return true;
  }

  async function cancelarItem(itemId: string, descricao: string) {
    const motivo = window.prompt(`Cancelar “${descricao}”? Escreva o motivo:`)?.trim();
    if (!motivo) return;
    await rodar(() => supabase.rpc("cancelar_item", { p_item: itemId, p_motivo: motivo }));
  }

  async function perdida(c: ResumoConta) {
    const multa = Number(empresa.multa_comanda);
    const msg = multa > 0 ? `Lançar multa de ${dinheiro(multa)} na comanda ${c.comanda}? Ela será bloqueada ao pagar.` : `Marcar a comanda ${c.comanda} como perdida? Ela será bloqueada ao pagar.`;
    if (!window.confirm(msg)) return;
    await rodar(() => supabase.rpc("comanda_perdida", { p_conta: c.conta_id }), c.conta_id!);
  }

  // ---------- valores ----------
  const subtotal = centavos(selecao.reduce((s, c) => s + Number(c.total), 0));
  const taxa = Number(empresa.taxa_servico) || 0;
  const baseServico = centavos(selecao.reduce((s, c) => s + Number(c.base_servico ?? 0), 0));
  const servico = taxa > 0 && cobrarServico ? centavos((baseServico * taxa) / 100) : 0;
  const descontoNum = centavos(Math.max(0, lerNumero(desconto) ?? 0));
  const total = centavos(Math.max(0, subtotal + servico - descontoNum));
  const pagoNum = centavos(pagamentos.reduce((s, p) => s + (lerNumero(p.valor) ?? 0), 0));
  const falta = centavos(Math.max(0, total - pagoNum));
  const troco = centavos(Math.max(0, pagoNum - total));
  const temDinheiro = pagamentos.some((p) => p.forma === "dinheiro");
  const trocoInvalido = troco > 0 && !temDinheiro;
  const podeFechar = !!caixa && selecao.length > 0 && falta === 0 && !trocoInvalido && descontoNum <= subtotal + servico;

  function addForma(forma: Pagamento["forma"]) {
    const valor = falta > 0 ? falta.toFixed(2).replace(".", ",") : "";
    setPagamentos((p) => [...p, { forma, valor }]);
  }

  async function fechar() {
    if (!podeFechar || ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    setErro(null);
    const { data, error } = await supabase.rpc("fechar_contas", {
      p_contas: selecao.map((c) => c.conta_id),
      p_pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: lerNumero(p.valor) ?? 0 })).filter((p) => p.valor > 0),
      p_desconto: descontoNum,
      p_servico: taxa > 0 && cobrarServico,
    });
    ocupadoRef.current = false;
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    const r = data as { total: number; troco: number; servico: number };
    bip(1, 1568);
    setPago({ total: Number(r.total), troco: Number(r.troco), servico: Number(r.servico), comandas: selecao.map((c) => c.comanda) });
    setCobrarServico(true);
    setSelecao([]);
    setPagamentos([]);
    setDesconto("");
    carregar();
  }

  const listaAbertas = useMemo(() => {
    const b = busca.trim();
    const sel = new Set(selecao.map((s) => s.conta_id));
    return abertas.filter((a) => !sel.has(a.id) && (!b || String(a.comanda_numero).startsWith(b) || String(a.mesa_numero ?? "") === b));
  }, [abertas, busca, selecao]);

  // ======================================================================
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <BarraOperacao titulo="Caixa" empresa={empresa.nome} gestao={gestao}>
        {caixa && (
          <>
            <span className="hidden text-xs text-zinc-400 md:block">Caixa aberto {hora(caixa.aberto_em)}</span>
            <button onClick={() => setTurno("movimento")} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10">
              Sangria / reforço
            </button>
            <button onClick={() => setTurno("fechar")} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/10">
              Fechar caixa
            </button>
          </>
        )}
      </BarraOperacao>
      {caixa === null && (
        <AbrirCaixa
          onAberto={(c) => {
            setCaixa(c);
            setErro(null);
          }}
        />
      )}
      {turno === "movimento" && caixa && (
        <MovimentoCaixa
          onFechar={() => setTurno(null)}
          onFeito={(c) => {
            setCaixa(c);
            setTurno(null);
          }}
        />
      )}
      {turno === "fechar" && caixa && (
        <FecharCaixa
          caixa={caixa}
          abertas={abertas.length}
          onFechar={() => setTurno(null)}
          onFechado={() => {
            setTurno(null);
            setSelecao([]);
            setPagamentos([]);
            setPago(null);
            carregar();
          }}
        />
      )}
      <div className={`grid flex-1 gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)] ${caixa ? "" : "hidden"}`}>
        {/* ---------- ESQUERDA: leitura e abertas ---------- */}
        <aside className="space-y-3">
          <CampoLeitura onLer={ler} ocupado={ocupado} manterFoco={!janela} />
          <button onClick={() => setCamera((c) => !c)} className="w-full rounded-xl border border-white/10 py-2 text-sm text-zinc-300">
            {camera ? "Desligar câmera" : "Ler com a câmera"}
          </button>
          {camera && <LeitorQR onLer={ler} pausado={ocupado} className="aspect-[4/3] w-full" />}

          <section className="rounded-2xl bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-300">Abertas ({abertas.length})</h2>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="nº ou mesa"
                className="ml-auto w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm outline-none"
              />
            </div>
            <div className="max-h-[50dvh] overflow-y-auto">
              {listaAbertas.length === 0 && <p className="py-4 text-center text-sm text-zinc-500">{abertas.length ? "Nenhuma outra." : "Nenhuma."}</p>}
              {listaAbertas.map((a) => (
                <button key={a.id} onClick={() => escolherAberta(a)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5">
                  <b className="w-12 text-base">#{a.comanda_numero}</b>
                  <span className="flex-1 text-zinc-400">
                    {a.mesa_numero ? `mesa ${a.mesa_numero} · ` : ""}
                    {hora(a.aberta_em)}
                  </span>
                  <span className="tabular-nums">{dinheiro(a.total)}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">Cliente perdeu a comanda? Ache pela mesa aqui, toque e use “Perdeu a comanda”.</p>
          </section>
        </aside>

        {/* ---------- DIREITA: conta e pagamento ---------- */}
        <main className="min-w-0 space-y-4">
          {erro && <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">{erro}</p>}

          {pago && (
            <div className="rounded-2xl bg-emerald-500 p-6 text-center text-black">
              <p className="text-3xl font-black">Pago ✓ {dinheiro(pago.total)}</p>
              {pago.servico > 0 && <p className="text-sm font-medium">inclui {dinheiro(pago.servico)} de serviço</p>}
              {pago.troco > 0 && <p className="mt-2 text-4xl font-black">Troco: {dinheiro(pago.troco)}</p>}
              <p className="mt-2 text-lg font-medium">
                Recolha a{pago.comandas.length > 1 ? "s" : ""} comanda{pago.comandas.length > 1 ? "s" : ""} {pago.comandas.map((n) => `#${n}`).join(", ")} e libere a saída.
              </p>
              <button onClick={() => setPago(null)} className="mt-4 rounded-xl bg-black/80 px-6 py-2.5 font-semibold text-white">
                Próximo cliente
              </button>
            </div>
          )}

          {!pago && selecao.length === 0 && (
            <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 p-8 text-center text-zinc-400">
              <p className="text-lg text-zinc-200">Leia a comanda do cliente</p>
              <p className="text-sm">Pagando junto? Leia uma depois da outra: as contas somam.</p>
            </div>
          )}

          {selecao.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-3">
                {selecao.map((c) => (
                  <section key={c.conta_id} className="rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
                      <h2 className="text-lg font-bold">Comanda {c.comanda}</h2>
                      <span className="text-sm text-zinc-400">
                        {c.mesa ? `mesa ${c.mesa} · ` : ""}entrou {hora(c.aberta_em)}
                      </span>
                      <span className="ml-auto text-lg font-semibold tabular-nums">{dinheiro(c.total)}</span>
                      <button onClick={() => tirar(c.conta_id!)} className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/10" aria-label="Tirar da conta">
                        ✕
                      </button>
                    </div>
                    <ul className="px-4 py-2">
                      {c.itens.length === 0 && <li className="py-2 text-sm text-zinc-500">Sem consumo.</li>}
                      {c.itens.map((i) => (
                        <li key={i.id} className={`flex items-center gap-2 border-b border-white/5 py-1.5 text-sm last:border-0 ${i.cancelado ? "text-zinc-600 line-through" : ""}`}>
                          <span className="w-16 shrink-0 tabular-nums text-zinc-400">{qtdTexto(i)}</span>
                          <span className="min-w-0 flex-1 truncate">
                            {i.descricao}
                            {i.tipo === "produto" && !i.cancelado && i.status !== "entregue" && <span className="ml-2 rounded bg-amber-500/20 px-1.5 text-[11px] text-amber-300">{i.status === "pronto" ? "pronto, não entregue" : "ainda na cozinha"}</span>}
                          </span>
                          <span className="tabular-nums">{dinheiro(i.total)}</span>
                          {!i.cancelado && (
                            <button onClick={() => cancelarItem(i.id, i.descricao)} className="rounded px-1.5 text-xs text-rose-300 hover:bg-rose-500/10" title="Cancelar item">
                              cancelar
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-2.5 text-sm">
                      {empresa.usa_quilo && (
                        <button onClick={() => setJanela({ tipo: "peso", conta: c })} className="rounded-lg bg-white/10 px-3 py-1.5">
                          + Peso (kg)
                        </button>
                      )}
                      <button onClick={() => setJanela({ tipo: "produto", conta: c })} className="rounded-lg bg-white/10 px-3 py-1.5">
                        + Produto
                      </button>
                      <button onClick={() => setJanela({ tipo: "avulso", conta: c })} className="rounded-lg bg-white/10 px-3 py-1.5">
                        + Avulso
                      </button>
                      <button onClick={() => perdida(c)} className="ml-auto rounded-lg px-3 py-1.5 text-rose-300 hover:bg-rose-500/10">
                        Perdeu a comanda
                      </button>
                    </div>
                  </section>
                ))}
              </div>

              {/* pagamento */}
              <section className="h-fit space-y-3 rounded-2xl border border-orange-500/30 bg-orange-500/[0.06] p-4">
                <div className="flex justify-between text-sm text-zinc-300">
                  <span>Subtotal ({selecao.length} comanda{selecao.length > 1 ? "s" : ""})</span>
                  <span className="tabular-nums">{dinheiro(subtotal)}</span>
                </div>
                {taxa > 0 && (
                  <label className="flex items-center justify-between gap-2 text-sm text-zinc-300">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={cobrarServico} onChange={(e) => setCobrarServico(e.target.checked)} className="h-4 w-4 accent-orange-500" />
                      Serviço {String(taxa).replace(".", ",")}%{!cobrarServico && <span className="text-xs text-zinc-500">(cliente não quis)</span>}
                    </span>
                    <span className="tabular-nums">{dinheiro(servico)}</span>
                  </label>
                )}
                <label className="flex items-center justify-between gap-2 text-sm text-zinc-300">
                  Desconto (R$)
                  <input value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" placeholder="0,00" className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right outline-none" />
                </label>
                <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
                  <span className="font-semibold">Total</span>
                  <span className="text-3xl font-black tabular-nums">{dinheiro(total)}</span>
                </div>

                {total > 0 && (
                  <>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(Object.keys(FORMAS) as Pagamento["forma"][]).map((f) => (
                        <button key={f} onClick={() => addForma(f)} className="rounded-lg bg-white/10 py-2.5 text-sm font-semibold hover:bg-white/15">
                          {FORMAS[f]}
                        </button>
                      ))}
                    </div>
                    {pagamentos.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-20 text-sm">{FORMAS[p.forma]}</span>
                        <input
                          value={p.valor}
                          onChange={(e) => setPagamentos((l) => l.map((x, k) => (k === i ? { ...x, valor: e.target.value } : x)))}
                          inputMode="decimal"
                          autoFocus={p.forma === "dinheiro"}
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-right text-lg tabular-nums outline-none focus:border-orange-500"
                        />
                        <button onClick={() => setPagamentos((l) => l.filter((_, k) => k !== i))} className="px-1 text-zinc-500" aria-label="Remover">
                          ✕
                        </button>
                      </div>
                    ))}
                    {pagamentos.length === 0 && <p className="text-center text-xs text-zinc-400">Toque na forma de pagamento. Dá para dividir em mais de uma.</p>}
                    {falta > 0 && pagamentos.length > 0 && <p className="text-right text-sm text-amber-300">Falta {dinheiro(falta)}</p>}
                    {troco > 0 && (
                      <p className={`text-right text-lg font-bold ${trocoInvalido ? "text-rose-300" : "text-emerald-300"}`}>
                        {trocoInvalido ? "Valor a mais só em dinheiro" : `Troco: ${dinheiro(troco)}`}
                      </p>
                    )}
                  </>
                )}

                <button onClick={fechar} disabled={!podeFechar || ocupado} className="w-full rounded-xl bg-orange-500 py-4 text-lg font-bold text-black disabled:opacity-40">
                  {ocupado ? "Salvando..." : total > 0 ? `Receber ${dinheiro(total)}` : "Liberar sem consumo"}
                </button>
              </section>
            </div>
          )}
        </main>
      </div>

      {janela && (
        <JanelaLancar
          janela={janela}
          empresa={empresa}
          onFechar={() => setJanela(null)}
          onFeito={(c) => {
            adicionarConta(c);
            setJanela(null);
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Lançar peso, produto ou item avulso numa comanda
function JanelaLancar({ janela, empresa, onFechar, onFeito }: { janela: NonNullable<Janela>; empresa: Empresa; onFechar: () => void; onFeito: (c: ResumoConta) => void }) {
  const supabase = useRef(criarClienteNavegador()).current;
  const [peso, setPeso] = useState("");
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState("1");
  const [valor, setValor] = useState("");
  const [busca, setBusca] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const leitura = String(janela.conta.comanda);

  useEffect(() => {
    if (janela.tipo !== "produto") return;
    supabase
      .from("produtos")
      .select("id, categoria_id, nome, descricao, preco, foto, setor, disponivel, ordem")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setProdutos((data ?? []) as Produto[]));
  }, [janela.tipo, supabase]);

  // "456" vira 0,456 kg (gramas); "0,456" já é kg
  const kg = (() => {
    const n = lerNumero(peso);
    if (n == null) return null;
    return n >= 10 ? n / 1000 : n;
  })();

  async function lancar(fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
    setErro(null);
    setOcupado(true);
    const { data, error } = await fn();
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    onFeito(data as ResumoConta);
  }

  const lista = produtos.filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 40);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-900 p-5 sm:rounded-2xl">
        <h2 className="text-lg font-semibold">
          {janela.tipo === "peso" ? "Lançar peso" : janela.tipo === "produto" ? "Adicionar produto" : "Item avulso"} · comanda {janela.conta.comanda}
        </h2>

        {janela.tipo === "peso" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (kg == null) return setErro("Digite o peso.");
              lancar(() => supabase.rpc("lancar_item", { p_leitura: leitura, p_tipo: "quilo", p_quantidade: kg }));
            }}
            className="space-y-3"
          >
            <input value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" autoFocus placeholder="0,450 ou 450 g" className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-3xl tabular-nums outline-none focus:border-orange-500" />
            <p className="text-sm text-zinc-400">
              {kg != null ? `${kg.toFixed(3).replace(".", ",")} kg × ${dinheiro(empresa.preco_quilo)} = ` : `Preço do quilo: ${dinheiro(empresa.preco_quilo)}`}
              {kg != null && <b className="text-lg text-zinc-100">{dinheiro(centavos(kg * Number(empresa.preco_quilo)))}</b>}
            </p>
            {erro && <p className="text-sm text-rose-300">{erro}</p>}
            <button disabled={ocupado} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-black disabled:opacity-50">
              Lançar
            </button>
          </form>
        )}

        {janela.tipo === "avulso" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = lerNumero(valor);
              const q = lerNumero(qtd) ?? 1;
              if (!desc.trim()) return setErro("Descreva o item.");
              if (v == null || v <= 0) return setErro("Valor inválido.");
              lancar(() => supabase.rpc("lancar_item", { p_leitura: leitura, p_tipo: "avulso", p_descricao: desc, p_quantidade: q, p_preco: v }));
            }}
            className="space-y-3"
          >
            <input value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus placeholder="O que é (ex.: Taxa de rolha)" maxLength={80} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-orange-500" />
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" placeholder="Qtd" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none" />
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="Valor unitário (R$)" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none" />
            </div>
            {erro && <p className="text-sm text-rose-300">{erro}</p>}
            <button disabled={ocupado} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-black disabled:opacity-50">
              Lançar
            </button>
          </form>
        )}

        {janela.tipo === "produto" && (
          <div className="space-y-2">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus placeholder="Buscar produto" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-orange-500" />
            <p className="text-xs text-zinc-500">Entra como já entregue (vendido aqui no caixa).</p>
            {erro && <p className="text-sm text-rose-300">{erro}</p>}
            <div className="max-h-80 overflow-y-auto">
              {lista.map((p) => (
                <button
                  key={p.id}
                  disabled={ocupado || !p.disponivel}
                  onClick={() => lancar(() => supabase.rpc("enviar_pedido", { p_leitura: leitura, p_mesa: null, p_itens: [{ produto_id: p.id, quantidade: 1 }], p_no_caixa: true }))}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left hover:bg-white/5 disabled:opacity-40"
                >
                  <span>{p.nome}</span>
                  <span className="tabular-nums text-zinc-300">{p.disponivel ? dinheiro(p.preco) : "acabou"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={onFechar} className="w-full py-1 text-sm text-zinc-400">
          Cancelar
        </button>
      </div>
    </div>
  );
}
