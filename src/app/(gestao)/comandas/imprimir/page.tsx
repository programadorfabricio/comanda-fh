import QRCode from "qrcode";
import { exigirTela } from "@/lib/contexto";
import { dinheiro } from "@/lib/formato";
import BotaoImprimir from "./BotaoImprimir";

export const dynamic = "force-dynamic";

// Folha A4 com as comandas em tamanho de cartão (85 x 54 mm), 10 por página
export default async function ImprimirComandas({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { supabase, empresa } = await exigirTela([]);
  const q = await searchParams;
  const de = Math.max(1, Number(q.de) || 1);
  const ate = Math.min(de + 299, Math.max(de, Number(q.ate) || de));

  const { data } = await supabase.from("comandas").select("numero, codigo, senha").gte("numero", de).lte("numero", ate).order("numero");
  const cartoes = await Promise.all(
    (data ?? []).map(async (c) => ({
      ...c,
      svg: await QRCode.toString(`CFH-${c.codigo}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" }),
    }))
  );
  const multa = Number(empresa.multa_comanda);

  return (
    <div>
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print { .folha { gap: 0 !important; } }
      `}</style>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <p className="text-sm text-zinc-300">
          {cartoes.length} comanda(s), do nº {de} ao {cartoes.at(-1)?.numero ?? ate}. Recorte na linha tracejada e plastifique.
        </p>
        <BotaoImprimir />
      </div>
      <div className="folha mx-auto grid w-fit grid-cols-2 gap-2 bg-white text-black">
        {cartoes.map((c) => (
          <div
            key={c.numero}
            className="flex break-inside-avoid items-center gap-[4mm] border border-dashed border-zinc-400 p-[4mm]"
            style={{ width: "85.6mm", height: "54mm" }}
          >
            <div className="shrink-0" style={{ width: "38mm", height: "38mm" }} dangerouslySetInnerHTML={{ __html: c.svg }} />
            <div className="flex h-full min-w-0 flex-1 flex-col justify-between">
              <p className="truncate text-[9pt] font-semibold uppercase leading-tight tracking-wide">{empresa.nome}</p>
              <div>
                <p className="text-[8pt] uppercase tracking-widest text-zinc-600">Comanda</p>
                <p className="text-[34pt] font-black leading-none tabular-nums">{c.numero}</p>
                <p className="mt-1 text-[8pt] text-zinc-700">
                  Senha <b className="tabular-nums">{c.senha}</b>
                </p>
              </div>
              <p className="text-[7pt] leading-tight text-zinc-700">
                Devolva na saída.{multa > 0 ? ` Perda: ${dinheiro(multa)}.` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
