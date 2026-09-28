"use client";

import { useState, useTransition } from "react";
import { PAPEIS, type Papel } from "@/lib/papeis";
import { Aviso, botao, botaoSec, campo } from "@/components/ui";
import { criarAcesso, removerAcesso, trocarSenhaAcesso } from "./acoes";

export type Acesso = { user_id: string; papel: string; nome: string; usuario: string; eu: boolean };

const SUGESTAO: Partial<Record<Papel, string>> = { entrada: "entrada", mesa: "mesas", cozinha: "cozinha", garcom: "garcom", caixa: "caixa", balanca: "balanca" };

export default function GerenciarEquipe({ acessos }: { acessos: Acesso[] }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>({});
  const [form, setForm] = useState({ papel: "caixa" as Papel, nome: "", usuario: "", senha: "" });

  function criar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      const r = await criarAcesso(form);
      setMsg(r);
      if (r.ok) setForm({ ...form, nome: "", usuario: "", senha: "" });
    });
  }

  function trocar(a: Acesso) {
    const senha = window.prompt(`Nova senha para “${a.usuario}”:`);
    if (!senha) return;
    iniciar(async () => setMsg(await trocarSenhaAcesso(a.user_id, senha)));
  }

  function remover(a: Acesso) {
    if (!window.confirm(`Remover o login “${a.usuario}”? O aparelho que usa ele sai na hora.`)) return;
    iniciar(async () => setMsg(await removerAcesso(a.user_id)));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-2">
        {acessos.map((a) => (
          <div key={a.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {PAPEIS.find((p) => p.papel === a.papel)?.nome ?? a.papel}
                {a.nome && <span className="text-zinc-400"> · {a.nome}</span>}
              </p>
              <p className="truncate text-sm text-zinc-400">
                Usuário: <span className="font-mono text-zinc-200">{a.usuario || "—"}</span>
              </p>
            </div>
            {a.eu ? (
              <span className="text-xs text-zinc-500">você (troque a senha no ícone da chave)</span>
            ) : (
              <div className="flex gap-1">
                <button disabled={pendente} onClick={() => trocar(a)} className={botaoSec}>
                  Trocar senha
                </button>
                <button disabled={pendente} onClick={() => remover(a)} className="rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
                  Remover
                </button>
              </div>
            )}
          </div>
        ))}
        {msg.erro && <Aviso>{msg.erro}</Aviso>}
        {msg.ok && <Aviso tipo="ok">{msg.ok}</Aviso>}
      </div>

      <form onSubmit={criar} className="h-fit space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">Novo login</h2>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Função</span>
          <select
            value={form.papel}
            onChange={(e) => {
              const papel = e.target.value as Papel;
              setForm({ ...form, papel, usuario: form.usuario || "" });
            }}
            className={campo}
          >
            {PAPEIS.filter((p) => p.papel !== "dono").map((p) => (
              <option key={p.papel} value={p.papel}>
                {p.nome} · {p.explica}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Nome (opcional, ex.: Deise, Tablet balcão)</span>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} maxLength={40} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Usuário para entrar</span>
          <input
            value={form.usuario}
            onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase().replace(/\s/g, "") })}
            placeholder={`ex.: padaria-${SUGESTAO[form.papel] ?? "gerente"}`}
            className={`${campo} font-mono`}
            autoCapitalize="none"
          />
          <span className="block text-xs text-zinc-500">Precisa ser único. Dica: nome do lugar + função.</span>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Senha</span>
          <input value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className={campo} />
        </label>
        <button disabled={pendente} className={`${botao} w-full`}>
          {pendente ? "Salvando..." : "Criar login"}
        </button>
      </form>
    </div>
  );
}
