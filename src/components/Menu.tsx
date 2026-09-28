"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/painel", nome: "Painel" },
  { href: "/vendas", nome: "Vendas" },
  { href: "/cardapio", nome: "Cardápio" },
  { href: "/comandas", nome: "Comandas" },
  { href: "/mesas", nome: "Mesas" },
  { href: "/equipe", nome: "Equipe", soDono: true },
  { href: "/config", nome: "Configurações", soDono: true },
  { href: "/telas", nome: "Telas" },
];

// Menu em linha; no celular rola para o lado
export default function Menu({ dono }: { dono: boolean }) {
  const atual = usePathname() ?? "";
  return (
    <nav className="sem-barra -mx-4 flex gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:px-0">
      {LINKS.filter((l) => dono || !l.soDono).map((l) => {
        const ativo = atual.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 ${
              ativo ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {l.nome}
          </Link>
        );
      })}
    </nav>
  );
}
