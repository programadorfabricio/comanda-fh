"use client";

import { useEffect, useRef, useState } from "react";

// Campo que recebe o leitor de código (USB/Bluetooth funciona como teclado + Enter)
// ou o número digitado. No computador fica sempre com o foco, para o leitor funcionar direto.
export default function CampoLeitura({
  onLer,
  placeholder = "Leia a comanda ou digite o número",
  manterFoco = true,
  ocupado = false,
}: {
  onLer: (texto: string) => void;
  placeholder?: string;
  manterFoco?: boolean;
  ocupado?: boolean;
}) {
  const [valor, setValor] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Só em computador (mouse/teclado): no tablet, o foco automático abriria o teclado da tela sem parar
    if (!manterFoco || !window.matchMedia("(pointer: fine)").matches) return;
    const focar = () => {
      const ativo = document.activeElement;
      // não rouba o foco de outro campo que a pessoa está usando
      if (ativo && ativo !== document.body && ativo !== ref.current && ["INPUT", "TEXTAREA", "SELECT"].includes(ativo.tagName)) return;
      ref.current?.focus({ preventScroll: true });
    };
    focar();
    const t = setInterval(focar, 1500);
    return () => clearInterval(t);
  }, [manterFoco]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = valor.trim();
    if (!v || ocupado) return;
    setValor("");
    onLer(v);
  }

  return (
    <form onSubmit={enviar} className="flex gap-2">
      <input
        ref={ref}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="characters"
        inputMode="numeric"
        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-lg outline-none focus:border-orange-500"
      />
      <button disabled={ocupado} className="shrink-0 rounded-xl bg-orange-500 px-5 font-semibold text-black disabled:opacity-50">
        OK
      </button>
    </form>
  );
}
