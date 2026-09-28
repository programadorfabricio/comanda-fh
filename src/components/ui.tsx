// Peças visuais repetidas nas telas de gestão
export const campo =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-orange-500/70";
export const botao = "rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50";
export const botaoSec = "rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50";

export function Titulo({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold">{children}</h1>
      {sub && <p className="mt-0.5 text-sm text-zinc-400">{sub}</p>}
    </div>
  );
}

export function Cartao({ titulo, valor, detalhe, destaque }: { titulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${destaque ? "border-orange-500/40 bg-orange-500/10" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-xs text-zinc-400">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-zinc-400">{detalhe}</p>}
    </div>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "ok" | "info"; children: React.ReactNode }) {
  const cor =
    tipo === "erro" ? "bg-rose-500/10 text-rose-300" : tipo === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-sky-500/10 text-sky-200";
  return <p className={`rounded-lg px-3 py-2 text-sm ${cor}`}>{children}</p>;
}
