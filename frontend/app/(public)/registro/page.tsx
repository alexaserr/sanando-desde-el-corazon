"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import EmotionSelector from "@/components/clinical/EmotionSelector";
import LocationSelector from "@/components/form/LocationSelector";

// ─── Zod Schema ─────────────────────────────────────────────────────────────

const registrationSchema = z.object({
  // Step 1
  full_name: z.string().min(3, "El nombre es obligatorio"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Teléfono obligatorio (mínimo 10 dígitos)"),
  birth_date: z.string().min(1, "Fecha de nacimiento obligatoria"),
  marital_status: z.string().min(1, "Estado civil obligatorio"),
  profession: z.string().min(1, "Profesión obligatoria"),
  profession_other: z.string().optional(),
  // Step 2
  predominant_emotions: z.array(z.string()).min(1, "Selecciona al menos una emoción"),
  motivation_visit: z.array(z.string()).min(1, "Selecciona al menos una motivación"),
  motivation_other: z.string().optional(),
  motivation_general: z.string().min(10, "Describe tu motivación (mínimo 10 caracteres)"),
  // Step 3
  medical_conditions: z.array(z.string()).min(1, "Selecciona al menos una opción"),
  medical_conditions_other: z.string().optional(),
  recurring_diseases: z.array(z.string()).min(1, "Selecciona al menos una opción"),
  recurring_diseases_other: z.string().optional(),
  // Step 4
  birth_country: z.string().min(1, "País de nacimiento obligatorio"),
  birth_state: z.string().min(1, "Estado/provincia obligatorio"),
  residence_country: z.string().min(1, "País de residencia obligatorio"),
  residence_state: z.string().min(1, "Estado/provincia obligatorio"),
  // Step 5
  family_nuclear: z.string().min(3, "Describe tu familia nuclear"),
  family_nuclear_dynamics: z.string().min(3, "Describe las dinámicas familiares"),
  num_siblings: z.coerce.number().int().min(0, "Obligatorio"),
  birth_order: z.coerce.number().int().min(1, "Obligatorio"),
  family_abortions_detail: z.string().min(1, "Obligatorio"),
  deaths_before_41: z.string().min(1, "Obligatorio"),
  family_current: z.string().min(3, "Describe tu familia actual"),
  family_current_dynamics: z.string().min(3, "Describe las dinámicas"),
  num_children_detail: z.string().min(1, "Obligatorio"),
  // Step 6
  avg_sleep_hours: z.coerce.number().min(0.5, "Mínimo 0.5 horas").max(24, "Máximo 24 horas"),
  sleep_quality: z.enum(["muy_buena", "buena", "regular", "mala", "muy_mala"], {
    required_error: "Selecciona la calidad de sueño",
    invalid_type_error: "Selecciona la calidad de sueño",
  }),
  medications: z.string().min(1, "Obligatorio (escribe 'Ninguno' si no aplica)"),
  body_pains: z.array(z.string()).min(1, "Selecciona al menos una opción"),
  body_pains_other: z.string().optional(),
  important_notes: z.string().optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar para continuar" }),
  }),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

// ─── Constants ──────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Datos personales" },
  { number: 2, label: "Emociones" },
  { number: 3, label: "Salud" },
  { number: 4, label: "Ubicación" },
  { number: 5, label: "Familia" },
  { number: 6, label: "Sueño y notas" },
];

const FIELDS_BY_STEP: Record<number, (keyof RegistrationForm)[]> = {
  1: ["full_name", "email", "phone", "birth_date", "marital_status", "profession"],
  2: ["predominant_emotions", "motivation_visit", "motivation_general"],
  3: ["medical_conditions", "recurring_diseases"],
  4: ["birth_country", "birth_state", "residence_country", "residence_state"],
  5: ["family_nuclear", "family_nuclear_dynamics", "num_siblings", "birth_order",
      "family_abortions_detail", "deaths_before_41", "family_current",
      "family_current_dynamics", "num_children_detail"],
  6: ["avg_sleep_hours", "sleep_quality", "medications", "body_pains", "consent"],
};

const MARITAL_OPTIONS = [
  { value: "soltero", label: "Soltero/a" },
  { value: "casado", label: "Casado/a" },
  { value: "divorciado", label: "Divorciado/a" },
  { value: "viudo", label: "Viudo/a" },
  { value: "union_libre", label: "Unión libre" },
];

const PROFESSION_OPTIONS = [
  "Abogada/o","Administración","Agente de Seguros","Ama de Casa",
  "Arquitectura y Diseño","Chef","Consultoría","Contaduría","Diseñador(a)",
  "Doctor(a)","Emprendedor(a)","Empresaria/o","Enfermera/o","Estudiante",
  "Función Pública","Hogar","Ingeniería","Jubilada/o","Marketing y Comunicación",
  "Pensionada/o","Psicóloga/o","Psicoterapeuta","Restaurantera/o",
  "Sector belleza","Sector salud","Terapeuta","Ventas","Otro",
];

