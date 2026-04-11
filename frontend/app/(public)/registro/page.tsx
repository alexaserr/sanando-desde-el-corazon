'use client';

import { FormEvent, useState } from 'react';
import EmotionSelector from '@/components/clinical/EmotionSelector';

// ─── Tipos locales ───────────────────────────────────────────────────────────

type MaritalStatus = 'soltero' | 'casado' | 'divorciado' | 'viudo' | 'union_libre';

interface FormData {
  // Sección 1 — Datos personales
  full_name: string;
  email: string;
  phone: string;
  birth_date: string;
  marital_status: MaritalStatus | '';
  birth_place: string;
  residence_place: string;
  profession: string;
  // Sección 2 — Familia
  num_children: string;
  num_siblings: string;
  birth_order: string;
  family_abortions: string;
  deaths_before_41: string;
  // Sección 3 — Salud
  conditions: string[];
  conditions_other: string;
  recurring: string[];
  recurring_other: string;
  medications: string;
  pains: string[];
  pains_other: string;
  // Sección 4 — Emociones
  predominant_emotions: string[];
  // Sección 5 — Motivación
  motivation_visit: string;
  motivation_general: string;
}

const INITIAL: FormData = {
  full_name: '',
  email: '',
  phone: '',
  birth_date: '',
  marital_status: '',
  birth_place: '',
  residence_place: '',
  profession: '',
  num_children: '',
  num_siblings: '',
  birth_order: '',
  family_abortions: '',
  deaths_before_41: '',
  conditions: [],
  conditions_other: '',
  recurring: [],
  recurring_other: '',
  medications: '',
  pains: [],
  pains_other: '',
  predominant_emotions: [],
  motivation_visit: '',
  motivation_general: '',
};

const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: 'soltero', label: 'Soltero/a' },
  { value: 'casado', label: 'Casado/a' },
  { value: 'divorciado', label: 'Divorciado/a' },
  { value: 'viudo', label: 'Viudo/a' },
  { value: 'union_libre', label: 'Unión libre' },
];

// Opciones exactas del formulario original (Notion) — NO modificar
const CONDITIONS_OPTIONS: string[] = [
  'Asma', 'Bipolaridad', 'Cáncer', 'Diabetes', 'Dislexia', 'Ehlers Danlos',
  'Hipertensión', 'Hipotiroidismo', 'TDAH', 'TEA', 'Ovario poliquístico',
  'Epilepsia', 'Insuficiencia cardiaca', 'Angina de pecho', 'Artritis',
  'Artrosis', 'Osteoporosis', 'Fibromialgia', 'Sarcopenia', 'Dermatitis',
  'TOC', 'EPOC', 'Herpes', 'VIH', 'Otro', 'No tengo ninguna enfermedad',
];

const RECURRING_OPTIONS: string[] = [
  'Gripa / dolor de garganta', 'Malestar estomacal', 'Cuerpo cortado', 'Gases',
  'Hinchazón', 'Dolor de cabeza / migraña', 'Dolor de articulaciones',
  'Dolor de huesos', 'Dolor de músculos', 'Fatiga', 'Cansancio extremo',
  'Cólicos', 'Náuseas constantes', 'Diarrea', 'Colitis crónica', 'Gastritis',
  'N/A', 'Otro',
];

const PAINS_OPTIONS: string[] = [
  'Ojos', 'Espalda', 'Pies', 'Manos', 'Espalda baja', 'Brazo derecho',
  'Brazo izquierdo', 'Pierna derecha', 'Pierna izquierda', 'Ciática',
  'Estómago', 'Cabeza', 'Espalda alta', 'Rodillas', 'Hombros', 'Caderas',
  'Dientes', 'Otro', 'No siento dolor o molestia en mi cuerpo.',
];

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function SectionHeader({ title, step }: { title: string; step: number }) {
  return (
    <h2
      className="mb-4 flex items-center gap-2 text-lg text-[#4A3628]"
      style={{ fontFamily: 'var(--font-playfair), Playfair Display, serif' }}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C4704A] text-xs font-bold text-white">
        {step}
      </span>
      {title}
    </h2>
  );
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs uppercase tracking-wide text-[#4A3628]"
      style={{ fontFamily: 'var(--font-lato), Lato, sans-serif', fontWeight: 700 }}
    >
      {children}
      {required && <span className="ml-0.5 text-[#C4704A]">*</span>}
    </label>
  );
}

const INPUT_CLS =
  'w-full border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-2 py-2 text-sm text-[#2C2220] placeholder:text-[#A9967E] focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors';

