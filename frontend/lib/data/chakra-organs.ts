// Catálogo estático de órganos por chakra.
// Clave: número de posición del chakra (1 = Raíz, 7 = Corona).
// Sirve como fallback cuando el endpoint /catalogs/chakra-organs no esté disponible.

export interface ChakraOrganEntry {
  id: string;
  organ_name: string;
  system_name: string;
}

export const CHAKRA_ORGANS: Record<number, ChakraOrganEntry[]> = {
  1: [
    { id: 'c1-o1', organ_name: 'Intestino grueso',           system_name: 'Sistema digestivo' },
    { id: 'c1-o2', organ_name: 'Vejiga',                     system_name: 'Sistema urinario' },
    { id: 'c1-o3', organ_name: 'Glándulas suprarrenales',    system_name: 'Sistema endocrino' },
    { id: 'c1-o4', organ_name: 'Columna lumbar',             system_name: 'Sistema esquelético' },
    { id: 'c1-o5', organ_name: 'Piernas y pies',             system_name: 'Sistema musculoesquelético' },
    { id: 'c1-o6', organ_name: 'Próstata / Útero (base)',    system_name: 'Sistema reproductor' },
    { id: 'c1-o7', organ_name: 'Coxis',                     system_name: 'Sistema esquelético' },
  ],
  2: [
    { id: 'c2-o1', organ_name: 'Ovarios / Testículos',       system_name: 'Sistema reproductor' },
    { id: 'c2-o2', organ_name: 'Útero / Próstata',           system_name: 'Sistema reproductor' },
    { id: 'c2-o3', organ_name: 'Riñones',                    system_name: 'Sistema urinario' },
    { id: 'c2-o4', organ_name: 'Intestino delgado',          system_name: 'Sistema digestivo' },
    { id: 'c2-o5', organ_name: 'Pelvis y cadera',            system_name: 'Sistema musculoesquelético' },
    { id: 'c2-o6', organ_name: 'Vejiga (control)',           system_name: 'Sistema urinario' },
    { id: 'c2-o7', organ_name: 'Apéndice',                  system_name: 'Sistema digestivo' },
  ],
  3: [
    { id: 'c3-o1', organ_name: 'Hígado',                    system_name: 'Sistema hepatobiliar' },
    { id: 'c3-o2', organ_name: 'Estómago',                  system_name: 'Sistema digestivo' },
    { id: 'c3-o3', organ_name: 'Páncreas',                  system_name: 'Sistema endocrino / digestivo' },
    { id: 'c3-o4', organ_name: 'Vesícula biliar',            system_name: 'Sistema hepatobiliar' },
    { id: 'c3-o5', organ_name: 'Bazo',                      system_name: 'Sistema inmunológico' },
    { id: 'c3-o6', organ_name: 'Diafragma',                 system_name: 'Sistema respiratorio' },
    { id: 'c3-o7', organ_name: 'Suprarrenales (media)',      system_name: 'Sistema endocrino' },
  ],
  4: [
    { id: 'c4-o1', organ_name: 'Corazón',                   system_name: 'Sistema cardiovascular' },
    { id: 'c4-o2', organ_name: 'Pulmones',                  system_name: 'Sistema respiratorio' },
    { id: 'c4-o3', organ_name: 'Timo',                      system_name: 'Sistema inmunológico' },
    { id: 'c4-o4', organ_name: 'Hombros y brazos',          system_name: 'Sistema musculoesquelético' },
    { id: 'c4-o5', organ_name: 'Sistema linfático',         system_name: 'Sistema linfático' },
    { id: 'c4-o6', organ_name: 'Circulación sanguínea',     system_name: 'Sistema cardiovascular' },
    { id: 'c4-o7', organ_name: 'Manos',                     system_name: 'Sistema musculoesquelético' },
  ],
  5: [
    { id: 'c5-o1', organ_name: 'Tiroides',                  system_name: 'Sistema endocrino' },
    { id: 'c5-o2', organ_name: 'Paratiroides',              system_name: 'Sistema endocrino' },
    { id: 'c5-o3', organ_name: 'Garganta y laringe',        system_name: 'Sistema respiratorio' },
    { id: 'c5-o4', organ_name: 'Mandíbula y cuello',        system_name: 'Sistema musculoesquelético' },
    { id: 'c5-o5', organ_name: 'Oídos',                     system_name: 'Sistema sensorial' },
    { id: 'c5-o6', organ_name: 'Tráquea y bronquios',       system_name: 'Sistema respiratorio' },
    { id: 'c5-o7', organ_name: 'Boca y dientes',            system_name: 'Sistema digestivo' },
  ],
  6: [
    { id: 'c6-o1', organ_name: 'Glándula pituitaria',       system_name: 'Sistema endocrino' },
    { id: 'c6-o2', organ_name: 'Ojos',                      system_name: 'Sistema sensorial' },
    { id: 'c6-o3', organ_name: 'Nariz y senos paranasales', system_name: 'Sistema respiratorio' },
    { id: 'c6-o4', organ_name: 'Corteza frontal',           system_name: 'Sistema nervioso central' },
    { id: 'c6-o5', organ_name: 'Sistema nervioso central',  system_name: 'Sistema nervioso' },
    { id: 'c6-o6', organ_name: 'Glándula pineal',           system_name: 'Sistema endocrino' },
    { id: 'c6-o7', organ_name: 'Nervio óptico',             system_name: 'Sistema sensorial' },
  ],
  7: [
    { id: 'c7-o1', organ_name: 'Glándula pineal',           system_name: 'Sistema endocrino' },
    { id: 'c7-o2', organ_name: 'Cerebro (corteza)',         system_name: 'Sistema nervioso central' },
    { id: 'c7-o3', organ_name: 'Sistema nervioso',          system_name: 'Sistema nervioso' },
    { id: 'c7-o4', organ_name: 'Cráneo',                   system_name: 'Sistema esquelético' },
    { id: 'c7-o5', organ_name: 'Piel (epidermis)',          system_name: 'Sistema tegumentario' },
    { id: 'c7-o6', organ_name: 'Columna cervical',          system_name: 'Sistema esquelético' },
    { id: 'c7-o7', organ_name: 'Hipófisis',                system_name: 'Sistema endocrino' },
  ],
};

/** Devuelve los órganos de un chakra por su número de posición (1-7). */
export function getOrgansByChakraPosition(position: number): ChakraOrganEntry[] {
  return CHAKRA_ORGANS[position] ?? [];
}
