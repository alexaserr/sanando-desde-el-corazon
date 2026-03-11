// Catálogo estático de emociones basado en la Rueda de Emociones (Plutchik).
// Fuente: documento oficial Sanando desde el Corazón.

export interface EmotionCategory {
  label: string;
  color: string; // color del segmento en la rueda
  subEmotions: string[];
}

// ─── 6 emociones primarias con sus sub-emociones ──────────────────────────────
export const EMOTION_CATEGORIES: EmotionCategory[] = [
  {
    label: 'Miedo',
    color: '#7C3AED', // purple
    subEmotions: [
      'Espantado',
      'Aterrado',
      'Inseguro',
      'Asustado',
      'Sumiso',
      'Rechazado',
      'Humillado',
      'Amenazado',
    ],
  },
  {
    label: 'Ira',
    color: '#DC2626', // red
    subEmotions: [
      'Violado',
      'Enfurecido',
      'Rabioso',
      'Celoso',
      'Agresivo',
      'Frustrado',
      'Distante',
      'Crítico',
      'Desaprobado',
      'Odioso',
      'Desquiciado',
    ],
  },
  {
    label: 'Disgusto',
    color: '#166534', // dark green
    subEmotions: [
      'Decepcionado',
      'Terrible',
      'Evasivo',
      'Culpable',
      'Repulsivo',
      'Detestable',
      'Aversivo',
      'Indeciso',
      'Atormentado',
      'Avergonzado',
    ],
  },
  {
    label: 'Tristeza',
    color: '#1D4ED8', // blue
    subEmotions: [
      'Ansioso',
      'Abandonado',
      'Desesperado',
      'Deprimido',
      'Solitario',
      'Aburrido',
      'Apático',
      'Ignorado',
      'Discriminado',
      'Impotente',
      'Vulnerable',
      'Inferior',
      'Vacío',
    ],
  },
  {
    label: 'Felicidad',
    color: '#CA8A04', // yellow
    subEmotions: [
      'Optimista',
      'Íntimo',
      'Pacífico',
      'Poderoso',
      'Aceptado',
      'Orgulloso',
      'Jubiloso',
      'Elusivo',
      'Asombrado',
      'Confundido',
      'Sorprendido',
      'Interesado',
      'Curioso',
      'Entretenido',
    ],
  },
  {
    label: 'Sorpresa',
    color: '#16A34A', // light green
    subEmotions: [
      'Impresionado',
      'Consternado',
      'Desilusionado',
      'Perplejo',
      'Atónito',
      'Pasmado',
      'Inquieto',
      'Energético',
    ],
  },
];

// ─── Emociones independientes de la rueda ─────────────────────────────────────
export const STANDALONE_EMOTIONS: string[] = [
  'Admiración',
  'Agradecimiento',
  'Alegría',
  'Anhelante',
  'Apatía',
  'Asco',
  'Confiante',
  'Curiosidad',
  'Decepción',
  'Dolor',
  'Enojo',
  'Entusiasmo',
  'Frustración',
  'Impuntualidad',
  'Inseguridad',
  'Ira',
  'Miedo',
  'Nerviosismo',
  'Neutralidad',
  'Soledad',
  'Vacío',
];
