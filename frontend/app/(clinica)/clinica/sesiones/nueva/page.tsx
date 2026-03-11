'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { WizardShell }        from '@/components/clinical/wizard/WizardShell';
import { StepGeneral }        from '@/components/clinical/wizard/StepGeneral';
import { StepEnergyInitial }  from '@/components/clinical/wizard/StepEnergyInitial';
import { StepChakrasInitial } from '@/components/clinical/wizard/StepChakrasInitial';
import { StepTopics }         from '@/components/clinical/wizard/StepTopics';
import { StepEnergyFinal }    from '@/components/clinical/wizard/StepEnergyFinal';
import { StepChakrasFinal }   from '@/components/clinical/wizard/StepChakrasFinal';
import { StepClose }          from '@/components/clinical/wizard/StepClose';

import { useWizardStore } from '@/lib/stores/wizardStore';
import { getWizardConfig } from '@/lib/data/wizard-config';
import {
  getTherapyTypes,
  getChakraPositions,
  getEnergyDimensions,
  getClientsList,
  searchClients,
  createSession,
  updateSessionGeneral,
  saveEnergyReadings,
  saveChakraReadings,
  closeSession,
  getClientTopics,
  saveThemeEntries,
} from '@/lib/api/clinical';

import type { TherapyType, ChakraPosition, EnergyDimension, ClientListItem, ClientTopic } from '@/types/api';
import type {
  GeneralData,
  EnergyReading,
  WizardChakraReading,
  ThemeEntry,
  CloseData,
  SessionSummary,
} from '@/components/clinical/wizard/types';

// ─── Tipos internos de catálogos cargados ─────────────────────────────────────

interface Catalogs {
  therapyTypes: TherapyType[];
  chakras: ChakraPosition[];
  dimensions: EnergyDimension[];
  clients: ClientListItem[];
}

// ─── Valores por defecto ───────────────────────────────────────────────────────

function defaultGeneralData(): GeneralData {
  const now = new Date();
  // datetime-local espera "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, '0');
  const measured_at = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    client_id: '', therapy_type_id: '', measured_at, general_energy: 50, notes: '',
    has_entities: null, entities_count: 0,
    has_capas: null, capas_count: 0,
    has_implants: null, implants_count: 0,
    requires_cleanings: null, total_cleanings: 0,
  };
}

function defaultCloseData(): CloseData {
  return { cost: '', payment_notes: '' };
}

function initEnergyReadings(dimensions: EnergyDimension[]): EnergyReading[] {
  return dimensions.filter((d) => d.is_active).map((d) => ({ dimension_id: d.id, value: 50 }));
}

