'use client';

import { useReducer, useCallback, useMemo, useEffect } from 'react';
import type {
  LensConfiguration,
  LensType,
  LensIndex,
  LensCoating,
  SunLensOptions,
  PrescriptionData,
  ConfiguratorStep,
} from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';
import LensTypeStep from './configurator/LensTypeStep';
import LensIndexStep from './configurator/LensIndexStep';
import CoatingsStep from './configurator/CoatingsStep';
import PrescriptionStep from './configurator/PrescriptionStep';
import ConfigSummary from './configurator/ConfigSummary';
import RunningPriceTotal from './configurator/RunningPriceTotal';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConfiguratorState {
  config: LensConfiguration;
  currentStep: ConfiguratorStep;
  /** Readers magnification stored separately */
  readersMagnification: number | null;
}

type ConfiguratorAction =
  | { type: 'SET_LENS_TYPE'; payload: LensType }
  | { type: 'SET_LENS_INDEX'; payload: LensIndex }
  | { type: 'SET_COATINGS'; payload: LensCoating[] }
  | { type: 'SET_SUN_OPTIONS'; payload: SunLensOptions | null }
  | { type: 'SET_PRESCRIPTION'; payload: PrescriptionData | null; method: LensConfiguration['prescriptionMethod'] }
  | { type: 'SET_READERS_MAGNIFICATION'; payload: number }
  | { type: 'GO_TO_STEP'; payload: ConfiguratorStep }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'RESET' };