const MOTIVATION_OPTIONS = [
  "Cortar pensamientos limitantes","Crecimiento personal","Disolver trauma",
  "Encontrar más oportunidades personales","Estabilidad familiar",
  "Mejorar estado de ánimo","Mejorar salud emocional","Mejorar salud física",
  "Poder tomar decisiones","Reconectar consigo mismo","Otro",
];

const CONDITIONS_OPTIONS = [
  "Adenomiosis","Anemia","Angina de pecho","Artritis","Artrosis","Asma",
  "Bipolaridad","Bursitis","Cáncer","Cataratas","Cirrosis hepática","Colitis",
  "Contracturas crónicas","Dermatitis","Desgaste de cartílago","Diabetes",
  "Dislexia","Divertículos","Ehlers Danlos","Endometriosis","EPOC","Epilepsia",
  "Escoliosis","Fibromialgia","Fibroadenoma","Fibrosis","Gastritis",
  "Hernia discal","Hígado graso","Hipertensión","Hipertiroidismo",
  "Hipotiroidismo","Inflamación sacroilíaca","Insuficiencia cardíaca","Lupus",
  "Migraña crónica","Neuropatía","Osteoporosis","Ovario poliquístico",
  "Parkinson","Prótesis articular","Psoriasis","Resistencia a la insulina",
  "Rosácea","Sarcopenia","Síndrome de intestino irritable","Tabaquismo",
  "TDAH","TEA","TLP","TOC","Trastorno de ansiedad generalizada",
  "Trastorno depresivo mayor","Venas varicosas","Vitíligo",
  "No aplica","Otro",
];

const RECURRING_OPTIONS = [
  "Gripa / dolor de garganta","Malestar estomacal","Cuerpo cortado","Gases",
  "Hinchazón","Dolor de cabeza / migraña","Dolor de articulaciones",
  "Dolor de huesos","Dolor de músculos","Fatiga","Cansancio extremo",
  "Cólicos","Náuseas constantes","Diarrea","Colitis crónica","Gastritis",
  "No aplica","Otro",
];

const PAINS_OPTIONS = [
  "Ojos","Espalda","Pies","Manos","Espalda baja","Brazo derecho",
  "Brazo izquierdo","Pierna derecha","Pierna izquierda","Ciática",
  "Estómago","Cabeza","Espalda alta","Rodillas","Hombros","Caderas",
  "Dientes","No aplica","Otro",
];

const SLEEP_QUALITY_OPTIONS = [
  { value: "muy_buena", label: "Muy buena" },
  { value: "buena", label: "Buena" },
  { value: "regular", label: "Regular" },
  { value: "mala", label: "Mala" },
  { value: "muy_mala", label: "Muy mala" },
] as const;

const STORAGE_KEY = "sdc_registro_draft";

// ─── Styles ─────────────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-2 py-2 text-sm text-[#2C2220] rounded-none placeholder:text-[#A9967E] focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors";

const TEXTAREA_CLS =
  "w-full resize-none rounded-md border border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm text-[#2C2220] placeholder:text-[#A9967E] focus:border-[#C4704A] focus:outline-none focus:ring-1 focus:ring-[#C4704A]/30 transition-colors";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** "No aplica" exclusive toggle logic for multi-select arrays */