const TEXTAREA_CLS =
  'w-full resize-none rounded-md border border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm text-[#2C2220] placeholder:text-[#A9967E] focus:border-[#C4704A] focus:outline-none focus:ring-1 focus:ring-[#C4704A]/30 transition-colors';

function CheckboxGroup({
  name,
  options,
  selected,
  onToggle,
  otherValue,
  onOtherChange,
}: {
  name: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  otherValue: string;
  onOtherChange: (value: string) => void;
}) {
  const otherSelected = selected.includes('Otro');
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      style={{ fontFamily: 'var(--font-lato), Lato, sans-serif' }}
    >
      {options.map((opt) => {
        const id = `${name}-${opt}`;
        const checked = selected.includes(opt);
        const isOther = opt === 'Otro';
        return (
          <div key={opt} className={isOther ? 'sm:col-span-2' : ''}>
            <label
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 text-sm text-[#4A3628]"
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(opt)}
                className="h-4 w-4 rounded border-[#D4A592]"
                style={{ accentColor: '#C4704A' }}
              />
              <span>{opt}</span>
            </label>
            {isOther && otherSelected && (
              <input
                type="text"
                value={otherValue}
                onChange={(e) => onOtherChange(e.target.value)}
                placeholder="Especifica..."
                className={`${INPUT_CLS} mt-1`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function RegistroPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
    5: false,
  });

  function toggleSection(n: number) {
    setOpenSections((prev) => ({ ...prev, [n]: !prev[n] }));
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setStr(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(key, e.target.value as FormData[typeof key]);
  }

  function toggleFromList(key: 'conditions' | 'recurring' | 'pains', option: string) {
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [key]: next };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError('El nombre completo es obligatorio.');
      return;
    }
    if (!form.email.trim()) {
      setError('El correo electrónico es obligatorio.');
      return;
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) {
      setError('El teléfono es obligatorio (mínimo 10 dígitos).');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Medicamentos: una línea por elemento (Tanya lo quiere textarea)
    const toArray = (text: string): string[] =>
      text.split('\n').map((s) => s.trim()).filter(Boolean);

    // Multi-select: reemplazar "Otro" por el texto del input cuando existe
    const resolveOther = (list: string[], otherText: string): string[] => {
      const base = list.filter((o) => o !== 'Otro');
      const extra = otherText.trim();
      return list.includes('Otro') && extra ? [...base, extra] : base;
    };

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      birth_date: form.birth_date || null,
      marital_status: form.marital_status || null,
      birth_place: form.birth_place.trim() || null,
      residence_place: form.residence_place.trim() || null,
      profession: form.profession.trim() || null,
      num_children: form.num_children ? parseInt(form.num_children, 10) : null,
      num_siblings: form.num_siblings ? parseInt(form.num_siblings, 10) : null,
      birth_order: form.birth_order ? parseInt(form.birth_order, 10) : null,
      family_abortions: form.family_abortions ? parseInt(form.family_abortions, 10) : null,
      deaths_before_41: form.deaths_before_41.trim() || null,
      predominant_emotions: form.predominant_emotions.length > 0 ? form.predominant_emotions : [],
      motivation_visit: form.motivation_visit.trim() ? [form.motivation_visit.trim()] : [],
      motivation_general: form.motivation_general.trim() || null,
      medical_conditions: resolveOther(form.conditions, form.conditions_other),
      recurring_diseases: resolveOther(form.recurring, form.recurring_other),
      medications: toArray(form.medications),
      body_pains: resolveOther(form.pains, form.pains_other),
      important_notes: null,
    };

    try {
      const res = await fetch('/api/v1/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let detail = `Error ${res.status}`;
        try {
          const body = (await res.json()) as { detail?: string };
          if (typeof body.detail === 'string') detail = body.detail;
        } catch {
          // no JSON body
        }
        throw new Error(detail);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al enviar el formulario.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Vista de éxito ──
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F5] px-4">
        <div className="w-full max-w-lg rounded-xl bg-white p-8 text-center shadow-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9]">
            <svg className="h-8 w-8 text-[#4CAF50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2
            className="mb-2 text-2xl text-[#4A3628]"
            style={{ fontFamily: 'var(--font-playfair), Playfair Display, serif' }}
          >
            ¡Registro exitoso!
          </h2>
          <p className="text-sm text-[#6B5E54]" style={{ fontFamily: 'var(--font-lato), Lato, sans-serif' }}>
            Tu terapeuta revisará tus datos antes de tu primera sesión.
          </p>
        </div>
      </div>
    );
  }

  // ── Formulario ──
  return (
    <div className="min-h-screen bg-[#FAF7F5] px-4 py-8">
      <div className="mx-auto w-full max-w-[640px]">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo_SDC.svg" alt="Sanando desde el Corazón" className="h-24 w-auto" />
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="text-3xl text-[#4A3628]"
            style={{ fontFamily: 'var(--font-playfair), Playfair Display, serif' }}
          >
            Sanando desde el Corazón
          </h1>
          <p className="mt-1 text-sm text-[#6B5E54]" style={{ fontFamily: 'var(--font-lato), Lato, sans-serif' }}>
            Formulario de Registro
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ─── Sección 1: Datos personales ─── */}
          <AccordionSection
            step={1}
            title="Datos personales"
            open={openSections[1]}
            onToggle={() => toggleSection(1)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="full_name" required>Nombre completo</Label>
                <input
                  id="full_name"
                  type="text"
                  className={INPUT_CLS}
                  value={form.full_name}
                  onChange={setStr('full_name')}
                  placeholder="Nombre y apellidos"
                />
              </div>
              <div>
                <Label htmlFor="email" required>Email</Label>
                <input
                  id="email"
                  type="email"
                  className={INPUT_CLS}
                  value={form.email}
                  onChange={setStr('email')}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="phone" required>Teléfono</Label>
                <input
                  id="phone"
                  type="tel"
                  className={INPUT_CLS}
                  value={form.phone}
                  onChange={setStr('phone')}
                  placeholder="+52 55 1234 5678"
                />
              </div>
              <div>
                <Label htmlFor="birth_date">Fecha de nacimiento</Label>
                <input
                  id="birth_date"
                  type="date"
                  className={INPUT_CLS}
                  value={form.birth_date}
                  onChange={setStr('birth_date')}
                />
              </div>
              <div>
                <Label htmlFor="marital_status">Estado civil</Label>
                <select
                  id="marital_status"
                  className={INPUT_CLS}
                  value={form.marital_status}
                  onChange={setStr('marital_status')}
                >
                  <option value="">Seleccionar...</option>
                  {MARITAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="birth_place">Lugar de nacimiento</Label>
                <input
                  id="birth_place"
                  type="text"
                  className={INPUT_CLS}
                  value={form.birth_place}
                  onChange={setStr('birth_place')}
                />
              </div>
              <div>
                <Label htmlFor="residence_place">Lugar de residencia</Label>
                <input
                  id="residence_place"
                  type="text"
                  className={INPUT_CLS}
                  value={form.residence_place}
                  onChange={setStr('residence_place')}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="profession">Profesión</Label>
                <input
                  id="profession"
                  type="text"
                  className={INPUT_CLS}
                  value={form.profession}
                  onChange={setStr('profession')}
                />
              </div>
            </div>
          </AccordionSection>

          {/* ─── Sección 2: Familia ─── */}
          <AccordionSection
            step={2}
            title="Familia"
            open={openSections[2]}
            onToggle={() => toggleSection(2)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="num_children">Número de hijos</Label>
                <input
                  id="num_children"
                  type="number"
                  min={0}
                  className={INPUT_CLS}
                  value={form.num_children}
                  onChange={setStr('num_children')}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="num_siblings">Número de hermanos</Label>
                <input
                  id="num_siblings"
                  type="number"
                  min={0}
                  className={INPUT_CLS}
                  value={form.num_siblings}
                  onChange={setStr('num_siblings')}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="birth_order">Lugar entre hermanos</Label>
                <input
                  id="birth_order"
                  type="number"
                  min={1}
                  className={INPUT_CLS}
                  value={form.birth_order}
                  onChange={setStr('birth_order')}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="family_abortions">Abortos en la familia</Label>
                <input
                  id="family_abortions"
                  type="number"
                  min={0}
                  className={INPUT_CLS}
                  value={form.family_abortions}
                  onChange={setStr('family_abortions')}
                  placeholder="0"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="deaths_before_41">Muertes antes de los 41 años</Label>
                <textarea
                  id="deaths_before_41"
                  rows={2}
                  className={TEXTAREA_CLS}
                  value={form.deaths_before_41}
                  onChange={setStr('deaths_before_41')}
                  placeholder="Describa si aplica..."
                />
              </div>
            </div>
          </AccordionSection>

          {/* ─── Sección 3: Salud ─── */}
          <AccordionSection
            step={3}
            title="Salud"
            open={openSections[3]}
            onToggle={() => toggleSection(3)}
          >
            <div className="space-y-6">
              <div>
                <Label htmlFor="conditions" required>Problemas médicos diagnosticados</Label>
                <p
                  className="mb-2 text-xs text-[#6B5E54]"
                  style={{ fontFamily: 'var(--font-lato), Lato, sans-serif' }}
                >
                  Selecciona si tienes uno o más problemas médicos diagnosticados.
                  <br />
                  <span className="italic">(Selecciona todas las opciones que quieras)</span>
                </p>
                <CheckboxGroup
                  name="conditions"
                  options={CONDITIONS_OPTIONS}
                  selected={form.conditions}
                  onToggle={(opt) => toggleFromList('conditions', opt)}
                  otherValue={form.conditions_other}
                  onOtherChange={(v) => set('conditions_other', v)}
                />
              </div>

              <div>
                <Label htmlFor="recurring" required>Enfermedades médicas recurrentes</Label>
                <p
                  className="mb-2 text-xs text-[#6B5E54]"
                  style={{ fontFamily: 'var(--font-lato), Lato, sans-serif' }}
                >
                  Selecciona si tienes dolor o molestia constante en estas regiones.
                  <br />
                  <span className="italic">(Selecciona todas las opciones que quieras)</span>
                </p>
                <CheckboxGroup
                  name="recurring"
                  options={RECURRING_OPTIONS}
                  selected={form.recurring}
                  onToggle={(opt) => toggleFromList('recurring', opt)}
                  otherValue={form.recurring_other}
                  onOtherChange={(v) => set('recurring_other', v)}
                />
              </div>

              <div>
                <Label htmlFor="medications" required>Medicamentos</Label>
                <p
                  className="mb-2 text-xs text-[#6B5E54]"
                  style={{ fontFamily: 'var(--font-lato), Lato, sans-serif' }}
                >
                  Escribe separados por comas el nombre de los medicamentos que tomas.
                </p>
                <textarea
                  id="medications"
                  rows={2}
                  className={TEXTAREA_CLS}
                  value={form.medications}
                  onChange={setStr('medications')}
                  placeholder="Metformina, Losartán, ..."
                />
              </div>

              <div>
                <Label htmlFor="pains" required>Dolor en cuerpo</Label>
                <p
                  className="mb-2 text-xs text-[#6B5E54]"
                  style={{ fontFamily: 'var(--font-lato), Lato, sans-serif' }}
                >
                  Selecciona en qué partes sientes dolor o molestia en tu cuerpo.
                  <br />
                  <span className="italic">(Selecciona todas las opciones que quieras)</span>
                </p>
                <CheckboxGroup
                  name="pains"
                  options={PAINS_OPTIONS}
                  selected={form.pains}
                  onToggle={(opt) => toggleFromList('pains', opt)}
                  otherValue={form.pains_other}
                  onOtherChange={(v) => set('pains_other', v)}
                />
              </div>
            </div>
          </AccordionSection>

          {/* ─── Sección 4: Emociones ─── */}
          <AccordionSection
            step={4}
            title="Emociones"
            open={openSections[4]}
            onToggle={() => toggleSection(4)}
          >
            <div>
              <Label htmlFor="emotions">Emociones predominantes</Label>
              <EmotionSelector
                selected={form.predominant_emotions}
                onChange={(v) => set('predominant_emotions', v)}
                placeholder="Seleccionar emociones..."
              />
            </div>
          </AccordionSection>

          {/* ─── Sección 5: Motivación ─── */}
          <AccordionSection
            step={5}
            title="Motivación"
            open={openSections[5]}
            onToggle={() => toggleSection(5)}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="motivation_visit">¿Qué te motivó a buscar ayuda?</Label>
                <textarea
                  id="motivation_visit"
                  rows={3}
                  className={TEXTAREA_CLS}
                  value={form.motivation_visit}
                  onChange={setStr('motivation_visit')}
                  placeholder="Cuéntanos qué te trajo aquí..."
                />
              </div>
              <div>
                <Label htmlFor="motivation_general">¿Qué esperas lograr?</Label>
                <textarea
                  id="motivation_general"
                  rows={3}
                  className={TEXTAREA_CLS}
                  value={form.motivation_general}
                  onChange={setStr('motivation_general')}
                  placeholder="Describe tus expectativas..."
                />
              </div>
            </div>
          </AccordionSection>

          {/* ─── Error ─── */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ─── Submit ─── */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#C4704A] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#A85C3A] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontFamily: 'var(--font-lato), Lato, sans-serif' }}
          >
            {submitting ? 'Enviando...' : 'Enviar Registro'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Componente Accordion ────────────────────────────────────────────────────

function AccordionSection({
  step,
  title,
  open,
  onToggle,
  children,
}: {
  step: number;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#FBF7F5]"
      >
        <SectionHeader title={title} step={step} />
        <svg
          className={`h-5 w-5 shrink-0 text-[#A9967E] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="border-t border-[#EDE5E0] px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}
