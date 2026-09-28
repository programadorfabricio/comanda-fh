import { exigirTela } from "@/lib/contexto";
import { contasAbertas, relatorio } from "@/lib/vendas";
import { dinheiro, diaSP, FORMAS, hora, minutosDesde } from "@/lib/formato";
import { Cartao, Titulo } from "@/components/ui";
import AtualizarAoVivo from "@/components/AtualizarAoVivo";

export const dynamic = "force-dynamic";

export default async function Painel() {
  const { supabase, empresa } = await exigirTela([]);
  const { inicio, fim } = diaSP();
  const [rel, abertas, { data: cozinha }, { count: chamados }, { data: caixa }] = await Promise.all([
    relatorio(supabase, inicio, fim),
    contasAbertas(supabase),
    supabase.from("pedidos").select("id, setor, status, criado_em, mesa_numero, comanda_numero").in("status", ["novo", "preparando", "pronto"]).order("criado_em"),
    supabase.from("chamados").select("id", { count: "exact", head: true }).is("atendido_em", null),
    supabase.rpc("caixa_atual"),
  ]);
  const cx = caixa as { aberto_em: string; esperado_dinheiro: number } | null;

  const agora = Date.now();
  const naFila = (cozinha ?? []).filter((p) => p.status !== "pronto");
  const atrasados = naFila.filter((p) => minutosDesde(p.criado_em, agora) >= 20);
  const prontos = (cozinha ?? []).filter((p) => p.status === "pronto");
  const emAberto = abertas.reduce((s, c) => s + c.total, 0);
  const ticket = rel.pagamentos ? rel.total / rel.pagamentos : 0;

  return (
    <div className="space-y-6">
      <AtualizarAoVivo empresaId={empresa.id} tabelas={["contas", "pedidos", "itens", "chamados"]} />
      <Titulo sub="Hoje, atualiza sozinho">Painel</Titulo>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao titulo="Vendido hoje" valor={dinheiro(rel.total)} detalhe={`${rel.contas} comanda(s) paga(s)`} destaque />
        <Cartao titulo="Ticket médio" valor={dinheiro(ticket)} detalhe="por pagamento" />
        <Cartao titulo="Pessoas dentro agora" valor={abertas.length} detalhe={`${dinheiro(emAberto)} em aberto`} />
        <Cartao
          titulo="Cozinha"
          valor={naFila.length}
          detalhe={
            atrasados.length ? <span className="text-rose-300">{atrasados.length} esperando há +20 min</span> : `${prontos.length} pronto(s) esperando garçom`
          }
        />
      </div>

      <p className={`rounded-xl px-4 py-2.5 text-sm ${cx ? "bg-emerald-500/10 text-emerald-200" : "bg-white/[0.04] text-zinc-400"}`}>
        {cx
          ? `Caixa aberto desde ${hora(cx.aberto_em)} · deveria ter ${dinheiro(cx.esperado_dinheiro)} em dinheiro na gaveta`
          : "Caixa fechado. Quem estiver no caixa abre com o troco inicial antes de receber."}
      </p>

      {!!chamados && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {chamados} mesa(s) chamando o garçom agora.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 font-semibold">Recebido por forma</h2>
          {Object.keys(FORMAS).map((f) => (
            <div key={f} className="flex justify-between border-b border-white/5 py-1.5 text-sm last:border-0">
              <span className="text-zinc-300">{FORMAS[f]}</span>
              <span className="tabular-nums">{dinheiro(rel.por_forma[f] ?? 0)}</span>
            </div>
          ))}
          {rel.desconto > 0 && <p className="mt-2 text-xs text-zinc-400">Descontos dados: {dinheiro(rel.desconto)}</p>}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 font-semibold">Mais vendidos hoje</h2>
          {rel.top.length === 0 && <p className="text-sm text-zinc-500">Nada vendido ainda.</p>}
          {rel.top.slice(0, 8).map((t) => (
            <div key={t.descricao + t.tipo} className="flex justify-between gap-2 border-b border-white/5 py-1.5 text-sm last:border-0">
              <span className="truncate text-zinc-300">
                {t.tipo === "quilo" ? `${Number(t.quantidade).toFixed(3).replace(".", ",")} kg` : `${Number(t.quantidade)}×`} {t.descricao}
              </span>
              <span className="shrink-0 tabular-nums">{dinheiro(t.valor)}</span>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 font-semibold">Comandas abertas ({abertas.length})</h2>
          {abertas.length === 0 && <p className="text-sm text-zinc-500">Ninguém dentro agora.</p>}
          <div className="max-h-80 overflow-y-auto">
            {abertas.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 border-b border-white/5 py-1.5 text-sm last:border-0">
                <span>
                  <b>#{c.comanda_numero}</b>
                  <span className="text-zinc-400">
                    {c.mesa_numero ? ` · mesa ${c.mesa_numero}` : ""} · desde {hora(c.aberta_em)}
                  </span>
                </span>
                <span className="tabular-nums">{dinheiro(c.total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      {rel.tempo_medio_cozinha_min != null && (
        <p className="text-xs text-zinc-500">Tempo médio da cozinha hoje: {String(rel.tempo_medio_cozinha_min).replace(".", ",")} min do pedido até ficar pronto.</p>
      )}
    </div>
  );
}