function toggleExclusive(
  current: string[],
  option: string,
  exclusiveLabel: string,
): string[] {
  if (option === exclusiveLabel) {
    // Selecting "No aplica" clears everything else
    return current.includes(exclusiveLabel) ? [] : [exclusiveLabel];
  }
  // Selecting anything else removes "No aplica"
  const without = current.filter((o) => o !== exclusiveLabel);
  return without.includes(option)
    ? without.filter((o) => o !== option)
    : [...without, option];
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children, required }: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs uppercase tracking-[0.1em] font-bold text-[#4A3628]"
      style={{ fontFamily: "Lato, sans-serif" }}
    >
      {children}
      {required && <span className="ml-0.5 text-[#C4704A]">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function CheckboxGroup({
  name,
  options,
  selected,
  onToggle,
  otherValue,
  onOtherChange,
  error,
}: {
  name: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  otherValue?: string;
  onOtherChange?: (value: string) => void;
  error?: string;
}) {
  const otherSelected = selected.includes("Otro");
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const id = `${name}-${opt}`;
          const checked = selected.includes(opt);
          const isOther = opt === "Otro";
          return (
            <div key={opt} className={isOther ? "sm:col-span-2" : ""}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 text-sm text-[#4A3628]"
                style={{ fontFamily: "Lato, sans-serif" }}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt)}
                  className="h-4 w-4 rounded border-[#D4A592]"
                  style={{ accentColor: "#C4704A" }}
                />
                <span className="whitespace-nowrap">{opt}</span>
              </label>
              {isOther && otherSelected && onOtherChange && (
                <input
                  type="text"
                  value={otherValue ?? ""}
                  onChange={(e) => onOtherChange(e.target.value)}
                  placeholder="Especifica..."
                  className={`${INPUT_CLS} mt-1`}
                />
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <>
      {/* Desktop stepper */}
      <div className="hidden sm:flex items-center justify-center mb-8">
        {STEPS.map((step, idx) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const isFuture = currentStep < step.number;
          return (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                    isCompleted
                      ? "border-[#C4704A] bg-[#C4704A] text-white"
                      : isCurrent
                        ? "border-[#C4704A] bg-[#FAF7F5] text-[#C4704A]"
                        : "border-[#D4A592] bg-[#FAF7F5] text-[#D4A592]"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`mt-1 text-[11px] whitespace-nowrap ${
                    isFuture ? "text-[#D4A592]" : "text-[#4A3628]"
                  }`}
                  style={{ fontFamily: "Lato, sans-serif" }}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-8 ${
                    currentStep > step.number
                      ? "bg-[#C4704A]"
                      : "border-t-2 border-dashed border-[#D4A592]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Mobile stepper */}
      <div className="sm:hidden mb-6 text-center">
        <p
          className="text-sm text-[#4A3628]"
          style={{ fontFamily: "Lato, sans-serif" }}
        >
          Paso {currentStep} de {STEPS.length} &mdash;{" "}
          {STEPS[currentStep - 1].label}
        </p>
      </div>
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RegistroPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      birth_date: "",
      marital_status: "",
      profession: "",
      profession_other: "",
      predominant_emotions: [],
      motivation_visit: [],
      motivation_other: "",
      motivation_general: "",
      medical_conditions: [],
      medical_conditions_other: "",
      recurring_diseases: [],
      recurring_diseases_other: "",
      birth_country: "",
      birth_state: "",
      residence_country: "",
      residence_state: "",
      family_nuclear: "",
      family_nuclear_dynamics: "",
      num_siblings: undefined as unknown as number,
      birth_order: undefined as unknown as number,
      family_abortions_detail: "",
      deaths_before_41: "",
      family_current: "",
      family_current_dynamics: "",
      num_children_detail: "",
      avg_sleep_hours: undefined as unknown as number,
      sleep_quality: undefined as unknown as "muy_buena",
      medications: "",
      body_pains: [],
      body_pains_other: "",
      important_notes: "",
      consent: undefined as unknown as true,
    },
    mode: "onTouched",
  });

  // Watch values for controlled fields
  const professionValue = watch("profession");
  const motivationVisit = watch("motivation_visit");
  const motivationOther = watch("motivation_other");
  const medicalConditions = watch("medical_conditions");
  const medicalConditionsOther = watch("medical_conditions_other");
  const recurringDiseases = watch("recurring_diseases");
  const recurringDiseasesOther = watch("recurring_diseases_other");
  const bodyPains = watch("body_pains");
  const bodyPainsOther = watch("body_pains_other");
  const predominantEmotions = watch("predominant_emotions");
  const birthCountry = watch("birth_country");
  const birthState = watch("birth_state");
  const residenceCountry = watch("residence_country");
  const residenceState = watch("residence_state");
  const sleepQuality = watch("sleep_quality");

  // ── Dynamic children ──
  const [childCount, setChildCount] = useState(0);
  const [childrenList, setChildrenList] = useState<{name: string; age: string; gender: string}[]>([]);

  useEffect(() => {
    if (childCount === 0) {
      setValue("num_children_detail", "Ninguno");
      setChildrenList([]);
    } else {
      setChildrenList((prev) => {
        const arr = [...prev];
        while (arr.length < childCount) arr.push({ name: "", age: "", gender: "" });
        return arr.slice(0, childCount);
      });
    }
  }, [childCount, setValue]);

  useEffect(() => {
    if (childrenList.length > 0) {
      const desc = childrenList
        .map((c, i) => {
          const parts = [
            c.name || `Hijo/a ${i + 1}`,
            c.age ? `${c.age} años` : "",
            c.gender,
          ].filter(Boolean);
          return parts.join(", ");
        })
        .join("; ");
      setValue("num_children_detail", `${childrenList.length} hijo(s): ${desc}`);
    }
  }, [childrenList, setValue]);

  const updateChild = useCallback(
    (index: number, field: "name" | "age" | "gender", value: string) => {
      setChildrenList((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  // ── Auto-save to sessionStorage ──
  useEffect(() => {
    const subscription = watch((data) => {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ data, currentStep, savedAt: new Date().toISOString() }),
        );
      } catch { /* storage full */ }
    });
    return () => subscription.unsubscribe();
  }, [watch, currentStep]);

  // ── Restore draft on mount ──
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          data: Partial<RegistrationForm>;
          currentStep: number;
          savedAt: string;
        };
        const hours =
          (Date.now() - new Date(parsed.savedAt).getTime()) / 3600000;
        if (hours < 24) {
          reset(parsed.data as RegistrationForm);
          setCurrentStep(parsed.currentStep);
          setHasDraft(true);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step navigation ──
  const handleNext = async () => {
    const fields = FIELDS_BY_STEP[currentStep];
    const isValid = await trigger(fields);
    if (isValid) setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // ── Submit ──
  const onSubmit = async (formData: RegistrationForm) => {
    setSubmitting(true);
    setServerError(null);

    const resolveOther = (list: string[], otherText?: string): string[] => {
      const base = list.filter((o) => o !== "Otro");
      const extra = otherText?.trim();
      return list.includes("Otro") && extra ? [...base, `Otro: ${extra}`] : base;
    };

    const payload: Record<string, unknown> = {
      full_name: formData.full_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      birth_date: formData.birth_date || null,
      marital_status: formData.marital_status || null,
      birth_place: `${formData.birth_state}, ${formData.birth_country}`,
      residence_place: `${formData.residence_state}, ${formData.residence_country}`,
      profession:
        formData.profession === "Otro"
          ? formData.profession_other?.trim() || "Otro"
          : formData.profession,
      num_children: null,
      num_siblings: formData.num_siblings,
      birth_order: formData.birth_order,
      family_abortions: null,
      family_abortions_detail: formData.family_abortions_detail,
      deaths_before_41: formData.deaths_before_41.trim() || null,
      predominant_emotions: formData.predominant_emotions,
      motivation_visit: resolveOther(formData.motivation_visit, formData.motivation_other),
      motivation_general: formData.motivation_general.trim() || null,
      medical_conditions: resolveOther(formData.medical_conditions, formData.medical_conditions_other),
      recurring_diseases: resolveOther(formData.recurring_diseases, formData.recurring_diseases_other),
      medications: formData.medications.trim() || null,
      body_pains: resolveOther(formData.body_pains, formData.body_pains_other),
      avg_sleep_hours: formData.avg_sleep_hours,
      sleep_quality: formData.sleep_quality,
      family_nuclear: formData.family_nuclear,
      family_nuclear_dynamics: formData.family_nuclear_dynamics,
      family_current: formData.family_current,
      family_current_dynamics: formData.family_current_dynamics,
      num_children_detail: formData.num_children_detail,
      important_notes: formData.important_notes?.trim() || null,
    };

    try {
      const res = await fetch("/api/v1/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 429) {
          setServerError(
            "Has excedido el límite de intentos. Espera unos minutos e intenta de nuevo.",
          );
          return;
        }
        let detail = `Error ${res.status}`;
        try {
          const body = (await res.json()) as { detail?: string };
          if (typeof body.detail === "string") detail = body.detail;
        } catch { /* no JSON */ }
        throw new Error(detail);
      }

      sessionStorage.removeItem(STORAGE_KEY);
      setSuccess(true);
    } catch (err) {
      if (!serverError) {
        setServerError(
          err instanceof Error ? err.message : "Error al enviar el registro. Intenta de nuevo.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success view ──
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F5] px-4">
        <div className="w-full max-w-lg rounded-lg bg-[#FAF7F5] p-8 text-center shadow-[0_2px_8px_rgba(44,34,32,0.06)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9]">
            <Check className="h-8 w-8 text-[#4CAF50]" />
          </div>
          <h2
            className="mb-2 text-2xl text-[#4A3628]"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            ¡Registro exitoso!
          </h2>
          <p
            className="text-sm text-[#6B5E54]"
            style={{ fontFamily: "Lato, sans-serif" }}
          >
            Tu terapeuta revisará tus datos antes de tu primera sesión.
          </p>
        </div>
      </div>
    );
  }

  // ── Form view ──
  return (
    <div className="min-h-screen bg-[#FAF7F5] px-4 py-8">
      <div className="mx-auto w-full max-w-[640px]">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/logo_SDC.svg"
            alt="Sanando desde el Corazón"
            className="h-24 w-auto"
          />
        </div>

        {/* Header */}
        <div className="mb-6 text-center">
          <h1
            className="text-3xl text-[#4A3628]"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Sanando desde el Corazón
          </h1>
          <p
            className="mt-1 text-sm text-[#6B5E54]"
            style={{ fontFamily: "Lato, sans-serif" }}
          >
            Formulario de Registro
          </p>
        </div>

        {/* Draft restore banner */}
        {hasDraft && (
          <div className="bg-[#F2E8E4] border border-[#D4A592] rounded-lg p-3 mb-4 flex items-center justify-between">
            <p className="text-sm text-[#4A3628]">
              Recuperamos tu formulario anterior. Puedes continuar donde te
              quedaste.
            </p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(STORAGE_KEY);
                reset();
                setCurrentStep(1);
                setHasDraft(false);
              }}
              className="text-sm text-[#C4704A] underline ml-4 whitespace-nowrap"
            >
              Empezar de nuevo
            </button>
          </div>
        )}

        {/* Stepper */}
        <Stepper currentStep={currentStep} />

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {/* ═══════ Step 1: Datos personales ═══════ */}
          {currentStep === 1 && (
            <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-5 space-y-5">
              <h2
                className="text-lg text-[#2C2220] font-semibold"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Datos Personales
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Full name */}
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="full_name" required>
                    Nombre completo
                  </FieldLabel>
                  <input
                    id="full_name"
                    type="text"
                    className={INPUT_CLS}
                    placeholder="Nombre y apellidos"
                    {...register("full_name")}
                  />
                  <FieldError message={errors.full_name?.message} />
                </div>
                {/* Email */}
                <div>
                  <FieldLabel htmlFor="email" required>
                    Email
                  </FieldLabel>
                  <input
                    id="email"
                    type="email"
                    className={INPUT_CLS}
                    placeholder="correo@ejemplo.com"
                    {...register("email")}
                  />
                  <FieldError message={errors.email?.message} />
                </div>
                {/* Phone */}
                <div>
                  <FieldLabel htmlFor="phone" required>
                    Teléfono
                  </FieldLabel>
                  <input
                    id="phone"
                    type="tel"
                    className={INPUT_CLS}
                    placeholder="+52 55 1234 5678"
                    {...register("phone")}
                  />
                  <FieldError message={errors.phone?.message} />
                </div>
                {/* Birth date */}
                <div>
                  <FieldLabel htmlFor="birth_date" required>
                    Fecha de nacimiento
                  </FieldLabel>
                  <input
                    id="birth_date"
                    type="date"
                    className={INPUT_CLS}
                    {...register("birth_date")}
                  />
                  <FieldError message={errors.birth_date?.message} />
                </div>
                {/* Marital status */}
                <div>
                  <FieldLabel htmlFor="marital_status" required>
                    Estado civil
                  </FieldLabel>
                  <select
                    id="marital_status"
                    className={INPUT_CLS}
                    {...register("marital_status")}
                  >
                    <option value="">Seleccionar...</option>
                    {MARITAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.marital_status?.message} />
                </div>
                {/* Profession */}
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="profession" required>
                    Profesión
                  </FieldLabel>
                  <select
                    id="profession"
                    className={INPUT_CLS}
                    {...register("profession")}
                  >
                    <option value="">Seleccionar...</option>
                    {PROFESSION_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {professionValue === "Otro" && (
                    <input
                      type="text"
                      className={`${INPUT_CLS} mt-2`}
                      placeholder="Especifica tu profesión..."
                      {...register("profession_other")}
                    />
                  )}
                  <FieldError message={errors.profession?.message} />
                </div>
              </div>
            </div>
          )}

          {/* ═══════ Step 2: Emociones ═══════ */}
          {currentStep === 2 && (
            <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-5 space-y-5">
              <h2
                className="text-lg text-[#2C2220] font-semibold"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Emociones y Motivación
              </h2>
              {/* Predominant emotions */}
              <div>
                <FieldLabel htmlFor="emotions" required>
                  Emociones predominantes
                </FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <EmotionSelector
                    selected={predominantEmotions}
                    onChange={(v) => setValue("predominant_emotions", v, { shouldValidate: true })}
                    placeholder="Seleccionar emociones..."
                  />
                </div>
                <FieldError message={errors.predominant_emotions?.message} />
              </div>
              {/* Motivation visit - multi-select */}
              <div>
                <FieldLabel htmlFor="motivation_visit" required>
                  ¿Qué te motivó a buscar ayuda?
                </FieldLabel>
                <p className="mb-2 text-xs text-[#6B5E54]">
                  Selecciona todas las que apliquen
                </p>
                <CheckboxGroup
                  name="motivation_visit"
                  options={MOTIVATION_OPTIONS}
                  selected={motivationVisit}
                  onToggle={(opt) => {
                    const current = motivationVisit;
                    const next = current.includes(opt)
                      ? current.filter((o) => o !== opt)
                      : [...current, opt];
                    setValue("motivation_visit", next, { shouldValidate: true });
                  }}
                  otherValue={motivationOther}
                  onOtherChange={(v) => setValue("motivation_other", v)}
                  error={errors.motivation_visit?.message}
                />
              </div>
              {/* Motivation general */}
              <div>
                <FieldLabel htmlFor="motivation_general" required>
                  ¿Qué esperas lograr?
                </FieldLabel>
                <textarea
                  id="motivation_general"
                  rows={3}
                  className={TEXTAREA_CLS}
                  placeholder="Describe tus expectativas..."
                  {...register("motivation_general")}
                />
                <FieldError message={errors.motivation_general?.message} />
              </div>
            </div>
          )}

          {/* ═══════ Step 3: Salud ═══════ */}
          {currentStep === 3 && (
            <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-5 space-y-6">
              <h2
                className="text-lg text-[#2C2220] font-semibold"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Salud
              </h2>
              {/* Medical conditions */}
              <div>
                <FieldLabel htmlFor="conditions" required>
                  Problemas médicos diagnosticados
                </FieldLabel>
                <p className="mb-2 text-xs text-[#6B5E54]">
                  Selecciona todas las opciones que apliquen
                </p>
                <CheckboxGroup
                  name="conditions"
                  options={CONDITIONS_OPTIONS}
                  selected={medicalConditions}
                  onToggle={(opt) => {
                    const next = toggleExclusive(medicalConditions, opt, "No aplica");
                    setValue("medical_conditions", next, { shouldValidate: true });
                  }}
                  otherValue={medicalConditionsOther}
                  onOtherChange={(v) => setValue("medical_conditions_other", v)}
                  error={errors.medical_conditions?.message}
                />
              </div>
              {/* Recurring diseases */}
              <div>
                <FieldLabel htmlFor="recurring" required>
                  Enfermedades médicas recurrentes
                </FieldLabel>
                <p className="mb-2 text-xs text-[#6B5E54]">
                  Selecciona si tienes dolor o molestia constante
                </p>
                <CheckboxGroup
                  name="recurring"
                  options={RECURRING_OPTIONS}
                  selected={recurringDiseases}
                  onToggle={(opt) => {
                    const next = toggleExclusive(recurringDiseases, opt, "No aplica");
                    setValue("recurring_diseases", next, { shouldValidate: true });
                  }}
                  otherValue={recurringDiseasesOther}
                  onOtherChange={(v) => setValue("recurring_diseases_other", v)}
                  error={errors.recurring_diseases?.message}
                />
              </div>
            </div>
          )}

          {/* ═══════ Step 4: Ubicación ═══════ */}
          {currentStep === 4 && (
            <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-5 space-y-5">
              <h2
                className="text-lg text-[#2C2220] font-semibold"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Ubicación
              </h2>
              {/* Birth place */}
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.1em] font-bold text-[#4A3628]">
                  Lugar de nacimiento
                </p>
                <LocationSelector
                  countryValue={birthCountry}
                  stateValue={birthState}
                  onCountryChange={(v) => setValue("birth_country", v, { shouldValidate: true })}
                  onStateChange={(v) => setValue("birth_state", v, { shouldValidate: true })}
                  countryId="birth_country"
                  stateId="birth_state"
                  countryLabel="País"
                  stateLabel="Estado / Provincia"
                  countryError={errors.birth_country?.message}
                  stateError={errors.birth_state?.message}
                />
              </div>
              {/* Residence */}
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.1em] font-bold text-[#4A3628]">
                  Lugar de residencia
                </p>
                <LocationSelector
                  countryValue={residenceCountry}
                  stateValue={residenceState}
                  onCountryChange={(v) => setValue("residence_country", v, { shouldValidate: true })}
                  onStateChange={(v) => setValue("residence_state", v, { shouldValidate: true })}
                  countryId="residence_country"
                  stateId="residence_state"
                  countryLabel="País"
                  stateLabel="Estado / Provincia"
                  countryError={errors.residence_country?.message}
                  stateError={errors.residence_state?.message}
                />
              </div>
            </div>
          )}

          {/* ═══════ Step 5: Familia ═══════ */}
          {currentStep === 5 && (
            <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-5 space-y-5">
              <h2
                className="text-lg text-[#2C2220] font-semibold"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Familia
              </h2>
              {/* Family nuclear */}
              <div>
                <FieldLabel htmlFor="family_nuclear" required>
                  Describe tu familia nuclear (padres, hermanos)
                </FieldLabel>
                <textarea
                  id="family_nuclear"
                  rows={3}
                  className={TEXTAREA_CLS}
                  placeholder="Describe a tu familia de origen..."
                  {...register("family_nuclear")}
                />
                <FieldError message={errors.family_nuclear?.message} />
              </div>
              <div>
                <FieldLabel htmlFor="family_nuclear_dynamics" required>
                  Dinámicas familiares nucleares
                </FieldLabel>
                <textarea
                  id="family_nuclear_dynamics"
                  rows={3}
                  className={TEXTAREA_CLS}
                  placeholder="¿Cómo es la relación entre los miembros de tu familia?"
                  {...register("family_nuclear_dynamics")}
                />
                <FieldError message={errors.family_nuclear_dynamics?.message} />
              </div>
              {/* Siblings / Birth order */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="num_siblings" required>
                    Número de hermanos
                  </FieldLabel>
                  <input
                    id="num_siblings"
                    type="number"
                    min={0}
                    className={INPUT_CLS}
                    placeholder="0"
                    {...register("num_siblings")}
                  />
                  <FieldError message={errors.num_siblings?.message} />
                </div>
                <div>
                  <FieldLabel htmlFor="birth_order" required>
                    Lugar entre hermanos
                  </FieldLabel>
                  <input
                    id="birth_order"
                    type="number"
                    min={1}
                    className={INPUT_CLS}
                    placeholder="1"
                    {...register("birth_order")}
                  />
                  <FieldError message={errors.birth_order?.message} />
                </div>
              </div>
              {/* Family abortions */}
              <div>
                <FieldLabel htmlFor="family_abortions_detail" required>
                  Abortos en la familia
                </FieldLabel>
                <textarea
                  id="family_abortions_detail"
                  rows={2}
                  className={TEXTAREA_CLS}
                  placeholder="Describe si aplica, o escribe 'No aplica'"
                  {...register("family_abortions_detail")}
                />
                <FieldError message={errors.family_abortions_detail?.message} />
              </div>
              {/* Deaths before 41 */}
              <div>
                <FieldLabel htmlFor="deaths_before_41" required>
                  Fallecimientos antes de los 41 años
                </FieldLabel>
                <textarea
                  id="deaths_before_41"
                  rows={2}
                  className={TEXTAREA_CLS}
                  placeholder="Describe si aplica, o escribe 'No aplica'"
                  {...register("deaths_before_41")}
                />
                <FieldError message={errors.deaths_before_41?.message} />
              </div>

              {/* ── Familia actual ── */}
              <div className="border-t border-[#D4A592] pt-5 mt-2">
                <h3
                  className="text-base text-[#2C2220] font-semibold mb-4"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  Familia Actual
                </h3>
              </div>
              <div>
                <FieldLabel htmlFor="family_current" required>
                  Describe tu familia actual
                </FieldLabel>
                <textarea
                  id="family_current"
                  rows={3}
                  className={TEXTAREA_CLS}
                  placeholder="Pareja, hijos, con quién vives..."
                  {...register("family_current")}
                />
                <FieldError message={errors.family_current?.message} />
              </div>
              <div>
                <FieldLabel htmlFor="family_current_dynamics" required>
                  Dinámicas familiares actuales
                </FieldLabel>
                <textarea
                  id="family_current_dynamics"
                  rows={3}
                  className={TEXTAREA_CLS}
                  placeholder="¿Cómo es la relación con tu familia actual?"
                  {...register("family_current_dynamics")}
                />
                <FieldError message={errors.family_current_dynamics?.message} />
              </div>
              {/* Dynamic children */}
              <div>
                <FieldLabel htmlFor="child_count" required>
                  ¿Cuántos hijos tienes?
                </FieldLabel>
                <input
                  id="child_count"
                  type="number"
                  min={0}
                  max={30}
                  className={INPUT_CLS}
                  placeholder="0"
                  value={childCount}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(30, parseInt(e.target.value) || 0));
                    setChildCount(n);
                  }}
                />
              </div>
              {childCount > 0 && (
                <div className="space-y-3">
                  {childrenList.map((child, i) => (
                    <div key={i} className="grid gap-3 sm:grid-cols-3 rounded-md border border-[#D4A592]/40 p-3">
                      <div>
                        <label className="mb-1 block text-xs text-[#4A3628]">Nombre</label>
                        <input
                          type="text"
                          className={INPUT_CLS}
                          placeholder={`Hijo/a ${i + 1}`}
                          value={child.name}
                          onChange={(e) => updateChild(i, "name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[#4A3628]">Edad</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className={INPUT_CLS}
                          placeholder="0"
                          value={child.age}
                          onChange={(e) => updateChild(i, "age", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[#4A3628]">Género</label>
                        <select
                          className={INPUT_CLS}
                          value={child.gender}
                          onChange={(e) => updateChild(i, "gender", e.target.value)}
                        >
                          <option value="">Seleccionar...</option>
                          <option value="M">Masculino</option>
                          <option value="F">Femenino</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <FieldError message={errors.num_children_detail?.message} />
            </div>
          )}

          {/* ═══════ Step 6: Salud y notas ═══════ */}
          {currentStep === 6 && (
            <div className="rounded-lg bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-5 space-y-5">
              <h2
                className="text-lg text-[#2C2220] font-semibold"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Sueño y Notas
              </h2>
              {/* Sleep hours */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="avg_sleep_hours" required>
                    Horas de sueño promedio
                  </FieldLabel>
                  <input
                    id="avg_sleep_hours"
                    type="number"
                    min={0.5}
                    max={24}
                    step={0.5}
                    className={INPUT_CLS}
                    placeholder="7"
                    {...register("avg_sleep_hours")}
                  />
                  <FieldError message={errors.avg_sleep_hours?.message} />
                </div>
                {/* Sleep quality - radio buttons */}
                <div>
                  <FieldLabel htmlFor="sleep_quality" required>
                    Calidad de sueño
                  </FieldLabel>
                  <div className="space-y-2 mt-1">
                    {SLEEP_QUALITY_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 cursor-pointer text-sm text-[#4A3628]"
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          checked={sleepQuality === opt.value}
                          onChange={() =>
                            setValue("sleep_quality", opt.value, { shouldValidate: true })
                          }
                          className="h-4 w-4 border-[#D4A592]"
                          style={{ accentColor: "#C4704A" }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  <FieldError message={errors.sleep_quality?.message} />
                </div>
              </div>
              {/* Medications */}
              <div>
                <FieldLabel htmlFor="medications" required>
                  Medicamentos
                </FieldLabel>
                <p className="mb-2 text-xs text-[#6B5E54]">
                  Escribe los medicamentos que tomas, o &quot;Ninguno&quot;
                </p>
                <textarea
                  id="medications"
                  rows={2}
                  className={TEXTAREA_CLS}
                  placeholder="Metformina, Losartan, ..."
                  {...register("medications")}
                />
                <FieldError message={errors.medications?.message} />
              </div>
              {/* Body pains */}
              <div>
                <FieldLabel htmlFor="pains" required>
                  Dolor en cuerpo
                </FieldLabel>
                <p className="mb-2 text-xs text-[#6B5E54]">
                  Selecciona en qué partes sientes dolor o molestia
                </p>
                <CheckboxGroup
                  name="body_pains"
                  options={PAINS_OPTIONS}
                  selected={bodyPains}
                  onToggle={(opt) => {
                    const next = toggleExclusive(bodyPains, opt, "No aplica");
                    setValue("body_pains", next, { shouldValidate: true });
                  }}
                  otherValue={bodyPainsOther}
                  onOtherChange={(v) => setValue("body_pains_other", v)}
                  error={errors.body_pains?.message}
                />
              </div>
              {/* Important notes */}
              <div>
                <FieldLabel htmlFor="important_notes">
                  Notas importantes (opcional)
                </FieldLabel>
                <textarea
                  id="important_notes"
                  rows={3}
                  className={TEXTAREA_CLS}
                  placeholder="Algo más que quieras compartir..."
                  {...register("important_notes")}
                />
              </div>

              {/* Consent */}
              <div className="space-y-4 border-t border-[#D4A592] pt-6 mt-6">
                <h3
                  className="font-semibold text-lg text-[#2C2220]"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  Consentimiento Informado
                </h3>
                <p className="text-sm text-[#4A3628] leading-relaxed">
                  Al enviar este formulario, confirmo que he leído y acepto el{" "}
                  <a
                    href="https://www.sana-desde-el-corazon.com/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#C4704A] underline hover:text-[#4A3628] transition-colors"
                  >
                    Aviso de Privacidad
                  </a>{" "}
                  y los{" "}
                  <a
                    href="https://www.sana-desde-el-corazon.com/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#C4704A] underline hover:text-[#4A3628] transition-colors"
                  >
                    Términos de Servicio
                  </a>{" "}
                  de Sanando desde el Corazón. Autorizo el tratamiento de mis
                  datos personales, incluyendo datos sensibles de salud,
                  conforme a la Ley Federal de Protección de Datos Personales en
                  Posesión de los Particulares (LFPDPPP).
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("consent")}
                    className="mt-1 h-5 w-5 rounded border-[#D4A592]"
                    style={{ accentColor: "#C4704A" }}
                  />
                  <span className="text-sm text-[#2C2220] font-medium">
                    Acepto el Aviso de Privacidad y los Términos de Servicio *
                  </span>
                </label>
                <FieldError message={errors.consent?.message} />
              </div>
            </div>
          )}

          {/* ─── Server Error ─── */}
          {serverError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* ─── Navigation Buttons ─── */}
          <div className="flex items-center justify-between gap-4 pt-2">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-md border border-[#D4A592] bg-[#FAF7F5] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#4A3628] transition-colors hover:bg-[#F2E8E4]"
                style={{ fontFamily: "Lato, sans-serif" }}
              >
                Anterior
              </button>
            ) : (
              <div />
            )}

            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-md bg-[#C4704A] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#A85C3A]"
                style={{ fontFamily: "Lato, sans-serif" }}
              >
                Siguiente
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-[#C4704A] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#A85C3A] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ fontFamily: "Lato, sans-serif" }}
              >
                {submitting ? "Enviando..." : "Enviar Registro"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
