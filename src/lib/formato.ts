const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const dinheiro = (v: number | string | null | undefined) => moeda.format(Number(v ?? 0));

export const hora = (d: string | Date) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export const dataHora = (d: string | Date) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

// Minutos desde uma data
export const minutosDesde = (d: string | Date, agora = Date.now()) => Math.max(0, Math.floor((agora - new Date(d).getTime()) / 60000));

// Aceita "12,50" ou "12.50"
export function lerNumero(txt: string): number | null {
  const limpo = txt.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export const FORMAS: Record<string, string> = { pix: "Pix", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro" };

// Erros do Supabase em português (as funções do banco já mandam mensagem pronta)
export function mensagemErro(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e ?? "");
  if (/Failed to fetch|NetworkError|fetch failed/i.test(m)) return "Sem internet. Confira a conexão e tente de novo.";
  if (/JWT|session|Auth/i.test(m)) return "Sessão expirou. Entre de novo.";
  return m || "Algo deu errado. Tente de novo.";
}

// Início e fim do dia em São Paulo (UTC-3, sem horário de verão)
export function diaSP(dataISO?: string) {
  const base = dataISO ?? new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const inicio = new Date(`${base}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + 24 * 3600_000);
  return { base, inicio, fim };
}
