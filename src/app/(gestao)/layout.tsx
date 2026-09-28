import { exigirTela } from "@/lib/contexto";
import BotaoSair from "@/components/BotaoSair";
import LinkSenha from "@/components/LinkSenha";
import Menu from "@/components/Menu";

export default async function LayoutGestao({ children }: { children: React.ReactNode }) {
  // Só dono e gerente (os outros logins vão para a tela deles)
  const { empresa, papel } = await exigirTela([]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="border-b border-white/10 bg-black/30 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center justify-between gap-3 sm:contents">
            <div className="min-w-0">
              <p className="text-xs text-orange-400">Comanda FH</p>
              <p className="truncate font-semibold leading-tight">{empresa.nome}</p>
            </div>
            <div className="flex items-center gap-2 sm:order-last sm:ml-auto">
              <LinkSenha />
              <BotaoSair />
            </div>
          </div>
          <Menu dono={papel === "dono"} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
