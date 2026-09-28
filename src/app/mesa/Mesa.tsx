"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { useAoVivo, useTelaAcesa } from "@/lib/aoVivo";
import { dinheiro, mensagemErro } from "@/lib/formato";
import { urlFoto } from "@/lib/fotos";
import { qtdTexto, type Categoria, type Produto, type ResumoConta } from "@/lib/tipos";
import type { Empresa } from "@/lib/contexto";
import LeitorQR from "@/components/LeitorQR";

type Fase = "config" | "inicio" | "identificar" | "cardapio" | "enviado";
type ItemCarrinho = { produto: Produto; quantidade: number; observacao: string };

const OCIOSO_MS = 90_000; // sem tocar na tela: volta para o início
const CHAVE_MESA = "cfh-mesa-numero";

const STATUS: Record<string, [string, string]> = {
  novo: ["Na fila", "bg-stone-200 text-stone-700"],
  preparando: ["Preparando", "bg-sky-100 text-sky-800"],
  pronto: ["Pronto", "bg-emerald-100 text-emerald-800"],
  entregue: ["Entregue", "bg-stone-100 text-stone-500"],
  cancelado: ["Cancelado", "bg-rose-100 text-rose-700"],
};

export default function Mesa({ empresa, gestao, email }: { empresa: Empresa; gestao: boolean; email: string }) {
  const router = useRouter();
  const supabase = useRef(criarClienteNavegador()).current;
  const [fase, setFase] = useState<Fase>("inicio");
  const [mesa, setMesa] = useState<number | null>(null);
  const [mesas, setMesas] = useState<number[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [leitura, setLeitura] = useState<string | null>(null);
  const [conta, setConta] = useState<ResumoConta | null>(null);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [aberto, setAberto] = useState<Produto | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [verConta, setVerConta] = useState(false);
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [digitar, setDigitar] = useState(false);
  const ultimoToque = useRef(Date.now());
  const ocupadoRef = useRef(false);
  useTelaAcesa();

  // ---------- carregar cardápio ----------
  const carregar = useCallback(async () => {
    const [c, p, m] = await Promise.all([
      supabase.from("categorias").select("id, nome, ordem, ativa").eq("ativa", true).order("ordem").order("nome"),
      supabase.from("produtos").select("id, categoria_id, nome, descricao, preco, foto, setor, disponivel, ordem").eq("ativo", true).order("ordem").order("nome"),
      supabase.from("mesas").select("numero").eq("ativa", true).order("numero"),
    ]);
    if (c.data) setCategorias(c.data as Categoria[]);
    if (p.data) setProdutos(p.data as Produto[]);
    if (m.data) setMesas(m.data.map((x) => x.numero));
  }, [supabase]);

  useEffect(() => {
    carregar();
    try {
      const n = Number(localStorage.getItem(CHAVE_MESA));
      if (n > 0) setMesa(n);
      else setFase("config");
    } catch {
      setFase("config");
    }
  }, [carregar]);
  useAoVivo(empresa.id, ["produtos"], carregar, 60_000);

  // ---------- ociosidade ----------
  const voltarInicio = useCallback(() => {
    setFase("inicio");
    setLeitura(null);
    setConta(null);
    setCarrinho([]);
    setAberto(null);
    setVerCarrinho(false);
    setVerConta(false);
    setDigitar(false);
    setErro(null);
  }, []);

  useEffect(() => {
    const tocar = () => (ultimoToque.current = Date.now());
    window.addEventListener("pointerdown", tocar);
    window.addEventListener("keydown", tocar);
    const t = setInterval(() => {
      if ((fase === "cardapio" || fase === "identificar") && Date.now() - ultimoToque.current > OCIOSO_MS) voltarInicio();
    }, 5000);
    return () => {
      window.removeEventListener("pointerdown", tocar);
      window.removeEventListener("keydown", tocar);
      clearInterval(t);
    };
  }, [fase, voltarInicio]);

  useEffect(() => {
    if (fase !== "enviado") return;
    const t = setTimeout(voltarInicio, 12_000);
    return () => clearTimeout(t);
  }, [fase, voltarInicio]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  // ---------- comanda ----------
  const identificar = useCallback(
    async (texto: string) => {
      if (ocupadoRef.current) return;
      ocupadoRef.current = true;
      setOcupado(true);
      setErro(null);
      const { data, error } = await supabase.rpc("ler_comanda", { p_leitura: texto });
      ocupadoRef.current = false;
      setOcupado(false);
      if (error) return setErro(mensagemErro(error));
      if ((data as { erro?: string })?.erro) return setErro((data as { erro: string }).erro);
      setLeitura(texto);
      setConta(data as ResumoConta);
      setCarrinho([]);
      setDigitar(false);
      setCatAtiva(null);
      ultimoToque.current = Date.now();
      setFase("cardapio");
    },
    [supabase]
  );

  async function atualizarConta() {
    if (!leitura) return;
    const { data, error } = await supabase.rpc("ler_comanda", { p_leitura: leitura });
    if (error || (data as { erro?: string })?.erro) {
      setErro(error ? mensagemErro(error) : (data as { erro: string }).erro);
      return;
    }
    setConta(data as ResumoConta);
  }

  async function chamarGarcom() {
    if (!mesa) return;
    const { error } = await supabase.rpc("chamar_garcom", { p_mesa: mesa });
    setAviso(error ? mensagemErro(error) : "Garçom chamado! Ele já vem.");
  }

  // ---------- carrinho ----------
  function adicionar(p: Produto, quantidade: number, observacao: string) {
    setCarrinho((c) => {
      const obs = observacao.trim();
      const i = c.findIndex((x) => x.produto.id === p.id && x.observacao === obs);
      if (i >= 0) return c.map((x, k) => (k === i ? { ...x, quantidade: Math.min(50, x.quantidade + quantidade) } : x));
      return [...c, { produto: p, quantidade, observacao: obs }];
    });
    setAberto(null);
  }

  function mudarQtd(i: number, delta: number) {
    setCarrinho((c) => c.map((x, k) => (k === i ? { ...x, quantidade: x.quantidade + delta } : x)).filter((x) => x.quantidade > 0));
  }

  const totalCarrinho = carrinho.reduce((s, x) => s + x.quantidade * Number(x.produto.preco), 0);
  const qtdCarrinho = carrinho.reduce((s, x) => s + x.quantidade, 0);

  async function enviar() {
    if (!leitura || !carrinho.length || ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    setErro(null);
    const { data, error } = await supabase.rpc("enviar_pedido", {
      p_leitura: leitura,
      p_mesa: mesa,
      p_itens: carrinho.map((x) => ({ produto_id: x.produto.id, quantidade: x.quantidade, observacao: x.observacao })),
    });
    ocupadoRef.current = false;
    setOcupado(false);
    if (error || (data as { erro?: string })?.erro) {
      setErro(error ? mensagemErro(error) : (data as { erro: string }).erro);
      carregar();
      return;
    }
    setConta(data as ResumoConta);
    setCarrinho([]);
    setVerCarrinho(false);
    setFase("enviado");
  }

  // ---------- trocar a mesa do tablet (protegido pela senha do login) ----------
  const toques = useRef<number[]>([]);
  function toqueSecreto() {
    const agora = Date.now();
    toques.current = [...toques.current.filter((t) => agora - t < 3000), agora];
    if (toques.current.length >= 5) {
      toques.current = [];
      setFase("config");
    }
  }

  const grupos = useMemo(() => {
    const ids = new Set(categorias.map((c) => c.id));
    const lista = categorias.map((c) => ({ id: c.id, nome: c.nome, itens: produtos.filter((p) => p.categoria_id === c.id) }));
    const soltos = produtos.filter((p) => !p.categoria_id || !ids.has(p.categoria_id));
    if (soltos.length) lista.push({ id: "outros", nome: "Outros", itens: soltos });
    return lista.filter((g) => g.itens.length);
  }, [categorias, produtos]);

  // ======================================================================
  if (fase === "config") {
    return (
      <ConfigurarMesa
        email={email}
        mesas={mesas}
        atual={mesa}
        precisaSenha={mesa != null && !gestao}
        onPronto={(n) => {
          try {
            localStorage.setItem(CHAVE_MESA, String(n));
          } catch {}
          setMesa(n);
          voltarInicio();
        }}
        onCancelar={mesa ? () => setFase("inicio") : undefined}
        onSair={async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        }}
      />
    );
  }

  return (
    <div className="tema-mesa min-h-[100dvh] select-none">
      {aviso && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full bg-stone-900 px-6 py-3 text-lg font-semibold text-white shadow-xl">{aviso}</div>
      )}

      {/* ---------------- INÍCIO ---------------- */}
      {fase === "inicio" && (
        <div className="flex min-h-[100dvh] flex-col items-center justify-between p-8 text-center">
          <p onClick={toqueSecreto} className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-600">
            {empresa.nome}
          </p>
          <button onClick={() => setFase("identificar")} className="flex flex-col items-center gap-6">
            <span className="text-[7rem] font-black leading-none text-stone-900">{mesa}</span>
            <span className="-mt-4 text-lg font-medium uppercase tracking-widest text-stone-500">Mesa</span>
            <span className="rounded-full bg-orange-500 px-10 py-5 text-2xl font-bold text-white shadow-lg shadow-orange-500/30">Toque para pedir</span>
            <span className="max-w-sm text-stone-500">Tenha sua comanda em mãos. Cada pessoa pede com a própria comanda.</span>
          </button>
          <button onClick={chamarGarcom} className="rounded-full border-2 border-stone-300 px-6 py-3 text-lg font-semibold text-stone-700">
            Chamar garçom
          </button>
        </div>
      )}

      {/* ---------------- IDENTIFICAR ---------------- */}
      {fase === "identificar" && (
        <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <button onClick={voltarInicio} className="rounded-full bg-stone-200 px-5 py-2.5 font-semibold text-stone-700">
              ← Voltar
            </button>
            <p className="font-semibold text-stone-500">Mesa {mesa}</p>
          </div>
          {!digitar ? (
            <>
              <h1 className="text-center text-3xl font-bold">Mostre o QR da sua comanda para a câmera</h1>
              <LeitorQR onLer={identificar} frontal pausado={ocupado} className="mx-auto aspect-[4/3] w-full max-w-xl" />
              {erro && <p className="rounded-2xl bg-rose-100 px-4 py-3 text-center text-lg font-medium text-rose-700">{erro}</p>}
              <button onClick={() => setDigitar(true)} className="mx-auto rounded-full border-2 border-stone-300 px-6 py-3 text-lg font-semibold text-stone-700">
                Prefiro digitar o número
              </button>
            </>
          ) : (
            <DigitarComanda
              ocupado={ocupado}
              erro={erro}
              onEnviar={(n, s) => identificar(`${n}-${s}`)}
              onCamera={() => {
                setErro(null);
                setDigitar(false);
              }}
            />
          )}
        </div>
      )}

      {/* ---------------- CARDÁPIO ---------------- */}
      {fase === "cardapio" && conta && (
        <div className="pb-28">
          <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#fbf7f2]/95 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Mesa {mesa}</p>
                <p className="text-xl font-bold leading-tight">Comanda {conta.comanda}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => {
                    atualizarConta();
                    setVerConta(true);
                  }}
                  className="rounded-full bg-white px-4 py-2.5 font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200"
                >
                  Minha conta · {dinheiro(conta.total)}
                </button>
                <button onClick={chamarGarcom} className="hidden rounded-full bg-white px-4 py-2.5 font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200 sm:block">
                  Chamar garçom
                </button>
                <button onClick={voltarInicio} className="rounded-full bg-stone-800 px-4 py-2.5 font-semibold text-white">
                  Sair
                </button>
              </div>
            </div>
            <nav className="sem-barra flex gap-2 overflow-x-auto px-4 pb-3">
              {grupos.map((g) => (
                <a
                  key={g.id}
                  href={`#cat-${g.id}`}
                  onClick={() => setCatAtiva(g.id)}
                  className={`shrink-0 rounded-full px-4 py-2 font-semibold ${catAtiva === g.id ? "bg-orange-500 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}
                >
                  {g.nome}
                </a>
              ))}
            </nav>
          </header>

          {erro && <p className="mx-4 mt-3 rounded-2xl bg-rose-100 px-4 py-3 text-center font-medium text-rose-700">{erro}</p>}
          {grupos.length === 0 && <p className="p-10 text-center text-stone-500">O cardápio ainda está vazio.</p>}

          {grupos.map((g) => (
            <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-32 px-4 pt-5">
              <h2 className="mb-3 text-2xl font-bold">{g.nome}</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {g.itens.map((p) => {
                  const foto = urlFoto(p.foto);
                  const noCarrinho = carrinho.filter((x) => x.produto.id === p.id).reduce((s, x) => s + x.quantidade, 0);
                  return (
                    <button
                      key={p.id}
                      disabled={!p.disponivel}
                      onClick={() => setAberto(p)}
                      className="relative flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-stone-200 disabled:opacity-50"
                    >
                      <div className="aspect-[16/10] w-full bg-orange-50">
                        {foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-4xl font-black text-orange-200">{p.nome[0]}</div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <p className="font-bold leading-tight">{p.nome}</p>
                        {p.descricao && <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{p.descricao}</p>}
                        <p className="mt-auto pt-2 text-lg font-bold text-orange-600">{dinheiro(p.preco)}</p>
                      </div>
                      {!p.disponivel && <span className="absolute left-2 top-2 rounded-full bg-stone-900 px-3 py-1 text-sm font-bold text-white">Acabou</span>}
                      {noCarrinho > 0 && (
                        <span className="absolute right-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-orange-500 px-2 font-bold text-white">
                          {noCarrinho}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {carrinho.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-40 p-4">
              <button
                onClick={() => setVerCarrinho(true)}
                className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-2xl bg-orange-500 px-6 py-4 text-xl font-bold text-white shadow-2xl shadow-orange-500/40"
              >
                <span>Ver pedido ({qtdCarrinho})</span>
                <span>{dinheiro(totalCarrinho)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------- ENVIADO ---------------- */}
      {fase === "enviado" && (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 text-6xl font-black text-white">✓</div>
          <h1 className="text-4xl font-bold">Pedido enviado!</h1>
          <p className="max-w-md text-xl text-stone-600">Assim que ficar pronto, o garçom leva até a mesa {mesa}.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                ultimoToque.current = Date.now();
                setFase("cardapio");
              }}
              className="rounded-full border-2 border-stone-300 px-8 py-4 text-xl font-semibold text-stone-700"
            >
              Pedir mais
            </button>
            <button onClick={voltarInicio} className="rounded-full bg-stone-900 px-8 py-4 text-xl font-semibold text-white">
              Pronto
            </button>
          </div>
        </div>
      )}

      {/* ---------------- PRODUTO ---------------- */}
      {aberto && <ProdutoAberto produto={aberto} onFechar={() => setAberto(null)} onAdicionar={adicionar} />}

      {/* ---------------- CARRINHO ---------------- */}
      {verCarrinho && (
        <Folha onFechar={() => setVerCarrinho(false)}>
          <h2 className="text-2xl font-bold">Seu pedido</h2>
          <p className="text-stone-500">
            Comanda {conta?.comanda} · Mesa {mesa}
          </p>
          <ul className="my-4 divide-y divide-stone-200">
            {carrinho.map((x, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{x.produto.nome}</p>
                  {x.observacao && <p className="text-sm text-orange-700">{x.observacao}</p>}
                  <p className="text-sm text-stone-500">{dinheiro(Number(x.produto.preco) * x.quantidade)}</p>
                </div>
                <Contador valor={x.quantidade} onMenos={() => mudarQtd(i, -1)} onMais={() => mudarQtd(i, 1)} podeZerar />
              </li>
            ))}
          </ul>
          {carrinho.length === 0 && <p className="py-6 text-center text-stone-500">Seu pedido está vazio.</p>}
          {erro && <p className="mb-3 rounded-2xl bg-rose-100 px-4 py-3 text-center font-medium text-rose-700">{erro}</p>}
          <button
            onClick={enviar}
            disabled={ocupado || !carrinho.length}
            className="flex w-full items-center justify-between rounded-2xl bg-orange-500 px-6 py-5 text-xl font-bold text-white disabled:opacity-50"
          >
            <span>{ocupado ? "Enviando..." : "Enviar para a cozinha"}</span>
            <span>{dinheiro(totalCarrinho)}</span>
          </button>
          <button onClick={() => setVerCarrinho(false)} className="mt-3 w-full py-2 text-lg font-semibold text-stone-500">
            Continuar escolhendo
          </button>
        </Folha>
      )}

      {/* ---------------- CONTA ---------------- */}
      {verConta && conta && (
        <Folha onFechar={() => setVerConta(false)}>
          <h2 className="text-2xl font-bold">Minha conta · Comanda {conta.comanda}</h2>
          <ul className="my-4 divide-y divide-stone-200">
            {conta.itens.map((i) => {
              const [rotulo, cor] = STATUS[i.cancelado ? "cancelado" : i.status] ?? STATUS.entregue;
              return (
                <li key={i.id} className={`flex items-center gap-3 py-3 ${i.cancelado ? "opacity-50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${i.cancelado ? "line-through" : ""}`}>
                      {qtdTexto(i)} {i.descricao}
                    </p>
                    {i.observacao && <p className="text-sm text-stone-500">{i.observacao}</p>}
                  </div>
                  {i.tipo === "produto" && <span className={`rounded-full px-3 py-1 text-sm font-semibold ${cor}`}>{rotulo}</span>}
                  <span className="w-24 text-right font-semibold tabular-nums">{dinheiro(i.total)}</span>
                </li>
              );
            })}
          </ul>
          {conta.itens.length === 0 && <p className="py-6 text-center text-stone-500">Nada pedido ainda.</p>}
          <div className="flex items-center justify-between rounded-2xl bg-stone-100 px-5 py-4 text-xl font-bold">
            <span>Total</span>
            <span>{dinheiro(conta.total)}</span>
          </div>
          {Number(conta.taxa_servico) > 0 && Number(conta.base_servico) > 0 && (
            <p className="mt-2 text-center text-stone-500">
              + taxa de serviço opcional de {String(conta.taxa_servico).replace(".", ",")}% ({dinheiro(Math.round(Number(conta.base_servico) * Number(conta.taxa_servico)) / 100)})
            </p>
          )}
          <p className="mt-3 text-center text-stone-500">O pagamento é feito no caixa, na saída. Entregue sua comanda lá.</p>
          <button onClick={() => setVerConta(false)} className="mt-4 w-full rounded-2xl bg-stone-900 py-4 text-lg font-semibold text-white">
            Voltar ao cardápio
          </button>
        </Folha>
      )}
    </div>
  );
}

// ======================================================================
function Folha({ children, onFechar }: { children: React.ReactNode; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl">
        {children}
      </div>
    </div>
  );
}

function Contador({ valor, onMenos, onMais, podeZerar = false }: { valor: number; onMenos: () => void; onMais: () => void; podeZerar?: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-stone-100 p-1">
      <button
        onClick={onMenos}
        disabled={!podeZerar && valor <= 1}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold shadow-sm disabled:opacity-40"
        aria-label="Menos"
      >
        −
      </button>
      <span className="w-8 text-center text-xl font-bold tabular-nums">{valor}</span>
      <button
        onClick={onMais}
        disabled={valor >= 50}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold shadow-sm disabled:opacity-40"
        aria-label="Mais"
      >
        +
      </button>
    </div>
  );
}

function ProdutoAberto({ produto, onFechar, onAdicionar }: { produto: Produto; onFechar: () => void; onAdicionar: (p: Produto, q: number, obs: string) => void }) {
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");
  const foto = urlFoto(produto.foto);
  return (
    <Folha onFechar={onFechar}>
      {foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="-mx-6 -mt-6 mb-4 aspect-[16/9] w-[calc(100%+3rem)] max-w-none object-cover" />
      )}
      <h2 className="text-3xl font-bold">{produto.nome}</h2>
      {produto.descricao && <p className="mt-1 text-lg text-stone-500">{produto.descricao}</p>}
      <p className="mt-2 text-2xl font-bold text-orange-600">{dinheiro(produto.preco)}</p>
      <label className="mt-5 block">
        <span className="text-stone-600">Alguma observação?</span>
        <input
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          maxLength={140}
          placeholder="Ex.: sem cebola, bem passado"
          className="mt-1 w-full rounded-2xl border-2 border-stone-200 bg-stone-50 px-4 py-3 text-lg outline-none focus:border-orange-400"
        />
      </label>
      <div className="mt-5 flex items-center gap-4">
        <Contador valor={qtd} onMenos={() => setQtd((q) => Math.max(1, q - 1))} onMais={() => setQtd((q) => Math.min(50, q + 1))} />
        <button onClick={() => onAdicionar(produto, qtd, obs)} className="flex flex-1 items-center justify-between rounded-2xl bg-orange-500 px-5 py-4 text-lg font-bold text-white">
          <span>Adicionar</span>
          <span>{dinheiro(Number(produto.preco) * qtd)}</span>
        </button>
      </div>
    </Folha>
  );
}

