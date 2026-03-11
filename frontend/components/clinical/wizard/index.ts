// Barrel de exports del wizard de sesión clínica.
// Importar desde '@/components/clinical/wizard' en lugar de rutas individuales.

// Componentes de paso
export { StepGeneral }        from './StepGeneral';
export { StepEnergyInitial }  from './StepEnergyInitial';
export { StepChakrasInitial } from './StepChakrasInitial';
export { StepTopics }         from './StepTopics';
export { StepEnergyFinal }    from './StepEnergyFinal';
export { StepChakrasFinal }   from './StepChakrasFinal';
export { StepClose }          from './StepClose';

// Contenedor
export { WizardShell }        from './WizardShell';

// Tipos compartidos
export type {
  ClientOption,
  TherapyTypeOption,
  EnergyDimension,
  EnergyReading,
  WizardChakraReading,
  SourceType,
  Topic,
  GeneralData,
  CloseData,
  SessionSummary,
  AgeData,
  BlockageData,
  ThemeEntry,
} from './types';

// Componentes paso 4 (rediseño)
export { BlockageRow }  from './BlockageRow';
export { AgesSection }  from './AgesSection';
export { ThemeCard }    from './ThemeCard';

// Props de cada paso (para el wizard page)
export type { StepGeneralProps }        from './StepGeneral';
export type { StepEnergyInitialProps }  from './StepEnergyInitial';
export type { StepChakrasInitialProps } from './StepChakrasInitial';
export type { StepTopicsProps }         from './StepTopics';
export type { StepEnergyFinalProps }    from './StepEnergyFinal';
export type { StepChakrasFinalProps }   from './StepChakrasFinal';
export type { StepCloseProps }          from './StepClose';
export type { WizardShellProps }        from './WizardShell';
