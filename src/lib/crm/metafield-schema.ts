/**
 * Canonical product metafield schema.
 * Defines the new grouped structure and maps from old Shopify keys.
 */

export interface MetafieldGroup {
  key: string;       // group key e.g. 'details', 'design'
  label: string;     // display label
  fields: MetafieldField[];
}

export interface MetafieldField {
  key: string;       // new canonical key e.g. 'product_name'
  label: string;     // display label
  group: string;     // group key
  unit?: string;     // suffix e.g. ' mm', ' g'
}

export const METAFIELD_GROUPS: MetafieldGroup[] = [
  {
    key: 'details', label: 'Product Details',
    fields: [
      { key: 'product_name', label: 'Product Name', group: 'details' },
      { key: 'product_type', label: 'Product Type', group: 'details' },
      { key: 'collection', label: 'Collection', group: 'details' },
    ],
  },
  {
    key: 'design', label: 'Frame Design',
    fields: [
      { key: 'frame_shape', label: 'Frame Shape', group: 'design' },
      { key: 'frame_thickness', label: 'Frame Thickness', group: 'design' },
      { key: 'brow_line', label: 'Brow Line', group: 'design' },
      { key: 'bridge_shape', label: 'Bridge Shape', group: 'design' },
      { key: 'temple_thickness', label: 'Temple Thickness', group: 'design' },
      { key: 'temple_split', label: 'Temple Split', group: 'design' },
      { key: 'frame_construction', label: 'Frame Construction', group: 'design' },
    ],
  },
  {
    key: 'materials_components', label: 'Materials & Components',
    fields: [
      { key: 'frame_material', label: 'Frame Material', group: 'materials_components' },
      { key: 'nose_pad_type', label: 'Nose Pad Type', group: 'materials_components' },
      { key: 'nose_fit', label: 'Nose Fit', group: 'materials_components' },
      { key: 'frame_finish', label: 'Frame Finish', group: 'materials_components' },
      { key: 'frame_pattern', label: 'Frame Pattern', group: 'materials_components' },
    ],
  },
  {
    key: 'fit_sizing', label: 'Fit & Sizing',
    fields: [
      { key: 'face_width_fit', label: 'Face Fit Width', group: 'fit_sizing' },
      { key: 'lens_width', label: 'Lens Width', group: 'fit_sizing', unit: ' mm' },
      { key: 'bridge_width', label: 'Bridge Width', group: 'fit_sizing', unit: ' mm' },
      { key: 'temple_length', label: 'Temple Length', group: 'fit_sizing', unit: ' mm' },
      { key: 'lens_height', label: 'Lens Height', group: 'fit_sizing', unit: ' mm' },
      { key: 'front_height', label: 'Front Height', group: 'fit_sizing', unit: ' mm' },
      { key: 'overall_frame_width', label: 'Overall Frame Width', group: 'fit_sizing', unit: ' mm' },
      { key: 'weight_grams', label: 'Weight', group: 'fit_sizing', unit: ' g' },
    ],
  },
  {
    key: 'compatibility', label: 'Compatibility',
    fields: [
      { key: 'prescription_compatible', label: 'Prescription Compatible', group: 'compatibility' },
      { key: 'progressive_suitable', label: 'Progressive Suitable', group: 'compatibility' },
      { key: 'high_prescription_suitable', label: 'High Prescription Suitable', group: 'compatibility' },
      { key: 'clip_on_compatible', label: 'Clip-On Compatible', group: 'compatibility' },
    ],
  },
  {
    key: 'colour', label: 'Colour',
    fields: [
      { key: 'primary_frame_colour', label: 'Primary Frame Colour', group: 'colour' },
      { key: 'secondary_frame_colour', label: 'Secondary Frame Colour', group: 'colour' },
      { key: 'default_lens_colour', label: 'Default Lens Colour', group: 'colour' },
    ],
  },
];

/** All canonical field keys */
export const ALL_FIELD_KEYS = METAFIELD_GROUPS.flatMap(g => g.fields.map(f => f.key));

/** Lookup field by key */
export const FIELD_MAP = new Map(METAFIELD_GROUPS.flatMap(g => g.fields.map(f => [f.key, f])));

/** Unit suffixes by key */
export const UNIT_SUFFIXES: Record<string, string> = Object.fromEntries(
  METAFIELD_GROUPS.flatMap(g => g.fields.filter(f => f.unit).map(f => [f.key, f.unit!]))
);

/**
 * Map from old Shopify metafield keys (custom namespace) to new canonical keys.
 * Keys not in this map pass through unchanged if they match a canonical key.
 */
export const OLD_KEY_MAP: Record<string, string> = {
  // Old sizing keys → new
  frame_width: 'overall_frame_width',
  // Old material keys → new
  material_type: 'frame_material',
  // Old classification keys → new
  shape: 'frame_shape',
  frame_colour: 'primary_frame_colour',
  // Old Rx keys → new
  rx_compatible: 'prescription_compatible',
  progressive_compatible: 'progressive_suitable',
  // Old product_category → product_type
  product_category: 'product_type',
};

/**
 * Remap a flat {key: value} object from old keys to new canonical keys.
 * Preserves old keys alongside new ones for comparison.
 */
export function remapMetafields(old: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(old)) {
    if (v == null || v === '') continue;
    const newKey = OLD_KEY_MAP[k] ?? k;
    // New key takes precedence — don't overwrite if already set
    if (!result[newKey]) result[newKey] = v;
    // Keep old key too for comparison period
    if (newKey !== k) result[k] = v;
  }
  return result;
}
