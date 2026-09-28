"use client";

export default function BotaoImprimir() {
  return (
    <button onClick={() => window.print()} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black">
      Imprimir
    </button>
  );
}
