import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { telaDoPapel } from "@/lib/papeis";
import TrocarSenha from "./TrocarSenha";

export const dynamic = "force-dynamic";

// Troca de senha do próprio login
export default async function PaginaSenha() {
  const { user, papel } = await contexto();
  const voltar = telaDoPapel(papel);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 py-10">
      <Link href={voltar} className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Voltar
      </Link>
      <TrocarSenha email={user.email ?? ""} voltar={voltar} />
    </main>
  );
}
