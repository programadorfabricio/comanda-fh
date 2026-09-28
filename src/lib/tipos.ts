export type Categoria = { id: string; nome: string; ordem: number; ativa: boolean };
export type Produto = {
  id: string;
  categoria_id: string | null;
  nome: string;
  descricao: string;
  preco: number;
  foto: string | null;
  setor: "cozinha" | "balcao";
  disponivel: boolean;
  ordem: number;
};

export type ItemConta = {
  id: string;
  descricao: string;
  quantidade: number;
  preco_unit: number;
  total: number;
  tipo: "produto" | "quilo" | "avulso" | "multa";
  observacao: string;
  cancelado: boolean;
  status: "novo" | "preparando" | "pronto" | "entregue" | "cancelado";
  criado_em: string;
};

export type ResumoConta = {
  conta_id: string | null; // null = comanda ainda livre (abre no 1º pedido)
  comanda: number;
  status: string;
  mesa: number | null;
  aberta_em: string;
  total: number;
  taxa_servico: number;
  base_servico: number;
  itens: ItemConta[];
};

export const qtdTexto = (i: Pick<ItemConta, "tipo" | "quantidade">) =>
  i.tipo === "quilo" ? `${Number(i.quantidade).toFixed(3).replace(".", ",")} kg` : `${Number(i.quantidade)}×`;
