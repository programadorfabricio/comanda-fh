"use client";

import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { dataHora, dinheiro, FORMAS, lerNumero, mensagemErro } from "@/lib/formato";

// Turno do caixa: abrir com troco, sangria/reforço e fechar contando a gaveta
export type ResumoCaixa = {
  id: string;
  aberto_em: string;
  fechado_em: string | null;
  troco_inicial: number;
  pagamentos: number;
  total: number;
  servico: number;
  desconto: number;
  por_forma: Record<string, number>;
  sangrias: number;
  reforcos: number;
  movimentos: { tipo: "sangria" | "reforco"; valor: number; motivo: string; em: string }[];
  esperado_dinheiro: number;
  contado_dinheiro: number | null;
  diferenca: number | null;
  observacao: string;
  aberto_por: string | null;
  fechado_por: string | null;
};

const entrada = "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-2xl tabular-nums outline-none focus:border-orange-500";

export function AbrirCaixa({ onAberto }: { onAberto: (c: ResumoCaixa) => void }) {
  const [troco, setTroco] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    const v = troco.trim() ? lerNumero(troco) : 0;
    if (v == null || v < 0) return setErro("Valor inválido.");
    setOcupado(true);
    const { data, error } = await criarClienteNavegador().rpc("abrir_caixa", { p_troco: v });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    onAberto(data as ResumoCaixa);
  }

  return (
    <form onSubmit={abrir} className="mx-auto mt-10 max-w-sm space-y-4 rounded-2xl border border-orange-500/40 bg-orange-500/[0.07] p-6">
      <div>
        <h2 className="text-xl font-bold">Abrir o caixa</h2>
        <p className="text-sm text-zinc-400">Quanto tem de troco na gaveta agora? No fim do turno o sistema confere se bateu.</p>
      </div>
      <input value={troco} onChange={(e) => setTroco(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus className={entrada} />
      {erro && <p className="text-sm text-rose-300">{erro}</p>}
      <button disabled={ocupado} className="w-full rounded-xl bg-orange-500 py-3 text-lg font-bold text-black disabled:opacity-50">
        {ocupado ? "Abrindo..." : "Abrir caixa"}
      </button>
    </form>
  );
}

function Janela({ children, onFechar }: { children: React.ReactNode; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4 print:static print:bg-white" onClick={onFechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-900 p-5 sm:rounded-2xl print:max-h-none print:border-0 print:bg-white print:text-black"
      >
        {children}
      </div>
    </div>
  );
}

export function MovimentoCaixa({ onFeito, onFechar }: { onFeito: (c: ResumoCaixa) => void; onFechar: () => void }) {
  const [tipo, setTipo] = useState<"sangria" | "reforco">("sangria");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerNumero(valor);
    if (v == null || v <= 0) return setErro("Valor inválido.");
    setOcupado(true);
    const { data, error } = await criarClienteNavegador().rpc("movimento_caixa", { p_tipo: tipo, p_valor: v, p_motivo: motivo });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    onFeito(data as ResumoCaixa);
  }

  return (
    <Janela onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <h2 className="text-lg font-semibold">Movimento de dinheiro</h2>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["sangria", "Sangria", "Tirei da gaveta"],
              ["reforco", "Reforço", "Coloquei na gaveta"],
            ] as const
          ).map(([v, nome, dica]) => (
            <button
              type="button"
              key={v}
              onClick={() => setTipo(v)}
              className={`rounded-lg border p-2 text-left ${tipo === v ? "border-orange-500 bg-orange-500/10" : "border-white/10"}`}
            >
              <span className="block font-medium">{nome}</span>
              <span className="block text-xs text-zinc-400">{dica}</span>
            </button>
          ))}
        </div>
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus className={entrada} />
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={140}
          placeholder={tipo === "sangria" ? "Motivo (ex.: depósito, pagou fornecedor)" : "Motivo (ex.: mais moedas)"}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-orange-500"
        />
        {erro && <p className="text-sm text-rose-300">{erro}</p>}
        <button disabled={ocupado} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-black disabled:opacity-50">
          Registrar
        </button>
        <button type="button" onClick={onFechar} className="w-full py-1 text-sm text-zinc-400">
          Cancelar
        </button>
      </form>
    </Janela>
  );
}

