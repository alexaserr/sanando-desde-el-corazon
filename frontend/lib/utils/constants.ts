export const CHAKRA_MAX_VALUE = 14;
export const ENERGY_MAX_VALUE = 100;

export const MARITAL_STATUS_OPTIONS = [
  { value: "single", label: "Soltero/a" },
  { value: "married", label: "Casado/a" },
  { value: "divorced", label: "Divorciado/a" },
  { value: "widowed", label: "Viudo/a" },
  { value: "common_law", label: "Unión libre" },
  { value: "other", label: "Otro" },
] as const;

export const SESSION_STEPS = [
  { number: 1, label: "Datos de sesión" },
  { number: 2, label: "Energía inicial" },
  { number: 3, label: "Chakras iniciales" },
  { number: 4, label: "Temas" },
  { number: 5, label: "Energía final" },
  { number: 6, label: "Chakras finales" },
  { number: 7, label: "LNT" },
  { number: 8, label: "Limpieza y afectaciones" },
] as const;
