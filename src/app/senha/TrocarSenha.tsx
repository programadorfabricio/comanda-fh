"use client";

import { useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase/client";

const campo = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-orange-500/60";

export default function TrocarSenha({ email, voltar }: { email: string; voltar: string }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nova.length < 8) return setErro("A senha nova precisa ter pelo menos 8 caracteres.");
    if (nova !== repetir) return setErro("As duas senhas novas não são iguais.");
    if (nova === atual) return setErro("A senha nova precisa ser diferente da atual.");

    setSalvando(true);
    const supabase = criarClienteNavegador();
    // Confere a senha atual antes de trocar (se alguém pegar o celular logado, não troca a senha)
    const { error: errAtual } = await supabase.auth.signInWithPassword({ email, password: atual });
    if (errAtual) {
      setSalvando(false);
      return setErro("A senha atual está errada.");
    }
    const { error } = await supabase.auth.updateUser({ password: nova });
    setSalvando(false);
    if (error) {
      return setErro(
        error.message.toLowerCase().includes("different")
          ? "A senha nova precisa ser diferente da atual."
          : "Não foi possível trocar a senha. Tente de novo."
      );
    }
    setOk(true);
    setAtual("");
    setNova("");
    setRepetir("");
  }

  if (ok) {
    return (
      <div className="space-y-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-6 text-center">
        <p className="text-lg font-semibold text-orange-200">Senha trocada!</p>
        <p className="text-sm text-zinc-300">Na próxima vez que entrar, use a senha nova.</p>
        <Link href={voltar} className="inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-black">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div>
        <h1 className="text-xl font-semibold">Trocar senha</h1>
        <p className="text-sm text-zinc-400">Use pelo menos 8 caracteres, misturando letras e números.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-400">Senha atual</span>
        <input type={ver ? "text" : "password"} value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" required className={campo} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-400">Senha nova</span>
        <input type={ver ? "text" : "password"} value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" required className={campo} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-400">Repita a senha nova</span>
        <input type={ver ? "text" : "password"} value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required className={campo} />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="h-4 w-4 accent-orange-500" />
        Mostrar senhas
      </label>
      {erro && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{erro}</p>}
      <button disabled={salvando} className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-black disabled:opacity-60">
        {salvando ? "Salvando..." : "Trocar senha"}
      </button>
    </form>
  );
}
