"use client";

import { useEffect, useRef } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";

// Para as telas da operação (cozinha, garçom, caixa...):
// chama `recarregar` quando as tabelas mudam, a cada `intervalo` ms
// (se o tempo real cair) e quando a internet volta / a aba volta ao foco.
export function useAoVivo(empresaId: string, tabelas: string[], recarregar: () => void, intervalo = 15_000) {
  const ref = useRef(recarregar);
  ref.current = recarregar;
  const chave = tabelas.join(",");

  useEffect(() => {
    const supabase = criarClienteNavegador();
    let espera: ReturnType<typeof setTimeout> | null = null;
    const disparar = () => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => ref.current(), 250);
    };
    let canal = supabase.channel(`op-${empresaId}-${chave}-${Math.random().toString(36).slice(2, 7)}`);
    for (const tabela of chave.split(",")) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: tabela, filter: `empresa_id=eq.${empresaId}` }, disparar);
    }
    canal.subscribe();
    const relogio = setInterval(() => ref.current(), intervalo);
    const aoVoltar = () => document.visibilityState === "visible" && ref.current();
    window.addEventListener("online", disparar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      if (espera) clearTimeout(espera);
      clearInterval(relogio);
      window.removeEventListener("online", disparar);
      document.removeEventListener("visibilitychange", aoVoltar);
      supabase.removeChannel(canal);
    };
  }, [empresaId, chave, intervalo]);
}

// Mantém a tela do tablet acesa enquanto a página está aberta
export function useTelaAcesa() {
  useEffect(() => {
    let trava: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        if (nav.wakeLock && document.visibilityState === "visible") trava = await nav.wakeLock.request("screen");
      } catch {
        /* navegador sem suporte: tudo bem */
      }
    };
    pedir();
    const aoVoltar = () => document.visibilityState === "visible" && pedir();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      trava?.release().catch(() => {});
    };
  }, []);
}

// Bip curto (precisa de um toque na tela antes, regra dos navegadores)
let audio: AudioContext | null = null;
export function liberarSom() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
  } catch {
    /* sem som */
  }
}
export function bip(vezes = 2, freq = 880) {
  try {
    if (!audio) return;
    for (let i = 0; i < vezes; i++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = freq;
      o.type = "sine";
      const t = audio.currentTime + i * 0.28;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 0.25);
    }
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    /* sem som */
  }
}
