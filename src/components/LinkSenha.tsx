import Link from "next/link";

// Atalho para trocar a senha: só o ícone no celular, ícone + texto no computador
export default function LinkSenha() {
  return (
    <Link
      href="/senha"
      aria-label="Trocar senha"
      title="Trocar senha"
      className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 px-2.5 text-sm text-zinc-300 hover:bg-white/10"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="m10.7 12.3 9.8-9.8" />
        <path d="m15.5 7.5 3 3" />
        <path d="m18 5 2 2" />
      </svg>
      <span className="hidden sm:inline">Trocar senha</span>
    </Link>
  );
}