function initChakraReadings(chakras: ChakraPosition[]): WizardChakraReading[] {
  return [...chakras]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ chakra_position_id: c.id, name: c.name, value: 7 }));
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function NuevaSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientIdParam = searchParams.get('client_id');

  // Wizard store
  const { currentStep, sessionId, setStep, markStepComplete, setSessionId, reset } =
    useWizardStore();

  // Estado de catálogos
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Temas del paciente (cargados al seleccionar cliente)
  const [clientTopics, setClientTopics] = useState<ClientTopic[]>([]);

  // Estado de cada paso
  const [generalData, setGeneralData]               = useState<GeneralData>(defaultGeneralData);
  const [energyInitial, setEnergyInitial]           = useState<EnergyReading[]>([]);
  const [chakraInitial, setChakraInitial]           = useState<WizardChakraReading[]>([]);
  const [themes, setThemes]                         = useState<ThemeEntry[]>([]);
  const [energyFinal, setEnergyFinal]               = useState<EnergyReading[]>([]);
  const [chakraFinal, setChakraFinal]               = useState<WizardChakraReading[]>([]);
  const [closeData, setCloseData]                   = useState<CloseData>(defaultCloseData);

  // Estado de UI
  const [isSaving, setIsSaving] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Resetear store al montar (nueva sesión en blanco)
  useEffect(() => {
    reset();
  }, [reset]);

  // Pre-seleccionar cliente si viene por query param ?client_id=
  const clientParamApplied = useRef(false);
  useEffect(() => {
    if (clientIdParam && !clientParamApplied.current) {
      clientParamApplied.current = true;
      setGeneralData((prev) => ({ ...prev, client_id: clientIdParam }));
    }
  }, [clientIdParam]);

  // Cargar catálogos
  useEffect(() => {
    async function load() {
      try {
        const [therapyTypes, chakras, dimensions, clients] = await Promise.all([
          getTherapyTypes(),
          getChakraPositions(),
          getEnergyDimensions(),
          getClientsList(),
        ]);
        setCatalogs({ therapyTypes, chakras, dimensions, clients });
        setEnergyInitial(initEnergyReadings(dimensions));
        setEnergyFinal(initEnergyReadings(dimensions));
        setChakraInitial(initChakraReadings(chakras));
        setChakraFinal(initChakraReadings(chakras));
      } catch {
        setLoadError('Error cargando catálogos. Intenta recargar la página.');
      }
    }
    load();
  }, []);

  // Cargar temas del paciente cuando cambia el cliente seleccionado
  useEffect(() => {
    if (!generalData.client_id) {
      setClientTopics([]);
      return;
    }
    getClientTopics(generalData.client_id)
      .then(setClientTopics)
      .catch(() => setClientTopics([]));
  }, [generalData.client_id]);

  // ─── Configuración del wizard según tipo de terapia ───────────────────────────

  const wizardConfig = useMemo(() => {
    const therapy = catalogs?.therapyTypes.find((t) => t.id === generalData.therapy_type_id);
    return getWizardConfig(therapy?.name ?? '');
  }, [catalogs, generalData.therapy_type_id]);

  const activeSteps = wizardConfig.steps;

  // Auto-rellenar costo por defecto al llegar al paso de cierre
  useEffect(() => {
    if (activeSteps[currentStep - 1]?.component === 'StepClose' && closeData.cost === '') {
      setCloseData((prev) => ({ ...prev, cost: String(wizardConfig.defaultCost) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, activeSteps, wizardConfig.defaultCost]);

  // ─── Helpers de estado de pasos ───────────────────────────────────────────────

  function updateEnergyReading(
    setState: React.Dispatch<React.SetStateAction<EnergyReading[]>>,
    dimensionId: string,
    value: number,
  ) {
    setState((prev) =>
      prev.map((r) => (r.dimension_id === dimensionId ? { ...r, value } : r)),
    );
  }

  function updateChakraReading(
    setState: React.Dispatch<React.SetStateAction<WizardChakraReading[]>>,
    chakraPositionId: string,
    value: number,
  ) {
    setState((prev) =>
      prev.map((r) => (r.chakra_position_id === chakraPositionId ? { ...r, value } : r)),
    );
  }

  const handleThemesChange = useCallback((updated: ThemeEntry[]) => {
    setThemes(updated);
  }, []);

  // ─── Resumen de sesión para StepClose ─────────────────────────────────────────

  const sessionSummary = useMemo<SessionSummary>(() => {
    const client = catalogs?.clients.find((c) => c.id === generalData.client_id);
    const therapy = catalogs?.therapyTypes.find((t) => t.id === generalData.therapy_type_id);

    const avg = (readings: EnergyReading[]) => {
      if (readings.length === 0) return null;
      return Math.round(readings.reduce((s, r) => s + r.value, 0) / readings.length);
    };

    return {
      clientName:       client?.full_name ?? '',
      therapyTypeName:  therapy?.name ?? '',
      measuredAt:       generalData.measured_at,
      generalEnergy:    generalData.general_energy,
      energyInitialAvg: avg(energyInitial),
      energyFinalAvg:   avg(energyFinal),
      topicsCount:      themes.length,
      chakraInitialCount: chakraInitial.length,
      chakraFinalCount:   chakraFinal.length,
    };
  }, [catalogs, generalData, energyInitial, energyFinal, themes, chakraInitial, chakraFinal]);

  // ─── Validación del paso 1 ─────────────────────────────────────────────────────

  const isStep1Valid =
    !!generalData.client_id && !!generalData.therapy_type_id && !!generalData.measured_at;

  // ─── Helpers para serializar entradas de temas ────────────────────────────────

  function buildThemeEntries(themeList: ThemeEntry[]) {
    return themeList.flatMap((t) => {
      const blockageRows = (['bloqueo_1', 'bloqueo_2', 'bloqueo_3'] as const).map((et, i) => {
        const b = t.blockages[i];
        if (!b.chakra_position_id && !b.organ_name) return null;
        return {
          client_topic_id: t.topic_id,
          entry_type: et,
          chakra_position_id: b.chakra_position_id || null,
          organ_name: b.organ_name || null,
          initial_energy: b.energy,
          final_energy: b.final_energy ?? null,
        };
      }).filter((r): r is NonNullable<typeof r> => r !== null);

      const resultantRow = (t.resultant.chakra_position_id || t.resultant.organ_name) ? [{
        client_topic_id: t.topic_id,
        entry_type: 'resultante' as const,
        chakra_position_id: t.resultant.chakra_position_id || null,
        organ_name: t.resultant.organ_name || null,
        initial_energy: t.resultant.energy,
        final_energy: t.resultant.final_energy ?? null,
      }] : [];

      const secondaryRow = t.is_secondary ? [{
        client_topic_id: t.topic_id,
        entry_type: 'secundario' as const,
        initial_energy: t.secondary_energy_initial,
        final_energy: t.secondary_energy_final,
      }] : [];

      const a = t.adulthood;
      const adultRow = (a.situation || a.description || a.emotions || a.place || a.people) ? [{
        client_topic_id: t.topic_id,
        entry_type: 'edad_adulta' as const,
        adult_theme: a.situation || a.description || null,
        emotions: a.emotions || null,
      }] : [];

      const c = t.childhood;
      const childRow = (c.situation || c.description || c.emotions || c.place || c.people) ? [{
        client_topic_id: t.topic_id,
        entry_type: 'edad_infancia' as const,
        child_theme: c.situation || c.description || null,
      }] : [];

      return [...blockageRows, ...resultantRow, ...secondaryRow, ...adultRow, ...childRow];
    });
  }

  async function saveTopicsStep(sid: string) {
    const entries = buildThemeEntries(themes);
    if (entries.length > 0) {
      const topicProgress = themes
        .filter((t) => t.topic_id !== null)
        .map((t) => ({ client_topic_id: t.topic_id as string, progress_pct: t.progress_pct }));
      await saveThemeEntries(sid, { entries, topic_progress: topicProgress });
    }
  }

  // ─── Lógica de avance por paso ────────────────────────────────────────────────

  const handleNext = useCallback(async () => {
    setIsSaving(true);
    setStepError(null);

    const stepComponent = activeSteps[currentStep - 1]?.component;

    try {
      if (stepComponent === 'StepGeneral') {
        // POST /sessions + PATCH /sessions/{id}/general
        const session = await createSession({
          client_id:        generalData.client_id,
          therapy_type_id:  generalData.therapy_type_id,
          measured_at:      generalData.measured_at
            ? new Date(generalData.measured_at).toISOString()
            : undefined,
          notes: generalData.notes || undefined,
        });
        setSessionId(session.id);

        await updateSessionGeneral(session.id, {
          general_energy_level: generalData.general_energy,
          notes: generalData.notes || undefined,
          entities_count: generalData.has_entities === true ? generalData.entities_count : null,
          implants_count: generalData.has_implants === true ? generalData.implants_count : null,
          total_cleanings: generalData.requires_cleanings === true ? generalData.total_cleanings : null,
        });

        markStepComplete(currentStep);
        setStep(currentStep + 1);

      } else if (stepComponent === 'StepEnergyInitial') {
        if (!sessionId) throw new Error('Sesión no iniciada');
        await saveEnergyReadings(sessionId, 'initial', energyInitial);
        markStepComplete(currentStep);
        setStep(currentStep + 1);

      } else if (stepComponent === 'StepChakrasInitial') {
        if (!sessionId) throw new Error('Sesión no iniciada');
        await saveChakraReadings(
          sessionId,
          'initial',
          chakraInitial.map((r) => ({ chakra_position_id: r.chakra_position_id, value: r.value })),
        );
        markStepComplete(currentStep);
        setStep(currentStep + 1);

      } else if (stepComponent === 'StepTopics') {
        if (!sessionId) throw new Error('Sesión no iniciada');
        await saveTopicsStep(sessionId);
        markStepComplete(currentStep);
        setStep(currentStep + 1);

      } else if (stepComponent === 'StepLNT' || stepComponent === 'StepCleaning') {
        // Placeholder — los componentes reales se implementarán después
        markStepComplete(currentStep);
        setStep(currentStep + 1);

      } else if (stepComponent === 'StepEnergyFinal') {
        if (!sessionId) throw new Error('Sesión no iniciada');
        await saveEnergyReadings(sessionId, 'final', energyFinal);
        markStepComplete(currentStep);
        setStep(currentStep + 1);

      } else if (stepComponent === 'StepChakrasFinal') {
        if (!sessionId) throw new Error('Sesión no iniciada');
        await saveChakraReadings(
          sessionId,
          'final',
          chakraFinal.map((r) => ({ chakra_position_id: r.chakra_position_id, value: r.value })),
        );
        markStepComplete(currentStep);
        setStep(currentStep + 1);
      }
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  }, [
    currentStep, activeSteps, sessionId, generalData, energyInitial, chakraInitial,
    themes, energyFinal, chakraFinal,
    setSessionId, markStepComplete, setStep,
  ]);

  const handlePrev = useCallback(() => {
    setStepError(null);
    setStep(currentStep - 1);
  }, [currentStep, setStep]);

  const handleSaveDraft = useCallback(async () => {
    // Solo guarda si ya existe una sesión (pasos 2+)
    if (!sessionId) return;
    setIsSaving(true);
    setStepError(null);

    const stepComponent = activeSteps[currentStep - 1]?.component;

    try {
      if (stepComponent === 'StepEnergyInitial') {
        await saveEnergyReadings(sessionId, 'initial', energyInitial);
      } else if (stepComponent === 'StepChakrasInitial') {
        await saveChakraReadings(
          sessionId, 'initial',
          chakraInitial.map((r) => ({ chakra_position_id: r.chakra_position_id, value: r.value })),
        );
      } else if (stepComponent === 'StepTopics') {
        await saveTopicsStep(sessionId);
      } else if (stepComponent === 'StepEnergyFinal') {
        await saveEnergyReadings(sessionId, 'final', energyFinal);
      } else if (stepComponent === 'StepChakrasFinal') {
        await saveChakraReadings(
          sessionId, 'final',
          chakraFinal.map((r) => ({ chakra_position_id: r.chakra_position_id, value: r.value })),
        );
      }
      // StepLNT, StepCleaning — sin datos que guardar aún
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Error al guardar borrador.');
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, currentStep, activeSteps, energyInitial, chakraInitial, themes, energyFinal, chakraFinal]);

  const handleCloseSession = useCallback(async () => {
    if (!sessionId) return;
    const cost = parseFloat(closeData.cost);
    if (isNaN(cost)) {
      setStepError('Ingresa un costo válido para cerrar la sesión.');
      return;
    }
    setIsSaving(true);
    setStepError(null);
    try {
      await closeSession(sessionId, {
        cost,
        payment_notes: closeData.payment_notes || undefined,
      });
      markStepComplete(activeSteps.length);
      reset();
      router.push('/clinica/sesiones');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Error al cerrar la sesión.');
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, closeData, activeSteps.length, markStepComplete, reset, router]);

  // ─── Render ────────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {loadError}
        </p>
      </div>
    );
  }

  if (!catalogs) {
    return (
      <div className="p-8 text-sm text-gray-500">Cargando wizard de sesión…</div>
    );
  }

  // Dimensiones activas para los steps de energía
  const activeDimensions = catalogs.dimensions.filter((d) => d.is_active);

  // isNextDisabled solo aplica al paso 1
  const currentComponent = activeSteps[currentStep - 1]?.component;
  const isNextDisabled = currentComponent === 'StepGeneral' ? !isStep1Valid : false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Banner de error de paso */}
      {stepError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <svg
            aria-hidden="true"
            className="mt-0.5 w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          {stepError}
        </div>
      )}

      <WizardShell
        steps={activeSteps}
        onNext={handleNext}
        onPrev={handlePrev}
        onSaveDraft={handleSaveDraft}
        onCloseSession={handleCloseSession}
        isNextDisabled={isNextDisabled}
        isSaving={isSaving}
      >
        {currentComponent === 'StepGeneral' && (
          <StepGeneral
            clients={catalogs.clients}
            therapyTypes={catalogs.therapyTypes}
            value={generalData}
            onChange={setGeneralData}
            onSearchClients={(q) => searchClients(q)}
            disabled={isSaving}
          />
        )}

        {currentComponent === 'StepEnergyInitial' && (
          <StepEnergyInitial
            catalogDimensions={activeDimensions}
            readings={energyInitial}
            onChange={(id, val) => updateEnergyReading(setEnergyInitial, id, val)}
            disabled={isSaving}
          />
        )}

        {currentComponent === 'StepChakrasInitial' && (
          <StepChakrasInitial
            readings={chakraInitial}
            onChange={(id, val) => updateChakraReading(setChakraInitial, id, val)}
            disabled={isSaving}
          />
        )}

        {currentComponent === 'StepTopics' && (
          <StepTopics
            themes={themes}
            clientTopics={clientTopics}
            clientId={generalData.client_id}
            chakras={catalogs.chakras}
            onChange={handleThemesChange}
            disabled={isSaving}
          />
        )}

        {currentComponent === 'StepLNT' && (
          <div className="p-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
            StepLNT — próximamente
          </div>
        )}

        {currentComponent === 'StepCleaning' && (
          <div className="p-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
            StepCleaning — próximamente
          </div>
        )}

        {currentComponent === 'StepEnergyFinal' && (
          <StepEnergyFinal
            catalogDimensions={activeDimensions}
            readings={energyFinal}
            compareReadings={energyInitial}
            onChange={(id, val) => updateEnergyReading(setEnergyFinal, id, val)}
            disabled={isSaving}
          />
        )}

        {currentComponent === 'StepChakrasFinal' && (
          <StepChakrasFinal
            readings={chakraFinal}
            compareReadings={chakraInitial}
            onChange={(id, val) => updateChakraReading(setChakraFinal, id, val)}
            disabled={isSaving}
          />
        )}

        {currentComponent === 'StepClose' && (
          <StepClose
            value={closeData}
            onChange={(field, val) => setCloseData((prev) => ({ ...prev, [field]: val }))}
            summary={sessionSummary}
            onCloseSession={handleCloseSession}
            disabled={isSaving}
            isClosing={isSaving}
          />
        )}
      </WizardShell>
    </div>
  );
}
