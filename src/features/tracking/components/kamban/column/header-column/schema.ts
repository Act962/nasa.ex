import z from "zod";

export const schema = z.object({
  title: z.string("Valor inválido").min(1, "Titulo muito curto"),
});
