"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import type { Client, MaritalStatus } from "@/types/api";

// ─── Listas predefinidas ──────────────────────────────────────────────────────

const EMOTIONS = [
  "Admiración", "Agradecimiento", "Alegría", "Ansiedad", "Apatía",
  "Asco", "Culpa", "Curiosidad", "Decepción", "Depresión",
  "Dolor", "Enojo", "Entusiasmo", "Frustración", "Impuntualidad",
  "Inseguridad", "Ira", "Miedo", "Nerviosismo", "Neutralidad",
  "Optimismo", "Soledad", "Sorpresa", "Tristeza", "Vacío",
] as const;

const MOTIVATIONS = [
  "Cortar pensamientos limitantes",
  "Crecimiento personal",
  "Disolver trauma",
  "Encontrar más oportunidades personales",
  "Estabilidad familiar",
  "Mejorar estado de ánimo",
  "Mejorar salud emocional",
  "Mejorar salud física",
  "Poder tomar decisiones",
  "Reconectar consigo mismo",
] as const;

const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: "single", label: "Soltero/a" },
  { value: "married", label: "Casado/a" },
  { value: "divorced", label: "Divorciado/a" },
  { value: "widowed", label: "Viudo/a" },
  { value: "common_law", label: "Unión libre" },
  { value: "other", label: "Otro" },
];

// ─── Esquema Zod ──────────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];

const schema = z.object({
  full_name: z.string().min(1, "El nombre es requerido"),
  email: z
    .union([z.literal(""), z.string().email("Correo electrónico inválido")])
    .optional(),
  phone: z
    .string()
    .refine((v) => !v || v.startsWith("+"), "Debe empezar con + (ej. +521...)")
    .optional(),
  birth_date: z
    .string()
    .refine((v) => !v || v <= today, "La fecha de nacimiento no puede ser futura")
    .optional(),
  marital_status: z
    .enum(["single", "married", "divorced", "widowed", "common_law", "other"])
    .optional()
    .or(z.literal("")),
  profession: z.string().optional(),
  birth_place: z.string().optional(),
  residence_place: z.string().optional(),
  num_children: z.string().optional(),
  num_siblings: z.string().optional(),
  birth_order: z.string().optional(),
  motivation_general: z.string().optional(),
  family_abortions: z.string().optional(),
  deaths_before_41: z.string().optional(),
  important_notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg text-terra-900 mb-4">{children}</h2>
  );
}

