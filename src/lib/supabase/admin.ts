import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com a SECRET KEY: só roda no servidor, nunca vai para o navegador.
// Usado só para criar/remover os logins da equipe.
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
