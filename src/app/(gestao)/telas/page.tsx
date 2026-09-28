import Link from "next/link";
import { exigirTela } from "@/lib/contexto";
import { PAPEIS } from "@/lib/papeis";
import { Titulo } from "@/components/ui";

export const dynamic = "force-dynamic";

// Atalhos para abrir cada tela (o dono consegue testar tudo com o próprio login)
export default async function Telas() {
  const { empresa } = await exigirTela([]);
  const telas = PAPEIS.filter((p) => !["dono", "gerente"].includes(p.papel) && (p.papel !== "balanca" || empresa.usa_quilo));

  return (
    <>
      <Titulo sub="Cada aparelho entra com o login da função e já cai na tela certa. Daqui você abre qualquer uma para testar.">Telas da operação</Titulo>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {telas.map((t) => (
          <Link key={t.papel} href={t.tela} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-orange-500/50">
            <p className="font-semibold">{t.nome}</p>
            <p className="text-sm text-zinc-400">{t.explica}</p>
            <p className="mt-2 text-xs text-orange-300">Abrir {t.tela} →</p>
          </Link>
        ))}
      </div>
    </>
  );
}