// Resumo do turno (usado no fechamento e no relatório do dono)
export function ResumoTurno({ c }: { c: ResumoCaixa }) {
  const linha = "flex justify-between border-b border-white/5 py-1.5 text-sm print:border-black/10";
  return (
    <div>
      <p className="text-xs text-zinc-400 print:text-zinc-600">
        Aberto {dataHora(c.aberto_em)}
        {c.aberto_por ? ` por ${c.aberto_por}` : ""}
        {c.fechado_em ? ` · fechado ${dataHora(c.fechado_em)}${c.fechado_por ? ` por ${c.fechado_por}` : ""}` : ""}
      </p>
      <div className="mt-2">
        <div className={linha}>
          <span>Total recebido ({c.pagamentos} pagamento{c.pagamentos === 1 ? "" : "s"})</span>
          <b className="tabular-nums">{dinheiro(c.total)}</b>
        </div>
        {Object.keys(FORMAS).map((f) => (
          <div key={f} className={`${linha} pl-3 text-zinc-300 print:text-black`}>
            <span>{FORMAS[f]}</span>
            <span className="tabular-nums">{dinheiro(c.por_forma[f] ?? 0)}</span>
          </div>
        ))}
        {Number(c.servico) > 0 && (
          <div className={linha}>
            <span>Taxa de serviço (já no total)</span>
            <span className="tabular-nums">{dinheiro(c.servico)}</span>
          </div>
        )}
        {Number(c.desconto) > 0 && (
          <div className={linha}>
            <span>Descontos dados</span>
            <span className="tabular-nums">{dinheiro(c.desconto)}</span>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Gaveta (dinheiro)</p>
      <div className={linha}>
        <span>Troco inicial</span>
        <span className="tabular-nums">{dinheiro(c.troco_inicial)}</span>
      </div>
      <div className={linha}>
        <span>+ Vendas em dinheiro</span>
        <span className="tabular-nums">{dinheiro(c.por_forma.dinheiro ?? 0)}</span>
      </div>
      {Number(c.reforcos) > 0 && (
        <div className={linha}>
          <span>+ Reforços</span>
          <span className="tabular-nums">{dinheiro(c.reforcos)}</span>
        </div>
      )}
      {Number(c.sangrias) > 0 && (
        <div className={linha}>
          <span>− Sangrias</span>
          <span className="tabular-nums">{dinheiro(c.sangrias)}</span>
        </div>
      )}
      <div className={`${linha} font-semibold`}>
        <span>Deveria ter na gaveta</span>
        <span className="tabular-nums">{dinheiro(c.esperado_dinheiro)}</span>
      </div>
      {c.contado_dinheiro != null && (
        <>
          <div className={linha}>
            <span>Contado</span>
            <span className="tabular-nums">{dinheiro(c.contado_dinheiro)}</span>
          </div>
          <div
            className={`mt-2 rounded-lg px-3 py-2 text-center font-bold ${
              Number(c.diferenca) === 0 ? "bg-emerald-500/15 text-emerald-300" : Number(c.diferenca) > 0 ? "bg-sky-500/15 text-sky-300" : "bg-rose-500/15 text-rose-300"
            } print:bg-transparent print:text-black`}
          >
            {Number(c.diferenca) === 0 ? "Bateu certinho ✓" : Number(c.diferenca) > 0 ? `Sobrou ${dinheiro(c.diferenca)}` : `Faltou ${dinheiro(Math.abs(Number(c.diferenca)))}`}
          </div>
        </>
      )}
      {c.movimentos.length > 0 && (
        <div className="mt-3 space-y-0.5 text-xs text-zinc-400 print:text-zinc-700">
          {c.movimentos.map((m, i) => (
            <p key={i}>
              {dataHora(m.em)} · {m.tipo === "sangria" ? "Sangria" : "Reforço"} {dinheiro(m.valor)}
              {m.motivo ? ` · ${m.motivo}` : ""}
            </p>
          ))}
        </div>
      )}
      {c.observacao && <p className="mt-2 text-sm text-zinc-300 print:text-black">Obs.: {c.observacao}</p>}
    </div>
  );
}

export function FecharCaixa({ caixa, abertas, onFechado, onFechar }: { caixa: ResumoCaixa; abertas: number; onFechado: () => void; onFechar: () => void }) {
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [final, setFinal] = useState<ResumoCaixa | null>(null);

  async function fechar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerNumero(contado);
    if (v == null || v < 0) return setErro("Conte o dinheiro da gaveta e digite o valor.");
    setOcupado(true);
    const { data, error } = await criarClienteNavegador().rpc("fechar_caixa", { p_contado: v, p_observacao: obs });
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setFinal(data as ResumoCaixa);
  }

  if (final) {
    return (
      <Janela onFechar={onFechado}>
        <h2 className="text-lg font-semibold">Caixa fechado</h2>
        <ResumoTurno c={final} />
        <div className="flex gap-2 pt-2 print:hidden">
          <button onClick={() => window.print()} className="flex-1 rounded-xl border border-white/15 py-3 font-semibold">
            Imprimir
          </button>
          <button onClick={onFechado} className="flex-1 rounded-xl bg-orange-500 py-3 font-bold text-black">
            Concluir
          </button>
        </div>
      </Janela>
    );
  }

  return (
    <Janela onFechar={onFechar}>
      <form onSubmit={fechar} className="space-y-3">
        <h2 className="text-lg font-semibold">Fechar o caixa</h2>
        <ResumoTurno c={caixa} />
        {abertas > 0 && (
          <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
            Ainda tem {abertas} comanda(s) aberta(s). Elas continuam abertas e serão pagas no próximo caixa.
          </p>
        )}
        <label className="block">
          <span className="text-sm text-zinc-300">Quanto tem em dinheiro na gaveta? (conte tudo)</span>
          <input value={contado} onChange={(e) => setContado(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus className={`${entrada} mt-1`} />
        </label>
        <input
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          maxLength={280}
          placeholder="Observação (opcional)"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-orange-500"
        />
        {erro && <p className="text-sm text-rose-300">{erro}</p>}
        <button disabled={ocupado} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-black disabled:opacity-50">
          {ocupado ? "Fechando..." : "Fechar caixa"}
        </button>
        <button type="button" onClick={onFechar} className="w-full py-1 text-sm text-zinc-400">
          Cancelar
        </button>
      </form>
    </Janela>
  );
}