function DigitarComanda({
  onEnviar,
  onCamera,
  ocupado,
  erro,
}: {
  onEnviar: (numero: string, senha: string) => void;
  onCamera: () => void;
  ocupado: boolean;
  erro: string | null;
}) {
  const [numero, setNumero] = useState("");
  const [senha, setSenha] = useState("");
  const [campo, setCampo] = useState<"numero" | "senha">("numero");

  function tecla(t: string) {
    if (t === "apagar") {
      if (campo === "senha" && !senha) return setCampo("numero");
      return campo === "numero" ? setNumero((v) => v.slice(0, -1)) : setSenha((v) => v.slice(0, -1));
    }
    if (campo === "numero") setNumero((v) => (v.length < 5 ? v + t : v));
    else setSenha((v) => (v.length < 3 ? v + t : v));
  }

  const pronto = numero.length > 0 && senha.length === 3;
  const caixa = (ativo: boolean) => `flex-1 rounded-2xl border-4 px-4 py-3 text-center ${ativo ? "border-orange-500 bg-white" : "border-stone-200 bg-stone-50"}`;

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <h1 className="text-center text-2xl font-bold">Digite o número e a senha da comanda</h1>
      <p className="text-center text-stone-500">Os dois estão impressos na sua comanda.</p>
      <div className="flex gap-3">
        <button onClick={() => setCampo("numero")} className={caixa(campo === "numero")}>
          <span className="block text-sm text-stone-500">Número</span>
          <span className="block h-10 text-3xl font-bold tabular-nums">{numero}</span>
        </button>
        <button onClick={() => setCampo("senha")} className={caixa(campo === "senha")}>
          <span className="block text-sm text-stone-500">Senha</span>
          <span className="block h-10 text-3xl font-bold tracking-[0.4em] tabular-nums">{senha.padEnd(3, "·")}</span>
        </button>
      </div>
      {erro && <p className="rounded-2xl bg-rose-100 px-4 py-3 text-center font-medium text-rose-700">{erro}</p>}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((t) => (
          <button key={t} onClick={() => tecla(t)} className="rounded-2xl bg-white py-4 text-3xl font-bold shadow-sm ring-1 ring-stone-200 active:bg-stone-100">
            {t}
          </button>
        ))}
        <button onClick={() => tecla("apagar")} className="rounded-2xl bg-stone-200 py-4 text-xl font-semibold">
          Apagar
        </button>
        <button onClick={() => tecla("0")} className="rounded-2xl bg-white py-4 text-3xl font-bold shadow-sm ring-1 ring-stone-200 active:bg-stone-100">
          0
        </button>
        {campo === "numero" ? (
          <button onClick={() => numero && setCampo("senha")} className="rounded-2xl bg-stone-800 py-4 text-xl font-semibold text-white">
            Próximo
          </button>
        ) : (
          <button onClick={() => pronto && onEnviar(numero, senha)} disabled={!pronto || ocupado} className="rounded-2xl bg-orange-500 py-4 text-xl font-bold text-white disabled:opacity-40">
            {ocupado ? "..." : "Entrar"}
          </button>
        )}
      </div>
      <button onClick={onCamera} className="w-full py-2 text-lg font-semibold text-stone-500">
        Usar a câmera
      </button>
    </div>
  );
}

