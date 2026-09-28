"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { emailDoUsuario } from "@/lib/papeis";

export default function Login() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await criarClienteNavegador().auth.signInWithPassword({ email: emailDoUsuario(login), password: senha });
    setCarregando(false);
    if (error) {
      setErro(/fetch/i.test(error.message) ? "Sem internet. Confira a conexão." : "Usuário ou senha incorretos.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Comanda FH</p>
          <h1 className="mt-1 text-xl font-semibold">Entrar</h1>
          <p className="text-sm text-zinc-400">Dono: e-mail. Equipe e tablets: o usuário que o dono criou.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-zinc-300">Usuário ou e-mail</span>
          <input
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-orange-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-zinc-300">Senha</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-orange-500"
          />
        </label>

        {erro && <p className="text-sm text-rose-400">{erro}</p>}

        <button disabled={carregando} className="w-full rounded-lg bg-orange-500 py-2.5 font-semibold text-black hover:bg-orange-400 disabled:opacity-50">
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
