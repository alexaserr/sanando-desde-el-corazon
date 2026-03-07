import { z } from "zod";

const uuidSchema = z.string().uuid("Debe ser un UUID válido");

export const sessionCreateSchema = z.object({
  client_id: uuidSchema,
  therapy_type_id: uuidSchema,
  measured_at: z.string().datetime({ message: "Debe ser una fecha ISO válida" }),
});

export const energyReadingsSchema = z.object({
  readings: z
    .array(
      z.object({
        dimension_id: uuidSchema,
        value: z.number().min(0).max(100),
      })
    )
    .min(1, "Se requiere al menos una lectura de energía"),
});

export const chakraReadingsSchema = z.object({
  readings: z
    .array(
      z.object({
        chakra_position_id: uuidSchema,
        value: z.number().min(0).max(14),
      })
    )
    .min(1, "Se requiere al menos una lectura de chakra"),
});

export const topicsSchema = z.object({
  topics: z
    .array(
      z.object({
        source_type: z.enum(["spine", "organ"]),
        zone: z.string().optional(),
        adult_theme: z.string().optional(),
        child_theme: z.string().optional(),
        adult_age: z.number().int().min(0).max(120).optional(),
        child_age: z.number().int().min(0).max(18).optional(),
        emotions: z.string().optional(),
        initial_energy: z.number().min(0).max(100).optional(),
        final_energy: z.number().min(0).max(100).optional(),
      })
    )
    .min(1, "Se requiere al menos un tema"),
});

export const sessionCloseSchema = z.object({
  cost: z.number().min(0).optional().nullable(),
  payment_notes: z.string().optional().nullable(),
});

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
export type EnergyReadingsInput = z.infer<typeof energyReadingsSchema>;
export type ChakraReadingsInput = z.infer<typeof chakraReadingsSchema>;
export type TopicsInput = z.infer<typeof topicsSchema>;
export type SessionCloseInput = z.infer<typeof sessionCloseSchema>;