function ConfigurarMesa({
  email,
  mesas,
  atual,
  precisaSenha,
  onPronto,
  onCancelar,
  onSair,
}: {
  email: string;
  mesas: number[];
  atual: number | null;
  precisaSenha: boolean;
  onPronto: (n: number) => void;
  onCancelar?: () => void;
  onSair: () => void;
}) {
  const [liberado, setLiberado] = useState(!precisaSenha);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function conferir(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await criarClienteNavegador().auth.signInWithPassword({ email, password: senha });
    if (error) return setErro("Senha errada.");
    setLiberado(true);
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Configurar tablet</p>
        <h1 className="text-2xl font-bold">Em qual mesa este tablet fica?</h1>
        <p className="text-sm text-zinc-400">Depois, para trocar, toque 5 vezes rápido no nome do restaurante na tela inicial.</p>
      </div>
      {!liberado ? (
        <form onSubmit={conferir} className="space-y-3">
          <label className="block text-sm text-zinc-300">
            Senha do login deste tablet
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-orange-500"
            />
          </label>
          {erro && <p className="text-sm text-rose-400">{erro}</p>}
          <button className="w-full rounded-lg bg-orange-500 py-2.5 font-semibold text-black">Continuar</button>
        </form>
      ) : (
        <>
          {mesas.length === 0 && <p className="text-sm text-amber-300">Nenhuma mesa cadastrada. O dono cadastra em Mesas.</p>}
          <div className="grid grid-cols-5 gap-2">
            {mesas.map((n) => (
              <button
                key={n}
                onClick={() => onPronto(n)}
                className={`rounded-xl py-4 text-2xl font-bold ${n === atual ? "bg-orange-500 text-black" : "bg-white/5 hover:bg-white/10"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex gap-2">
        {onCancelar && (
          <button onClick={onCancelar} className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm">
            Cancelar
          </button>
        )}
        <button onClick={onSair} className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm text-zinc-400">
          Sair do login
        </button>
      </div>
    </div>
  );
}
