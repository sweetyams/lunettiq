// Customer account types

import type { EyeRx } from './configurator';

export interface WishlistData {
  productIds: string[];
}

export interface PrescriptionRecord {
  id: string;                // UUID
  optometristName: string;
  date: string;              // ISO date string
  od: EyeRx;                // Right eye
  os: EyeRx;                // Left eye
  pd: number;               // Pupillary distance
}

export interface LoyaltyData {
  tier: 'essential' | 'cult' | 'vault';
  points: number;
  nextTierThreshold: number;
}
