export type Papel = "dono" | "gerente" | "caixa" | "cozinha" | "garcom" | "entrada" | "balanca" | "mesa";

export const PAPEIS: { papel: Papel; nome: string; tela: string; explica: string }[] = [
  { papel: "dono", nome: "Dono", tela: "/painel", explica: "Vê tudo e cadastra a equipe" },
  { papel: "gerente", nome: "Gerente", tela: "/painel", explica: "Vê tudo, menos equipe e configurações" },
  { papel: "entrada", nome: "Entrada", tela: "/entrada", explica: "Lê a comanda na chegada e abre" },
  { papel: "mesa", nome: "Tablet de mesa", tela: "/mesa", explica: "O cliente faz o pedido" },
  { papel: "cozinha", nome: "Cozinha / Balcão", tela: "/cozinha", explica: "Vê os pedidos e marca pronto" },
  { papel: "garcom", nome: "Garçom", tela: "/garcom", explica: "Leva o que ficou pronto e atende chamados" },
  { papel: "balanca", nome: "Balança", tela: "/balanca", explica: "Lança o peso do prato (por quilo)" },
  { papel: "caixa", nome: "Caixa", tela: "/caixa", explica: "Lê a comanda na saída e recebe" },
];

export const nomePapel = (p: string | null | undefined) => PAPEIS.find((x) => x.papel === p)?.nome ?? "—";
export const telaDoPapel = (p: string | null | undefined) => PAPEIS.find((x) => x.papel === p)?.tela ?? "/login";
export const ehGestao = (p: string | null | undefined) => p === "dono" || p === "gerente";

// Logins da equipe viram e-mail interno (ninguém recebe e-mail nenhum)
export const DOMINIO_EQUIPE = "acesso.fhdigitalmarketing.com";
export function emailDoUsuario(login: string) {
  const v = login.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${DOMINIO_EQUIPE}`;
}
export function usuarioDoEmail(email: string | null | undefined) {
  if (!email) return "";
  return email.endsWith(`@${DOMINIO_EQUIPE}`) ? email.slice(0, -DOMINIO_EQUIPE.length - 1) : email;
}