interface LensConfiguratorProps {
  lensOptions: LensOption[];
  isSunglasses: boolean;
  frameBasePrice: number;
  frameName: string;
  frameColour: string | null;
  onConfigChange?: (config: LensConfiguration, currentStep: ConfiguratorStep) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const RX_TYPES: LensType[] = ['singleVision', 'progressive', 'prescriptionSun'];

export function requiresPrescription(lensType: LensType | null): boolean {
  return lensType != null && RX_TYPES.includes(lensType);
}

export function isReaders(lensType: LensType | null): boolean {
  return lensType === 'readers';
}

/** Ordered steps for a given lens type */
export function stepsForType(lensType: LensType | null): ConfiguratorStep[] {
  const base: ConfiguratorStep[] = ['lensType', 'lensIndex', 'coatings'];
  if (lensType && requiresPrescription(lensType)) {
    return [...base, 'prescription', 'summary'];
  }
  if (lensType && isReaders(lensType)) {
    // readers use the prescription step for magnification selector
    return [...base, 'prescription', 'summary'];
  }
  // nonPrescription / nonPrescriptionSun skip Rx
  return [...base, 'summary'];
}

function nextStep(current: ConfiguratorStep, lensType: LensType | null): ConfiguratorStep {
  const steps = stepsForType(lensType);
  const idx = steps.indexOf(current);
  return idx < steps.length - 1 ? steps[idx + 1] : current;
}

function prevStep(current: ConfiguratorStep, lensType: LensType | null): ConfiguratorStep {
  const steps = stepsForType(lensType);
  const idx = steps.indexOf(current);
  return idx > 0 ? steps[idx - 1] : current;
}

/** Check if a lens index is compatible with the new lens type */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isIndexCompatible(index: LensIndex | null, _lensType: LensType): boolean {
  // All indices are generally compatible; specific incompatibilities can be
  // driven by LensOption.compatibleLensTypes from metaobjects at runtime.
  // For now, all are compatible.
  if (!index) return true;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

const initialConfig: LensConfiguration = {
  lensType: null,
  lensIndex: null,
  coatings: [],
  sunOptions: null,
  prescription: null,
  prescriptionMethod: null,
};

const initialState: ConfiguratorState = {
  config: initialConfig,
  currentStep: 'lensType',
  readersMagnification: null,
};

function configuratorReducer(state: ConfiguratorState, action: ConfiguratorAction): ConfiguratorState {
  switch (action.type) {
    case 'SET_LENS_TYPE': {
      const newType = action.payload;
      const prev = state.config;
      // Invalidation: clear lensIndex if incompatible
      const keepIndex = isIndexCompatible(prev.lensIndex, newType);
      // Invalidation: clear prescription if new type doesn't need Rx
      const keepRx = requiresPrescription(newType) && requiresPrescription(prev.lensType);
      // Clear sun options if switching away from sun types
      const isSunType = newType === 'prescriptionSun' || newType === 'nonPrescriptionSun';
      const wasSunType = prev.lensType === 'prescriptionSun' || prev.lensType === 'nonPrescriptionSun';
      const keepSun = isSunType && wasSunType;

      return {
        ...state,
        config: {
          ...prev,
          lensType: newType,
          lensIndex: keepIndex ? prev.lensIndex : null,
          prescription: keepRx ? prev.prescription : null,
          prescriptionMethod: keepRx ? prev.prescriptionMethod : null,
          sunOptions: keepSun ? prev.sunOptions : null,
        },
        currentStep: 'lensIndex',
        readersMagnification: newType === 'readers' ? state.readersMagnification : null,
      };
    }

    case 'SET_LENS_INDEX':
      // Changing lensIndex does NOT affect coatings
      return {
        ...state,
        config: { ...state.config, lensIndex: action.payload },
      };

    case 'SET_COATINGS':
      return {
        ...state,
        config: { ...state.config, coatings: action.payload },
      };

    case 'SET_SUN_OPTIONS':
      return {
        ...state,
        config: { ...state.config, sunOptions: action.payload },
      };

    case 'SET_PRESCRIPTION':
      return {
        ...state,
        config: {
          ...state.config,
          prescription: action.payload,
          prescriptionMethod: action.method,
        },
      };

    case 'SET_READERS_MAGNIFICATION':
      return {
        ...state,
        readersMagnification: action.payload,
      };

    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload };

    case 'NEXT_STEP':
      return { ...state, currentStep: nextStep(state.currentStep, state.config.lensType) };

    case 'PREV_STEP':
      return { ...state, currentStep: prevStep(state.currentStep, state.config.lensType) };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Step Indicator                                                     */
/* ------------------------------------------------------------------ */

const STEP_LABELS: Record<ConfiguratorStep, string> = {
  lensType: 'Lens Type',
  lensIndex: 'Material',
  coatings: 'Coatings',
  prescription: 'Prescription',
  summary: 'Summary',
};

function StepIndicator({
  steps,
  currentStep,
  config,
  onStepClick,
}: {
  steps: ConfiguratorStep[];
  currentStep: ConfiguratorStep;
  config: LensConfiguration;
  onStepClick: (step: ConfiguratorStep) => void;
}) {
  const currentIdx = steps.indexOf(currentStep);

  function isCompleted(step: ConfiguratorStep): boolean {
    switch (step) {
      case 'lensType': return config.lensType !== null;
      case 'lensIndex': return config.lensIndex !== null;
      case 'coatings': return true; // coatings can be empty (valid)
      case 'prescription': return config.prescriptionMethod !== null;
      case 'summary': return false;
      default: return false;
    }
  }

  return (
    <nav aria-label="Configurator steps" className="flex items-center gap-1 mb-6 overflow-x-auto">
      {steps.map((step, idx) => {
        const completed = isCompleted(step) && idx < currentIdx;
        const isCurrent = step === currentStep;
        const canClick = idx < currentIdx || completed;

        return (
          <div key={step} className="flex items-center">
            {idx > 0 && <div className="w-4 h-px bg-gray-300 mx-1" />}
            <button
              type="button"
              onClick={() => canClick && onStepClick(step)}
              disabled={!canClick}
              className={`
                text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors
                ${isCurrent ? 'bg-black text-white' : ''}
                ${completed && !isCurrent ? 'bg-gray-200 text-black' : ''}
                ${!completed && !isCurrent ? 'bg-gray-100 text-gray-400' : ''}
                ${canClick ? 'cursor-pointer hover:bg-gray-300' : 'cursor-default'}
              `}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {completed && !isCurrent && <span className="mr-1">✓</span>}
              {STEP_LABELS[step]}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function LensConfigurator({
  lensOptions,
  isSunglasses,
  frameBasePrice,
  frameName,
  frameColour,
  onConfigChange,
}: LensConfiguratorProps) {
  const [state, dispatch] = useReducer(configuratorReducer, initialState);
  const { config, currentStep, readersMagnification } = state;

  const steps = useMemo(() => stepsForType(config.lensType), [config.lensType]);

  // Notify parent of config changes
  useEffect(() => {
    onConfigChange?.(config, currentStep);
  }, [config, currentStep, onConfigChange]);

  const goToStep = useCallback((step: ConfiguratorStep) => {
    dispatch({ type: 'GO_TO_STEP', payload: step });
  }, []);

  const goNext = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);
  const goPrev = useCallback(() => dispatch({ type: 'PREV_STEP' }), []);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-2">Configure Your Lenses</h3>

      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        config={config}
        onStepClick={goToStep}
      />

      {/* Running price — always visible */}
      <RunningPriceTotal
        config={config}
        lensOptions={lensOptions}
        frameBasePrice={frameBasePrice}
      />

      {/* Step content */}
      <div className="mt-4">
        {currentStep === 'lensType' && (
          <LensTypeStep
            selected={config.lensType}
            isSunglasses={isSunglasses}
            lensOptions={lensOptions}
            onSelect={(lt) => dispatch({ type: 'SET_LENS_TYPE', payload: lt })}
          />
        )}

        {currentStep === 'lensIndex' && (
          <LensIndexStep
            selected={config.lensIndex}
            lensType={config.lensType}
            lensOptions={lensOptions}
            onSelect={(li) => {
              dispatch({ type: 'SET_LENS_INDEX', payload: li });
              goNext();
            }}
            onBack={goPrev}
          />
        )}

        {currentStep === 'coatings' && (
          <CoatingsStep
            selectedCoatings={config.coatings}
            sunOptions={config.sunOptions}
            isSunglasses={isSunglasses}
            lensType={config.lensType}
            lensOptions={lensOptions}
            onCoatingsChange={(c) => dispatch({ type: 'SET_COATINGS', payload: c })}
            onSunOptionsChange={(s) => dispatch({ type: 'SET_SUN_OPTIONS', payload: s })}
            onNext={goNext}
            onBack={goPrev}
          />
        )}

        {currentStep === 'prescription' && (
          <PrescriptionStep
            lensType={config.lensType}
            prescription={config.prescription}
            prescriptionMethod={config.prescriptionMethod}
            readersMagnification={readersMagnification}
            onSubmit={(rx, method) => {
              dispatch({ type: 'SET_PRESCRIPTION', payload: rx, method });
              goNext();
            }}
            onMagnificationChange={(m) =>
              dispatch({ type: 'SET_READERS_MAGNIFICATION', payload: m })
            }
            onBack={goPrev}
          />
        )}

        {currentStep === 'summary' && (
          <ConfigSummary
            config={config}
            lensOptions={lensOptions}
            frameBasePrice={frameBasePrice}
            frameName={frameName}
            frameColour={frameColour}
            readersMagnification={readersMagnification}
            onEdit={goToStep}
            onBack={goPrev}
          />
        )}
      </div>
    </div>
  );
}

export { configuratorReducer, initialState, initialConfig };
export type { ConfiguratorState, ConfiguratorAction };
