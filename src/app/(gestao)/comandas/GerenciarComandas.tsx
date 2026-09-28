"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { dinheiro, hora, mensagemErro } from "@/lib/formato";
import { Aviso, botao, botaoSec, campo } from "@/components/ui";

export type ComandaLinha = {
  id: string;
  numero: number;
  status: "livre" | "aberta" | "bloqueada";
  perdida: boolean;
  conta: { aberta_em: string; mesa_numero: number | null } | null;
};

const COR = {
  livre: "border-white/10 bg-white/[0.03] text-zinc-300",
  aberta: "border-orange-500/50 bg-orange-500/15 text-orange-200",
  bloqueada: "border-rose-500/40 bg-rose-500/10 text-rose-300 line-through",
};

export default function GerenciarComandas({ comandas, multa }: { comandas: ComandaLinha[]; multa: number }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"todas" | "livre" | "aberta" | "bloqueada">("todas");
  const [qtd, setQtd] = useState("20");
  const [de, setDe] = useState("1");
  const [ate, setAte] = useState(String(comandas.at(-1)?.numero ?? 1));
  const [sel, setSel] = useState<ComandaLinha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cont = useMemo(
    () => ({
      livre: comandas.filter((c) => c.status === "livre").length,
      aberta: comandas.filter((c) => c.status === "aberta").length,
      bloqueada: comandas.filter((c) => c.status === "bloqueada").length,
    }),
    [comandas]
  );
  const lista = filtro === "todas" ? comandas : comandas.filter((c) => c.status === filtro);

  async function rpc(nome: string, args: Record<string, unknown>, msg: string) {
    setErro(null);
    setOk(null);
    setOcupado(true);
    const { data, error } = await criarClienteNavegador().rpc(nome, args);
    setOcupado(false);
    if (error) return setErro(mensagemErro(error));
    setOk(typeof data === "number" ? msg.replace("{n}", String(data)) : msg);
    setSel(null);
    router.refresh();
  }

  function gerar(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(qtd);
    if (!Number.isInteger(n) || n < 1 || n > 500) return setErro("Escolha entre 1 e 500.");
    rpc("gerar_comandas", { p_quantidade: n }, `${n} comanda(s) criada(s), começando no nº {n}. Agora é só imprimir.`);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <form onSubmit={gerar} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-semibold">Criar mais comandas</h2>
          <p className="mb-3 text-xs text-zinc-400">Os números continuam de onde parou.</p>
          <div className="flex gap-2">
            <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="numeric" className={`${campo} w-24`} />
            <button disabled={ocupado} className={botao}>
              Criar
            </button>
          </div>
        </form>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-semibold">Imprimir</h2>
          <p className="mb-3 text-xs text-zinc-400">Tamanho de cartão de crédito, 10 por folha A4.</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            do nº <input value={de} onChange={(e) => setDe(e.target.value)} inputMode="numeric" className={`${campo} w-20`} />
            ao nº <input value={ate} onChange={(e) => setAte(e.target.value)} inputMode="numeric" className={`${campo} w-20`} />
            <Link href={`/comandas/imprimir?de=${Number(de) || 1}&ate=${Number(ate) || 1}`} className={botao} target="_blank">
              Abrir para imprimir
            </Link>
          </div>
        </div>
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      <div className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["todas", `Todas (${comandas.length})`],
            ["aberta", `Em uso (${cont.aberta})`],
            ["livre", `Livres (${cont.livre})`],
            ["bloqueada", `Bloqueadas (${cont.bloqueada})`],
          ] as const
        ).map(([v, nome]) => (
          <button
            key={v}
            onClick={() => setFiltro(v)}
            className={`rounded-full px-3 py-1 ${filtro === v ? "bg-white/15 text-white" : "text-zinc-400 hover:bg-white/5"}`}
          >
            {nome}
          </button>
        ))}
      </div>

      {comandas.length === 0 && <p className="text-sm text-zinc-400">Nenhuma comanda ainda. Crie acima.</p>}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-12">
        {lista.map((c) => (
          <button
            key={c.id}
            onClick={() => setSel(c)}
            className={`rounded-lg border px-1 py-2 text-center text-sm font-semibold tabular-nums ${COR[c.status]}`}
            title={c.status}
          >
            {c.numero}
            {c.status === "aberta" && c.conta?.mesa_numero && <span className="block text-[10px] font-normal">mesa {c.conta.mesa_numero}</span>}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500">Laranja = em uso agora · riscada = bloqueada (perdida ou estragada). Toque numa comanda para ver as opções.</p>

      {sel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={() => setSel(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-3 rounded-t-2xl border border-white/10 bg-zinc-900 p-5 sm:rounded-2xl">
            <h2 className="text-lg font-semibold">Comanda {sel.numero}</h2>
            {sel.status === "livre" && <p className="text-sm text-zinc-400">Livre, pronta para usar.</p>}
            {sel.status === "aberta" && (
              <p className="text-sm text-zinc-300">
                Em uso desde {sel.conta ? hora(sel.conta.aberta_em) : "—"}
                {sel.conta?.mesa_numero ? `, última mesa ${sel.conta.mesa_numero}` : ""}. Para fechar, use a tela do Caixa.
                {sel.perdida && " Marcada como perdida: será bloqueada quando pagar."}
              </p>
            )}
            {sel.status === "bloqueada" && (
              <p className="text-sm text-zinc-300">
                Bloqueada{sel.perdida ? " (perdida)" : ""}. Ninguém consegue usar. Se ela apareceu de novo, libere.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {sel.status === "livre" && (
                <button
                  disabled={ocupado}
                  onClick={() => rpc("bloquear_comanda", { p_numero: sel.numero, p_bloquear: true }, `Comanda ${sel.numero} bloqueada.`)}
                  className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200"
                >
                  Bloquear (perdida/estragada)
                </button>
              )}
              {sel.status === "bloqueada" && (
                <button
                  disabled={ocupado}
                  onClick={() => rpc("bloquear_comanda", { p_numero: sel.numero, p_bloquear: false }, `Comanda ${sel.numero} liberada.`)}
                  className={botao}
                >
                  Liberar de novo
                </button>
              )}
              <Link href={`/comandas/imprimir?de=${sel.numero}&ate=${sel.numero}`} target="_blank" className={`${botaoSec} text-center`}>
                Reimprimir esta
              </Link>
              <button onClick={() => setSel(null)} className="py-1 text-sm text-zinc-400">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {multa > 0 && <p className="text-xs text-zinc-500">Multa por comanda perdida: {dinheiro(multa)} (mude em Configurações).</p>}
    </div>
  );
}
