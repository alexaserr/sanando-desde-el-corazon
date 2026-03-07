import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const totpSchema = z.object({
  code: z
    .string()
    .length(6, "El código debe tener 6 dígitos")
    .regex(/^\d{6}$/, "El código solo debe contener dígitos"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TotpInput = z.infer<typeof totpSchema>;
