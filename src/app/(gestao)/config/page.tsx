import { redirect } from "next/navigation";
import { exigirTela } from "@/lib/contexto";
import { Titulo } from "@/components/ui";
import FormConfig from "./FormConfig";

export const dynamic = "force-dynamic";

export default async function PaginaConfig() {
  const { empresa, papel } = await exigirTela([]);
  if (papel !== "dono") redirect("/painel");
  return (
    <>
      <Titulo>Configurações</Titulo>
      <FormConfig empresa={empresa} />
    </>
  );
}
