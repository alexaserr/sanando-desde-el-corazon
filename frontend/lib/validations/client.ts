import { z } from "zod";

const maritalStatusEnum = z.enum([
  "single",
  "married",
  "divorced",
  "widowed",
  "common_law",
  "other",
]);

export const clientCreateSchema = z.object({
  full_name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(200, "El nombre no puede exceder 200 caracteres"),
  email: z.string().email("Correo electrónico inválido").optional(),
  phone: z
    .string()
    .regex(/^\+52\d{10}$/, "El teléfono debe tener formato +52XXXXXXXXXX")
    .optional(),
  birth_date: z.string().optional(),
  marital_status: maritalStatusEnum.optional(),
  birth_place: z.string().optional(),
  residence_place: z.string().optional(),
  profession: z.string().optional(),
  motivation_visit: z.record(z.unknown()).optional(),
  motivation_general: z.string().optional(),
  num_children: z.number().int().min(0).optional(),
  num_siblings: z.number().int().min(0).optional(),
  birth_order: z.number().int().min(0).optional(),
  predominant_emotions: z.array(z.string()).optional(),
  family_abortions: z.number().int().min(0).optional(),
  deaths_before_41: z.string().optional(),
  important_notes: z.string().optional(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
