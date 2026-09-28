import BotaoSair from "@/components/BotaoSair";
import { contexto } from "@/lib/contexto";

export const dynamic = "force-dynamic";

export default async function SemEmpresa() {
  const { user } = await contexto();
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Login sem estabelecimento</h1>
      <p className="mt-2 text-sm text-zinc-400">
        O login {user.email} ainda não está ligado a nenhum estabelecimento (ou ele foi desativado). Fale com a FH Digital.
      </p>
      <div className="mt-6 flex justify-center">
        <BotaoSair />
      </div>
    </main>
  );
}
