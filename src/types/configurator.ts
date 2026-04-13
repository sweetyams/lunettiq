// Lens Configurator types

export type ConfiguratorStep =
  | 'lensType'
  | 'lensIndex'
  | 'coatings'
  | 'prescription'
  | 'summary';

export type LensType =
  | 'singleVision'
  | 'progressive'
  | 'nonPrescription'
  | 'readers'
  | 'prescriptionSun'
  | 'nonPrescriptionSun';

export type LensIndex =
  | '1.50'
  | '1.61'
  | '1.67'
  | '1.74'
  | 'polycarbonate';

export type LensCoating =
  | 'antiReflective'
  | 'antiReflectivePremium'
  | 'blueLight'
  | 'photochromic'
  | 'scratchResistant'
  | 'hydrophobic'
  | 'oleophobic';

export type TintColour = 'gray' | 'brown' | 'green' | 'rose' | 'yellow';

export type MirrorCoating = 'silver' | 'gold' | 'blue' | 'green';

export interface SunLensOptions {
  tintColour: TintColour;
  polarized: boolean;
  mirrorCoating: MirrorCoating | null;
}

export interface EyeRx {
  sphere: number;      // -20.00 to +20.00, 0.25 steps
  cylinder: number;    // -6.00 to +6.00, 0.25 steps
  axis: number;        // 1-180 degrees
  addPower?: number;   // For progressive lenses
}

export interface PrescriptionData {
  od: EyeRx;           // Right eye
  os: EyeRx;           // Left eye
  pd: number;          // Pupillary distance (50-80mm)
}

export interface LensConfiguration {
  lensType: LensType | null;
  lensIndex: LensIndex | null;
  coatings: LensCoating[];
  sunOptions: SunLensOptions | null;
  prescription: PrescriptionData | null;
  prescriptionMethod: 'manual' | 'upload' | 'sendLater' | 'saved' | null;
}
