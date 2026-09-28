import Link from "next/link";
import BotaoSair from "@/components/BotaoSair";

// Barra fina no topo das telas da operação
export default function BarraOperacao({
  titulo,
  empresa,
  gestao,
  children,
}: {
  titulo: string;
  empresa: string;
  gestao: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-4 py-2">
      {gestao && (
        <Link href="/telas" className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10" aria-label="Voltar">
          ←
        </Link>
      )}
      <div className="min-w-0">
        <p className="text-[11px] leading-tight text-orange-400">{empresa}</p>
        <p className="font-semibold leading-tight">{titulo}</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {children}
        <BotaoSair />
      </div>
    </header>
  );
}
