import Link from "next/link";
import { exigirTela } from "@/lib/contexto";
import { relatorio } from "@/lib/vendas";
import { dataHora, dinheiro, diaSP, FORMAS } from "@/lib/formato";
import { Cartao, Titulo } from "@/components/ui";
import BotaoImprimir from "../comandas/imprimir/BotaoImprimir";
import { ResumoTurno, type ResumoCaixa } from "@/app/caixa/Turno";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const somaDias = (base: string, n: number) => new Date(new Date(`${base}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);
const br = (iso: string) => iso.split("-").reverse().join("/");

type Fech = {
  id: string;
  criado_em: string;
  subtotal: number;
  desconto: number;
  total: number;
  contas: { comanda_numero: number }[];
  fechamento_pagamentos: { forma: string; valor: number; troco: number }[];
};

export default async function Vendas({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { supabase } = await exigirTela([]);
  const q = await searchParams;
  const hoje = diaSP().base;
  const de = q.de && ISO.test(q.de) ? q.de : hoje;
  let ate = q.ate && ISO.test(q.ate) ? q.ate : de;
  if (ate < de) ate = de;
  const inicio = diaSP(de).inicio;
  const fim = diaSP(ate).fim;

  const [rel, { data: fechs }, { data: caixas }] = await Promise.all([
    relatorio(supabase, inicio, fim),
    supabase
      .from("fechamentos")
      .select("id, criado_em, subtotal, desconto, total, contas(comanda_numero), fechamento_pagamentos(forma, valor, troco)")
      .gte("criado_em", inicio.toISOString())
      .lt("criado_em", fim.toISOString())
      .order("criado_em", { ascending: false })
      .limit(500),
    supabase.rpc("caixas_periodo", { p_inicio: inicio.toISOString(), p_fim: fim.toISOString() }),
  ]);
  const turnos = (caixas ?? []) as ResumoCaixa[];

  const primeiroDoMes = `${hoje.slice(0, 8)}01`;
  const atalhos = [
    ["Hoje", hoje, hoje],
    ["Ontem", somaDias(hoje, -1), somaDias(hoje, -1)],
    ["7 dias", somaDias(hoje, -6), hoje],
    ["Este mês", primeiroDoMes, hoje],
  ];
  // faixa de horas com movimento (pelo menos 8 colunas, para a barra não ocupar tudo)
  const valoresHora = new Map(Object.entries(rel.por_hora).map(([h, v]) => [Number(h), Number(v)]));
  const hs = [...valoresHora.keys()];
  let hIni = hs.length ? Math.min(...hs) : 0;
  let hFim = hs.length ? Math.max(...hs) : 0;
  while (hFim - hIni < 7) {
    if (hIni > 0) hIni--;
    if (hFim - hIni < 7 && hFim < 23) hFim++;
  }
  const horas = hs.length ? Array.from({ length: hFim - hIni + 1 }, (_, i) => [hIni + i, valoresHora.get(hIni + i) ?? 0] as const) : [];
  const maxHora = Math.max(1, ...horas.map((h) => h[1]));
  const ticket = rel.pagamentos ? rel.total / rel.pagamentos : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Titulo sub={de === ate ? br(de) : `${br(de)} a ${br(ate)}`}>Vendas</Titulo>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {atalhos.map(([nome, a, b]) => (
            <Link
              key={nome}
              href={`/vendas?de=${a}&ate=${b}`}
              className={`rounded-full px-3 py-1 text-sm ${de === a && ate === b ? "bg-white/15" : "text-zinc-400 hover:bg-white/5"}`}
            >
              {nome}
            </Link>
          ))}
          <form className="flex items-center gap-1 text-sm">
            <input type="date" name="de" defaultValue={de} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1" />
            <span className="text-zinc-500">a</span>
            <input type="date" name="ate" defaultValue={ate} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1" />
            <button className="rounded-lg border border-white/10 px-2 py-1 hover:bg-white/10">Ver</button>
          </form>
          <BotaoImprimir />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao titulo="Total recebido" valor={dinheiro(rel.total)} destaque detalhe={
            [rel.servico > 0 ? `${dinheiro(rel.servico)} de serviço` : "", rel.desconto > 0 ? `${dinheiro(rel.desconto)} em descontos` : ""].filter(Boolean).join(" · ") ||
            undefined
          }
        />
        <Cartao titulo="Comandas pagas" valor={rel.contas} detalhe={`${rel.pagamentos} pagamento(s)`} />
        <Cartao titulo="Ticket médio" valor={dinheiro(ticket)} detalhe="por pagamento" />
        <Cartao
          titulo="Itens cancelados"
          valor={rel.cancelados}
          detalhe={rel.tempo_medio_cozinha_min != null ? `Cozinha: ${String(rel.tempo_medio_cozinha_min).replace(".", ",")} min em média` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 font-semibold">Por forma de pagamento</h2>
          {Object.keys(FORMAS).map((f) => (
            <div key={f} className="flex justify-between border-b border-white/5 py-1.5 text-sm last:border-0">
              <span className="text-zinc-300">{FORMAS[f]}</span>
              <span className="tabular-nums">{dinheiro(rel.por_forma[f] ?? 0)}</span>
            </div>
          ))}
          <p className="mt-2 text-xs text-zinc-500">Dinheiro já descontado o troco. Confira com a gaveta.</p>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Movimento por hora</h2>
          {horas.length === 0 && <p className="text-sm text-zinc-500">Sem vendas no período.</p>}
          <div className="flex h-36 items-end gap-1">
            {horas.map(([h, v]) => (
              <div key={h} className="flex flex-1 flex-col items-center gap-1" title={`${h}h: ${dinheiro(v)}`}>
                <div className={`w-full max-w-10 rounded-t ${v ? "bg-orange-500/70" : "bg-white/5"}`} style={{ height: `${v ? Math.max(4, (v / maxHora) * 110) : 2}px` }} />
                <span className="text-[10px] text-zinc-400">{h}h</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 font-semibold">Mais vendidos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-400">
              <tr>
                <th className="py-1 font-normal">Item</th>
                <th className="py-1 text-right font-normal">Qtd</th>
                <th className="py-1 text-right font-normal">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rel.top.map((t) => (
                <tr key={t.descricao + t.tipo} className="border-t border-white/5">
                  <td className="py-1.5">{t.descricao}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {t.tipo === "quilo" ? `${Number(t.quantidade).toFixed(3).replace(".", ",")} kg` : Number(t.quantidade)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{dinheiro(t.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rel.top.length === 0 && <p className="text-sm text-zinc-500">Nada no período.</p>}
        </div>
      </section>

      {turnos.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Caixas do período ({turnos.length})</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {turnos.map((t) => (
              <div key={t.id} className={`rounded-xl border p-4 ${t.fechado_em ? "border-white/10 bg-white/[0.03]" : "border-orange-500/40 bg-orange-500/[0.06]"}`}>
                {!t.fechado_em && <p className="mb-1 text-xs font-semibold text-orange-300">ABERTO AGORA</p>}
                <ResumoTurno c={t} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 font-semibold">Pagamentos ({(fechs ?? []).length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-left text-xs text-zinc-400">
              <tr>
                <th className="py-1 font-normal">Quando</th>
                <th className="py-1 font-normal">Comandas</th>
                <th className="py-1 font-normal">Forma</th>
                <th className="py-1 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {((fechs ?? []) as unknown as Fech[]).map((f) => (
                <tr key={f.id} className="border-t border-white/5 align-top">
                  <td className="py-1.5 whitespace-nowrap text-zinc-300">{dataHora(f.criado_em)}</td>
                  <td className="py-1.5">{f.contas.map((c) => `#${c.comanda_numero}`).join(", ")}</td>
                  <td className="py-1.5 text-zinc-300">
                    {f.fechamento_pagamentos.length === 0
                      ? "Sem consumo"
                      : f.fechamento_pagamentos.map((p) => `${FORMAS[p.forma]} ${dinheiro(p.valor)}`).join(" + ")}
                    {Number(f.desconto) > 0 && <span className="text-zinc-500"> · desc. {dinheiro(f.desconto)}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{dinheiro(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
