"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

// Lê QR Code pela câmera. Usa o leitor nativo do navegador (Android/Chrome)
// e, se não tiver (iPhone/iPad), usa a biblioteca jsQR.
export default function LeitorQR({
  onLer,
  frontal = false,
  pausado = false,
  className = "",
}: {
  onLer: (texto: string) => void;
  frontal?: boolean;
  pausado?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onLerRef = useRef(onLer);
  onLerRef.current = onLer;
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let parar = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ultimo = "";
    let ultimoEm = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: frontal ? "user" : "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (parar) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
      } catch {
        setErro("Não consegui abrir a câmera. Libere a permissão da câmera no navegador.");
        return;
      }

      let detector: Detector | null = null;
      const BD = (window as unknown as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      if (BD) {
        try {
          const formatos = (await BD.getSupportedFormats?.()) ?? ["qr_code"];
          if (formatos.includes("qr_code")) detector = new BD({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      const jsQR = detector ? null : (await import("jsqr")).default;

      const avisar = (txt: string) => {
        const agora = Date.now();
        if (txt === ultimo && agora - ultimoEm < 4000) return; // mesma comanda parada na frente
        ultimo = txt;
        ultimoEm = agora;
        onLerRef.current(txt);
      };

      const olhar = async () => {
        if (parar) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2 && !pausadoRef.current) {
          try {
            if (detector) {
              const r = await detector.detect(v);
              if (r[0]?.rawValue) avisar(r[0].rawValue);
            } else if (jsQR && ctx) {
              const larg = 640;
              const alt = Math.round((v.videoHeight / v.videoWidth) * larg) || 480;
              canvas.width = larg;
              canvas.height = alt;
              ctx.drawImage(v, 0, 0, larg, alt);
              const img = ctx.getImageData(0, 0, larg, alt);
              const r = jsQR(img.data, larg, alt, { inversionAttempts: "dontInvert" });
              if (r?.data) avisar(r.data);
            }
          } catch {
            /* frame ruim, tenta o próximo */
          }
        }
        timer = setTimeout(olhar, 220);
      };
      olhar();
    })();

    return () => {
      parar = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [frontal]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black ${className}`}>
      <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${frontal ? "-scale-x-100" : ""}`} />
      {/* moldura para mirar */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="aspect-square w-1/2 max-w-64 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      {erro && <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-rose-300">{erro}</div>}
    </div>
  );
}
