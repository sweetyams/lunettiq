'use client';

import { useState } from 'react';
import { ProductsClient } from './ProductsClient';
import { FamiliesView } from './FamiliesView';

export function CatalogueShell() {
  const [view, setView] = useState<'products' | 'families'>('products');
  return view === 'products'
    ? <ProductsClient activeView={view} onSwitchView={setView} />
    : <FamiliesView activeView={view} onSwitchView={setView} />;
}
