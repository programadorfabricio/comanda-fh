"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { apagarFoto, enviarFoto, urlFoto } from "@/lib/fotos";
import { dinheiro, lerNumero, mensagemErro } from "@/lib/formato";
import type { Categoria, Produto } from "@/lib/tipos";
import { Aviso, botao, botaoSec, campo } from "@/components/ui";

type Form = {
  id?: string;
  nome: string;
  descricao: string;
  preco: string;
  categoria_id: string;
  setor: "cozinha" | "balcao";
  foto: string | null;
  arquivo: File | null;
};

const vazio = (categoria_id = ""): Form => ({ nome: "", descricao: "", preco: "", categoria_id, setor: "cozinha", foto: null, arquivo: null });

export default function GerenciarCardapio({
  empresaId,
  categorias,
  produtos,
}: {
  empresaId: string;
  categorias: Categoria[];
  produtos: Produto[];
}) {
  const router = useRouter();
  const supabase = criarClienteNavegador();
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [novaCat, setNovaCat] = useState("");

  async function executar(acao: () => PromiseLike<{ error: { message: string } | null }>) {
    setErro(null);
    const { error } = await acao();
    if (error) setErro(mensagemErro(error));
    router.refresh();
  }

  // ---------- categorias ----------
  async function criarCategoria(e: React.FormEvent) {
    e.preventDefault();
    const nome = novaCat.trim();
    if (!nome) return;
    const ordem = Math.max(0, ...categorias.map((c) => c.ordem)) + 1;
    await executar(() => supabase.from("categorias").insert({ empresa_id: empresaId, nome, ordem }));
    setNovaCat("");
  }

  async function mover(c: Categoria, direcao: -1 | 1) {
    const lista = [...categorias];
    const i = lista.findIndex((x) => x.id === c.id);
    const j = i + direcao;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    setErro(null);
    await Promise.all(lista.map((x, k) => supabase.from("categorias").update({ ordem: k + 1 }).eq("id", x.id)));
    router.refresh();
  }

  async function renomear(c: Categoria) {
    const nome = window.prompt("Novo nome da categoria:", c.nome)?.trim();
    if (nome && nome !== c.nome) await executar(() => supabase.from("categorias").update({ nome }).eq("id", c.id));
  }

  async function excluirCategoria(c: Categoria) {
    const qtd = produtos.filter((p) => p.categoria_id === c.id).length;
    if (!window.confirm(qtd ? `Excluir “${c.nome}”? Os ${qtd} produto(s) dela ficam em “Sem categoria”.` : `Excluir “${c.nome}”?`)) return;
    await executar(() => supabase.from("categorias").delete().eq("id", c.id));
  }

  // ---------- produtos ----------
  function editar(p: Produto) {
    setErro(null);
    setForm({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      preco: String(p.preco).replace(".", ","),
      categoria_id: p.categoria_id ?? "",
      setor: p.setor,
      foto: p.foto,
      arquivo: null,
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro(null);
    const preco = lerNumero(form.preco);
    if (!form.nome.trim()) return setErro("Informe o nome.");
    if (preco == null || preco < 0 || preco > 100000) return setErro("Preço inválido. Ex.: 12,50");

    setSalvando(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        preco: Math.round(preco * 100) / 100,
        categoria_id: form.categoria_id || null,
        setor: form.setor,
      };
      let id = form.id;
      if (id) {
        const { error } = await supabase.from("produtos").update(dados).eq("id", id);
        if (error) throw error;
      } else {
        const ordem = Math.max(0, ...produtos.filter((p) => p.categoria_id === dados.categoria_id).map((p) => p.ordem)) + 1;
        const { data, error } = await supabase.from("produtos").insert({ ...dados, empresa_id: empresaId, ordem }).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (form.arquivo && id) {
        const caminho = await enviarFoto(supabase, empresaId, id, form.arquivo);
        const { error } = await supabase.from("produtos").update({ foto: caminho }).eq("id", id);
        if (error) throw error;
        await apagarFoto(supabase, form.foto);
      }
      setForm(null);
      router.refresh();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function tirarFoto() {
    if (!form?.id || !form.foto) return;
    await apagarFoto(supabase, form.foto);
    await supabase.from("produtos").update({ foto: null }).eq("id", form.id);
    setForm({ ...form, foto: null });
    router.refresh();
  }

  async function excluir(p: Produto) {
    if (!window.confirm(`Tirar “${p.nome}” do cardápio?`)) return;
    // não apaga de verdade: as vendas antigas continuam no relatório
    await executar(() => supabase.from("produtos").update({ ativo: false }).eq("id", p.id));
  }

  const grupos = [
    ...categorias.map((c) => ({ categoria: c as Categoria | null, itens: produtos.filter((p) => p.categoria_id === c.id) })),
    { categoria: null, itens: produtos.filter((p) => !p.categoria_id || !categorias.some((c) => c.id === p.categoria_id)) },
  ].filter((g) => g.categoria || g.itens.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={criarCategoria} className="flex flex-1 gap-2">
          <input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Nova categoria (ex.: Lanches)" className={campo} />
          <button className={botaoSec}>Adicionar</button>
        </form>
        <button onClick={() => setForm(vazio(categorias[0]?.id ?? ""))} className={botao}>
          + Novo produto
        </button>
      </div>

      {erro && !form && <Aviso>{erro}</Aviso>}

      {grupos.length === 0 && <p className="text-sm text-zinc-400">Comece criando as categorias (Lanches, Bebidas...) e depois os produtos.</p>}

      {grupos.map(({ categoria: c, itens }, gi) => (
        <section key={c?.id ?? "sem"} className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
            <h2 className={`font-semibold ${c && !c.ativa ? "text-zinc-500 line-through" : ""}`}>{c?.nome ?? "Sem categoria"}</h2>
            <span className="text-xs text-zinc-500">{itens.length} item(ns)</span>
            {c && !c.ativa && <span className="rounded bg-zinc-700 px-1.5 text-xs">oculta no tablet</span>}
            {c && (
              <div className="ml-auto flex flex-wrap gap-1 text-xs">
                <button onClick={() => mover(c, -1)} disabled={gi === 0} className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30" aria-label="Subir">
                  ↑
                </button>
                <button
                  onClick={() => mover(c, 1)}
                  disabled={gi === categorias.length - 1}
                  className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30"
                  aria-label="Descer"
                >
                  ↓
                </button>
                <button onClick={() => renomear(c)} className="rounded px-2 py-1 text-zinc-300 hover:bg-white/10">
                  Renomear
                </button>
                <button
                  onClick={() => executar(() => supabase.from("categorias").update({ ativa: !c.ativa }).eq("id", c.id))}
                  className="rounded px-2 py-1 text-zinc-300 hover:bg-white/10"
                >
                  {c.ativa ? "Ocultar" : "Mostrar"}
                </button>
                <button onClick={() => excluirCategoria(c)} className="rounded px-2 py-1 text-rose-300 hover:bg-rose-500/10">
                  Excluir
                </button>
              </div>
            )}
          </div>

          {itens.length === 0 && <p className="px-4 py-3 text-sm text-zinc-500">Nenhum produto aqui ainda.</p>}
          <ul>
            {itens.map((p) => {
              const foto = urlFoto(p.foto);
              return (
                <li key={p.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-600">{p.nome[0]}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${!p.disponivel ? "text-zinc-500" : ""}`}>{p.nome}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {p.setor === "cozinha" ? "Cozinha" : "Balcão"}
                      {p.descricao ? ` · ${p.descricao}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums">{dinheiro(p.preco)}</span>
                  <button
                    onClick={() => executar(() => supabase.from("produtos").update({ disponivel: !p.disponivel }).eq("id", p.id))}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      p.disponivel ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    }`}
                    title="Tocar para mudar"
                  >
                    {p.disponivel ? "Tem" : "Acabou"}
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => editar(p)} className="rounded px-2 py-1 text-xs text-zinc-300 hover:bg-white/10">
                      Editar
                    </button>
                    <button onClick={() => excluir(p)} className="hidden rounded px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 sm:block">
                      Excluir
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => !salvando && setForm(null)}>
          <form
            onSubmit={salvar}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-900 p-5 sm:rounded-2xl"
          >
            <h2 className="text-lg font-semibold">{form.id ? "Editar produto" : "Novo produto"}</h2>
            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">Nome</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} autoFocus maxLength={60} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">Descrição (aparece no tablet)</span>
              <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={campo} maxLength={120} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Preço (R$)</span>
                <input value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} inputMode="decimal" placeholder="0,00" className={campo} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Categoria</span>
                <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} className={campo}>
                  <option value="">Sem categoria</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="space-y-1">
              <span className="text-xs text-zinc-400">Quem prepara?</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["cozinha", "Cozinha", "Lanches, pratos, porções"],
                    ["balcao", "Balcão", "Bebidas, cafés, itens prontos"],
                  ] as const
                ).map(([valor, nome, dica]) => (
                  <button
                    type="button"
                    key={valor}
                    onClick={() => setForm({ ...form, setor: valor })}
                    className={`rounded-lg border p-2 text-left ${form.setor === valor ? "border-orange-500 bg-orange-500/10" : "border-white/10"}`}
                  >
                    <span className="block text-sm font-medium">{nome}</span>
                    <span className="block text-xs text-zinc-400">{dica}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Foto</span>
              <div className="flex items-center gap-3">
                {(form.arquivo || form.foto) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.arquivo ? URL.createObjectURL(form.arquivo) : urlFoto(form.foto)!}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )}
                <label className={`${botaoSec} cursor-pointer`}>
                  {form.foto || form.arquivo ? "Trocar foto" : "Escolher foto"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setForm({ ...form, arquivo: e.target.files?.[0] ?? null })} />
                </label>
                {form.foto && !form.arquivo && (
                  <button type="button" onClick={tirarFoto} className="text-xs text-rose-300">
                    Tirar foto
                  </button>
                )}
              </div>
            </div>
            {erro && <Aviso>{erro}</Aviso>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} className={`${botaoSec} flex-1`} disabled={salvando}>
                Cancelar
              </button>
              <button className={`${botao} flex-1`} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
