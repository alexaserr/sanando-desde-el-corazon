// Catálogo estático de órganos por chakra.
// Clave: número de posición del chakra (1 = Raíz, 7 = Corona).
// Sirve como fallback cuando el endpoint /catalogs/chakra-organs no esté disponible.
// Fuente: documento oficial Sanando desde el Corazón.

export interface ChakraOrganEntry {
  id: string;
  organ_name: string;
  system_name: string;
}

export interface ColumnaVertebralEntry {
  id: string;
  vertebra: string;
  region: 'Lumbar' | 'Dorsal' | 'Cervical';
}

// ─── Orden: 1 Raíz → 7 Corona ────────────────────────────────────────────────
export const CHAKRA_ORGANS: Record<number, ChakraOrganEntry[]> = {
  // 1. RAÍZ
  1: [
    { id: 'c1-o01', organ_name: 'Sangre',                    system_name: 'Sistema circulatorio' },
    { id: 'c1-o02', organ_name: 'Huesos',                    system_name: 'Sistema esquelético' },
    { id: 'c1-o03', organ_name: 'Base de la columna',        system_name: 'Sistema esquelético' },
    { id: 'c1-o04', organ_name: 'Próstata',                  system_name: 'Sistema reproductor' },
    { id: 'c1-o05', organ_name: 'Vagina',                    system_name: 'Sistema reproductor' },
    { id: 'c1-o06', organ_name: 'Clítoris',                  system_name: 'Sistema reproductor' },
    { id: 'c1-o07', organ_name: 'Labios vaginales',          system_name: 'Sistema reproductor' },
    { id: 'c1-o08', organ_name: 'Vejiga',                    system_name: 'Sistema urinario' },
    { id: 'c1-o09', organ_name: 'Intestino grueso',          system_name: 'Sistema digestivo' },
    { id: 'c1-o10', organ_name: 'Ano',                       system_name: 'Sistema digestivo' },
    { id: 'c1-o11', organ_name: 'Recto',                     system_name: 'Sistema digestivo' },
    { id: 'c1-o12', organ_name: 'Perineo',                   system_name: 'Sistema musculoesquelético' },
    { id: 'c1-o13', organ_name: 'Piernas',                   system_name: 'Sistema musculoesquelético' },
    { id: 'c1-o14', organ_name: 'Pies',                      system_name: 'Sistema musculoesquelético' },
    { id: 'c1-o15', organ_name: 'Sacro',                     system_name: 'Sistema esquelético' },
    { id: 'c1-o16', organ_name: 'Coxis',                     system_name: 'Sistema esquelético' },
    { id: 'c1-o17', organ_name: 'Soporte físico del cuerpo', system_name: 'Sistema esquelético' },
    // Glándulas
    { id: 'c1-g01', organ_name: 'Órganos sexuales',          system_name: 'Glándula' },
  ],

  // 2. SACRO
  2: [
    { id: 'c2-o01', organ_name: 'Intestino grueso',          system_name: 'Sistema digestivo' },
    { id: 'c2-o02', organ_name: 'Vértebras inferiores',      system_name: 'Sistema esquelético' },
    { id: 'c2-o03', organ_name: 'Zona de las caderas',       system_name: 'Sistema musculoesquelético' },
    { id: 'c2-o04', organ_name: 'Pelvis',                    system_name: 'Sistema esquelético' },
    { id: 'c2-o05', organ_name: 'Pubis',                     system_name: 'Sistema esquelético' },
    { id: 'c2-o06', organ_name: 'Apéndice',                  system_name: 'Sistema digestivo' },
    { id: 'c2-o07', organ_name: 'Vejiga urinaria',           system_name: 'Sistema urinario' },
    { id: 'c2-o08', organ_name: 'Vesícula seminal',          system_name: 'Sistema reproductor' },
    { id: 'c2-o09', organ_name: 'Uretra',                    system_name: 'Sistema urinario' },
    { id: 'c2-o10', organ_name: 'Testículos',                system_name: 'Sistema reproductor' },
    { id: 'c2-o11', organ_name: 'Pene',                      system_name: 'Sistema reproductor' },
    { id: 'c2-o12', organ_name: 'Escroto',                   system_name: 'Sistema reproductor' },
    { id: 'c2-o13', organ_name: 'Plexo venoso vaginal',      system_name: 'Sistema reproductor' },
    { id: 'c2-o14', organ_name: 'Ovarios',                   system_name: 'Sistema reproductor' },
    { id: 'c2-o15', organ_name: 'Útero',                     system_name: 'Sistema reproductor' },
    { id: 'c2-o16', organ_name: 'Trompas de falopio',        system_name: 'Sistema reproductor' },
    { id: 'c2-o17', organ_name: 'Riñones',                   system_name: 'Sistema urinario' },
    { id: 'c2-o18', organ_name: 'Cresta ilíaca',             system_name: 'Sistema esquelético' },
    { id: 'c2-o19', organ_name: 'Cadera derecha',            system_name: 'Sistema musculoesquelético' },
    { id: 'c2-o20', organ_name: 'Cadera izquierda',          system_name: 'Sistema musculoesquelético' },
    { id: 'c2-o21', organ_name: 'Dorso lumbar',              system_name: 'Sistema musculoesquelético' },
    // Glándulas
    { id: 'c2-g01', organ_name: 'Suprarrenal',               system_name: 'Glándula' },
    { id: 'c2-g02', organ_name: 'Órganos sexuales',          system_name: 'Glándula' },
  ],

  // 3. PLEXO SOLAR
  3: [
    { id: 'c3-o01', organ_name: 'Abdomen',                   system_name: 'Sistema digestivo' },
    { id: 'c3-o02', organ_name: 'Estómago',                  system_name: 'Sistema digestivo' },
    { id: 'c3-o03', organ_name: 'Intestino delgado',         system_name: 'Sistema digestivo' },
    { id: 'c3-o04', organ_name: 'Riñones',                   system_name: 'Sistema urinario' },
    { id: 'c3-o05', organ_name: 'Hígado',                    system_name: 'Sistema hepatobiliar' },
    { id: 'c3-o06', organ_name: 'Vesícula biliar',           system_name: 'Sistema hepatobiliar' },
    { id: 'c3-o07', organ_name: 'Bazo',                      system_name: 'Sistema inmunológico' },
    { id: 'c3-o08', organ_name: 'Duodeno',                   system_name: 'Sistema digestivo' },
    { id: 'c3-o09', organ_name: 'Parte central de la columna', system_name: 'Sistema esquelético' },
    { id: 'c3-o10', organ_name: 'Caderas',                   system_name: 'Sistema musculoesquelético' },
    { id: 'c3-o11', organ_name: 'Articulaciones',            system_name: 'Sistema musculoesquelético' },
    { id: 'c3-o12', organ_name: 'Vena porta',                system_name: 'Sistema cardiovascular' },
    { id: 'c3-o13', organ_name: 'Píloro',                    system_name: 'Sistema digestivo' },
    { id: 'c3-o14', organ_name: 'Yeyuno',                    system_name: 'Sistema digestivo' },
    { id: 'c3-o15', organ_name: 'Colon ascendente',          system_name: 'Sistema digestivo' },
    { id: 'c3-o16', organ_name: 'Ciego',                     system_name: 'Sistema digestivo' },
    { id: 'c3-o17', organ_name: 'Apéndice',                  system_name: 'Sistema digestivo' },
    { id: 'c3-o18', organ_name: 'Ombligo',                   system_name: 'Sistema tegumentario' },
    // Glándulas
    { id: 'c3-g01', organ_name: 'Páncreas',                  system_name: 'Glándula' },
  ],

  // 4. CORAZÓN
  4: [
    { id: 'c4-o01', organ_name: 'Braquial',                  system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o02', organ_name: 'Brazos',                    system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o03', organ_name: 'Radio',                     system_name: 'Sistema esquelético' },
    { id: 'c4-o04', organ_name: 'Cúbito',                    system_name: 'Sistema esquelético' },
    { id: 'c4-o05', organ_name: 'Deltoides',                 system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o06', organ_name: 'Codos',                     system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o07', organ_name: 'Manos',                     system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o08', organ_name: 'Muñeca',                    system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o09', organ_name: 'Pecho',                     system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o10', organ_name: 'Timo',                      system_name: 'Sistema inmunológico' },
    { id: 'c4-o11', organ_name: 'Costillas',                 system_name: 'Sistema esquelético' },
    { id: 'c4-o12', organ_name: 'Pectoral',                  system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o13', organ_name: 'Esternón',                  system_name: 'Sistema esquelético' },
    { id: 'c4-o14', organ_name: 'Esófago',                   system_name: 'Sistema digestivo' },
    { id: 'c4-o15', organ_name: 'Pezón',                     system_name: 'Sistema tegumentario' },
    { id: 'c4-o16', organ_name: 'Corazón',                   system_name: 'Sistema cardiovascular' },
    { id: 'c4-o17', organ_name: 'Venas coronarias',          system_name: 'Sistema cardiovascular' },
    { id: 'c4-o18', organ_name: 'Pericardio',                system_name: 'Sistema cardiovascular' },
    { id: 'c4-o19', organ_name: 'Coronarias',                system_name: 'Sistema cardiovascular' },
    { id: 'c4-o20', organ_name: 'Condal',                    system_name: 'Sistema esquelético' },
    { id: 'c4-o21', organ_name: 'Costal',                    system_name: 'Sistema esquelético' },
    { id: 'c4-o22', organ_name: 'Aorta',                     system_name: 'Sistema cardiovascular' },
    { id: 'c4-o23', organ_name: 'Cardias',                   system_name: 'Sistema digestivo' },
    { id: 'c4-o24', organ_name: 'Pulmones',                  system_name: 'Sistema respiratorio' },
    { id: 'c4-o25', organ_name: 'Senos mamarios',            system_name: 'Sistema reproductor' },
    // Glándulas
    { id: 'c4-g01', organ_name: 'Timo',                      system_name: 'Glándula' },
  ],

  // 5. GARGANTA
  5: [
    { id: 'c5-o01', organ_name: 'Diafragma',                 system_name: 'Sistema respiratorio' },
    { id: 'c5-o02', organ_name: 'Hombros',                   system_name: 'Sistema musculoesquelético' },
    { id: 'c5-o03', organ_name: 'Braquial',                  system_name: 'Sistema musculoesquelético' },
    { id: 'c5-o04', organ_name: 'Pleura',                    system_name: 'Sistema respiratorio' },
    { id: 'c5-o05', organ_name: 'Laringe',                   system_name: 'Sistema respiratorio' },
    { id: 'c5-o06', organ_name: 'Tráquea',                   system_name: 'Sistema respiratorio' },
    { id: 'c5-o07', organ_name: 'Parótida',                  system_name: 'Sistema digestivo' },
    { id: 'c5-o08', organ_name: 'Angina',                    system_name: 'Sistema respiratorio' },
    { id: 'c5-o09', organ_name: 'Carótida',                  system_name: 'Sistema cardiovascular' },
    { id: 'c5-o10', organ_name: 'Esternocleidomastoideo',    system_name: 'Sistema musculoesquelético' },
    { id: 'c5-o11', organ_name: 'Yugular',                   system_name: 'Sistema cardiovascular' },
    { id: 'c5-o12', organ_name: 'Cuello',                    system_name: 'Sistema musculoesquelético' },
    // Glándulas
    { id: 'c5-g01', organ_name: 'Tiroides',                  system_name: 'Glándula' },
    { id: 'c5-g02', organ_name: 'Timo',                      system_name: 'Glándula' },
    { id: 'c5-g03', organ_name: 'Salivares',                 system_name: 'Glándula' },
  ],

  // 6. TERCER OJO
  6: [
    { id: 'c6-o01', organ_name: 'Cerebro',                   system_name: 'Sistema nervioso central' },
    { id: 'c6-o02', organ_name: 'Ojos',                      system_name: 'Sistema sensorial' },
    { id: 'c6-o03', organ_name: 'Craneal',                   system_name: 'Sistema esquelético' },
    { id: 'c6-o04', organ_name: 'Nariz',                     system_name: 'Sistema respiratorio' },
    { id: 'c6-o05', organ_name: 'Paranasales',               system_name: 'Sistema respiratorio' },
    { id: 'c6-o06', organ_name: 'Senos nasales',             system_name: 'Sistema respiratorio' },
    { id: 'c6-o07', organ_name: 'Mentón',                    system_name: 'Sistema esquelético' },
    { id: 'c6-o08', organ_name: 'Angulo',                    system_name: 'Sistema esquelético' },
    { id: 'c6-o09', organ_name: 'Dentadura',                 system_name: 'Sistema digestivo' },
    { id: 'c6-o10', organ_name: 'Lengua',                    system_name: 'Sistema digestivo' },
    { id: 'c6-o11', organ_name: 'Hipotálamo',                system_name: 'Sistema nervioso central' },
    { id: 'c6-o12', organ_name: 'Oídos',                     system_name: 'Sistema sensorial' },
    { id: 'c6-o13', organ_name: 'Oreja',                     system_name: 'Sistema sensorial' },
    { id: 'c6-o14', organ_name: 'Nervio facial',             system_name: 'Sistema nervioso' },
    { id: 'c6-o15', organ_name: 'Nuca',                      system_name: 'Sistema musculoesquelético' },
    { id: 'c6-o16', organ_name: 'Tallo parietal',            system_name: 'Sistema nervioso central' },
    { id: 'c6-o17', organ_name: 'Hipocampo',                 system_name: 'Sistema nervioso central' },
    { id: 'c6-o18', organ_name: 'Amígdala cerebral',         system_name: 'Sistema nervioso central' },
    { id: 'c6-o19', organ_name: 'Base del cráneo',           system_name: 'Sistema esquelético' },
    // Glándulas
    { id: 'c6-g01', organ_name: 'Pineal',                    system_name: 'Glándula' },
    { id: 'c6-g02', organ_name: 'Pituitaria',                system_name: 'Glándula' },
  ],

  // 7. CORONA
  7: [
    { id: 'c7-o01', organ_name: 'Cerebro',                   system_name: 'Sistema nervioso central' },
    { id: 'c7-o02', organ_name: 'Piel',                      system_name: 'Sistema tegumentario' },
    { id: 'c7-o03', organ_name: 'Hipófisis',                 system_name: 'Sistema endocrino' },
    { id: 'c7-o04', organ_name: 'Coronilla',                 system_name: 'Sistema esquelético' },
    // Glándulas
    { id: 'c7-g01', organ_name: 'Pineal',                    system_name: 'Glándula' },
    { id: 'c7-g02', organ_name: 'Pituitaria',                system_name: 'Glándula' },
  ],
};

// ─── Columna vertebral (independiente de chakras) ─────────────────────────────
export const COLUMNA_VERTEBRAL: ColumnaVertebralEntry[] = [
  // Lumbares
  { id: 'cv-l1', vertebra: 'L1', region: 'Lumbar' },
  { id: 'cv-l2', vertebra: 'L2', region: 'Lumbar' },
  { id: 'cv-l3', vertebra: 'L3', region: 'Lumbar' },
  { id: 'cv-l4', vertebra: 'L4', region: 'Lumbar' },
  { id: 'cv-l5', vertebra: 'L5', region: 'Lumbar' },
  { id: 'cv-l6', vertebra: 'L6', region: 'Lumbar' },
  // Dorsales
  { id: 'cv-d1',  vertebra: 'D1',  region: 'Dorsal' },
  { id: 'cv-d2',  vertebra: 'D2',  region: 'Dorsal' },
  { id: 'cv-d3',  vertebra: 'D3',  region: 'Dorsal' },
  { id: 'cv-d4',  vertebra: 'D4',  region: 'Dorsal' },
  { id: 'cv-d5',  vertebra: 'D5',  region: 'Dorsal' },
  { id: 'cv-d6',  vertebra: 'D6',  region: 'Dorsal' },
  { id: 'cv-d7',  vertebra: 'D7',  region: 'Dorsal' },
  { id: 'cv-d8',  vertebra: 'D8',  region: 'Dorsal' },
  { id: 'cv-d9',  vertebra: 'D9',  region: 'Dorsal' },
  { id: 'cv-d10', vertebra: 'D10', region: 'Dorsal' },
  { id: 'cv-d11', vertebra: 'D11', region: 'Dorsal' },
  { id: 'cv-d12', vertebra: 'D12', region: 'Dorsal' },
  // Cervicales
  { id: 'cv-c1', vertebra: 'C1', region: 'Cervical' },
  { id: 'cv-c2', vertebra: 'C2', region: 'Cervical' },
  { id: 'cv-c3', vertebra: 'C3', region: 'Cervical' },
  { id: 'cv-c4', vertebra: 'C4', region: 'Cervical' },
  { id: 'cv-c5', vertebra: 'C5', region: 'Cervical' },
  { id: 'cv-c6', vertebra: 'C6', region: 'Cervical' },
  { id: 'cv-c7', vertebra: 'C7', region: 'Cervical' },
];

/** Devuelve los órganos de un chakra por su número de posición (1-7). */
export function getOrgansByChakraPosition(position: number): ChakraOrganEntry[] {
  return CHAKRA_ORGANS[position] ?? [];
}