function inputClass(hasError?: boolean) {
  return [
    "w-full h-11 rounded border px-3 text-sm text-gray-900",
    "focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    hasError ? "border-red-400" : "border-gray-200",
  ].join(" ");
}

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt],
    );
  };

  return (
    <div className="md:col-span-2">
      <p className="text-sm font-medium text-gray-700 mb-3">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 cursor-pointer min-h-[44px] py-1"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4 rounded border-gray-300 text-terra-700 focus:ring-terra-500 shrink-0"
            />
            <span className="text-sm text-gray-700 leading-tight">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function NuevoPacientePage() {
  const router = useRouter();
  const [emotions, setEmotions] = useState<string[]>([]);
  const [motivations, setMotivations] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);

    const toInt = (v?: string) =>
      v && v.trim() !== "" ? parseInt(v, 10) : undefined;

    const payload = {
      full_name: data.full_name.trim(),
      email: data.email || undefined,
      phone: data.phone || undefined,
      birth_date: data.birth_date || undefined,
      marital_status: data.marital_status
        ? (data.marital_status as MaritalStatus)
        : undefined,
      profession: data.profession || undefined,
      birth_place: data.birth_place || undefined,
      residence_place: data.residence_place || undefined,
      num_children: toInt(data.num_children),
      num_siblings: toInt(data.num_siblings),
      birth_order: toInt(data.birth_order),
      predominant_emotions: emotions.length > 0 ? emotions : undefined,
      motivation_visit: motivations.length > 0 ? motivations : undefined,
      motivation_general: data.motivation_general || undefined,
      family_abortions: data.family_abortions || undefined,
      deaths_before_41: data.deaths_before_41 || undefined,
      important_notes: data.important_notes || undefined,
    };

    try {
      const client = await apiClient.post<Client>(
        "/api/v1/clinical/clients",
        payload,
      );
      router.push(`/clinica/pacientes/${client.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Error al guardar el paciente.",
      );
    }
  });

  return (
    <div className="max-w-4xl space-y-6">
      {/* Volver */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/clinica/pacientes")}
          className="text-terra-700 hover:text-terra-900 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a pacientes
        </Button>
      </div>

      {/* Título */}
      <div>
        <h1 className="font-display text-2xl font-bold text-terra-900">
          Nuevo paciente
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Completa la información del expediente clínico
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-8">
        {/* ── SECCIÓN 1: Información Personal ── */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <SectionTitle>Información Personal</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre completo */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register("full_name")}
                placeholder="Nombre completo de la paciente"
                className={inputClass(!!errors.full_name)}
                disabled={isSubmitting}
              />
              <FieldError message={errors.full_name?.message} />
            </div>

            {/* Correo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="correo@ejemplo.com"
                className={inputClass(!!errors.email)}
                disabled={isSubmitting}
              />
              <FieldError message={errors.email?.message} />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Teléfono
              </label>
              <input
                type="tel"
                {...register("phone")}
                placeholder="+52 81 1234 5678"
                className={inputClass(!!errors.phone)}
                disabled={isSubmitting}
              />
              <FieldError message={errors.phone?.message} />
            </div>

            {/* Fecha de nacimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                {...register("birth_date")}
                max={today}
                className={inputClass(!!errors.birth_date)}
                disabled={isSubmitting}
              />
              <FieldError message={errors.birth_date?.message} />
            </div>

            {/* Estado civil */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Estado civil
              </label>
              <select
                {...register("marital_status")}
                className={`${inputClass(!!errors.marital_status)} bg-white`}
                disabled={isSubmitting}
              >
                <option value="">Seleccionar…</option>
                {MARITAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Profesión */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Profesión
              </label>
              <input
                type="text"
                {...register("profession")}
                placeholder="Profesión u ocupación"
                className={inputClass()}
                disabled={isSubmitting}
              />
            </div>

            {/* Lugar de nacimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Lugar de nacimiento
              </label>
              <input
                type="text"
                {...register("birth_place")}
                placeholder="Ciudad, País"
                className={inputClass()}
                disabled={isSubmitting}
              />
            </div>

            {/* Lugar de residencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Lugar de residencia
              </label>
              <input
                type="text"
                {...register("residence_place")}
                placeholder="Ciudad, País"
                className={inputClass()}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 2: Perfil Emocional ── */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <SectionTitle>Perfil Emocional</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CheckboxGroup
              label="Emociones predominantes"
              options={EMOTIONS}
              selected={emotions}
              onChange={setEmotions}
            />

            <CheckboxGroup
              label="Motivación de visita"
              options={MOTIVATIONS}
              selected={motivations}
              onChange={setMotivations}
            />

            {/* Motivación general */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Motivación general
              </label>
              <textarea
                {...register("motivation_general")}
                rows={3}
                placeholder="Describe en sus propias palabras por qué viene a consulta…"
                className="w-full rounded border border-gray-200 px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 3: Familia ── */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <SectionTitle>Sistema Familiar</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Num hijos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Número de hijos
              </label>
              <input
                type="number"
                min={0}
                {...register("num_children")}
                className={inputClass()}
                disabled={isSubmitting}
              />
            </div>

            {/* Num hermanos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Número de hermanos
              </label>
              <input
                type="number"
                min={0}
                {...register("num_siblings")}
                className={inputClass()}
                disabled={isSubmitting}
              />
            </div>

            {/* Orden de nacimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Orden de nacimiento
              </label>
              <input
                type="number"
                min={1}
                {...register("birth_order")}
                placeholder="1, 2, 3…"
                className={inputClass()}
                disabled={isSubmitting}
              />
            </div>

            {/* Abortos en sistema familiar */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Abortos en sistema familiar
              </label>
              <textarea
                {...register("family_abortions")}
                rows={2}
                placeholder="Descripción si aplica…"
                className="w-full rounded border border-gray-200 px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>

            {/* Fallecimientos antes de 41 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Fallecimientos antes de los 41 años en la familia
              </label>
              <textarea
                {...register("deaths_before_41")}
                rows={2}
                placeholder="Descripción si aplica…"
                className="w-full rounded border border-gray-200 px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 4: Notas ── */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <SectionTitle>Notas</SectionTitle>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Notas importantes
              </label>
              <textarea
                {...register("important_notes")}
                rows={4}
                placeholder="Observaciones relevantes para las sesiones…"
                className="w-full rounded border border-gray-200 px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 disabled:opacity-50"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Error de envío */}
        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-3 pb-8">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 px-6 rounded bg-terra-700 hover:bg-terra-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Guardando…" : "Guardar paciente"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/clinica/pacientes")}
            disabled={isSubmitting}
            className="h-11 px-6 rounded text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
