import z from "zod"

export const schema = z.object({
    name: z.string().min(1, "O nome é obrigatório")
})