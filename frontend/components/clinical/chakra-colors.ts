// Colores del design system SDC para cada chakra
export const CHAKRA_COLORS = {
  root:      '#C0392B', // Raíz       — rojo
  sacral:    '#E67E22', // Sacral     — naranja
  plexo:     '#F1C40F', // Plexo Solar — amarillo
  heart:     '#27AE60', // Corazón    — verde
  throat:    '#2980B9', // Garganta   — azul
  third_eye: '#6C3483', // Tercer Ojo — púrpura
  crown:     '#8E44AD', // Corona     — violeta
  bud:       '#DAA520', // Bud        — dorado (solo animales)
} as const;

export type ChakraKey = keyof typeof CHAKRA_COLORS;

// Orden canónico de visualización: raíz → corona (+ bud al final)
// Cada entrada: [nombre normalizado sin tildes, clave, color]
type ChakraEntry = [normalized: string, key: ChakraKey, color: string];

const CHAKRA_REGISTRY: ChakraEntry[] = [
  ['raiz',         'root',      CHAKRA_COLORS.root],
  ['sacro',        'sacral',    CHAKRA_COLORS.sacral],  // nombre español del catálogo
  ['sacral',       'sacral',    CHAKRA_COLORS.sacral],  // alias inglés/alternativo
  ['plexo solar',  'plexo',     CHAKRA_COLORS.plexo],
  ['plexo',        'plexo',     CHAKRA_COLORS.plexo],   // alias abreviado
  ['corazon',      'heart',     CHAKRA_COLORS.heart],
  ['garganta',     'throat',    CHAKRA_COLORS.throat],
  ['tercer ojo',   'third_eye', CHAKRA_COLORS.third_eye],
  ['corona',       'crown',     CHAKRA_COLORS.crown],
  ['bud',          'bud',       CHAKRA_COLORS.bud],
];

/** Normaliza a minúsculas sin diacríticos para comparar nombres de chakras. */
function normalizeChakraName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Devuelve el color hex del chakra según su nombre (acepta español con/sin tildes).
 * Retorna '#888888' si el nombre no se reconoce.
 */
export function getChakraColor(name: string): string {
  const n = normalizeChakraName(name);
  const entry = CHAKRA_REGISTRY.find(([normalized]) => normalized === n);
  return entry ? entry[2] : '#888888';
}

/**
 * Índice de posición en el orden canónico (0 = Raíz, 6 = Corona, 7 = Bud).
 * Devuelve 99 si el nombre no se reconoce.
 */
export function getChakraDisplayOrder(name: string): number {
  const n = normalizeChakraName(name);
  const idx = CHAKRA_REGISTRY.findIndex(([normalized]) => normalized === n);
  return idx === -1 ? 99 : idx;
}
