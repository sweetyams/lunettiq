// PLP filter and sort types

export type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

export interface PLPFilters {
  shape: string[];
  colour: string[];
  material: string[];
  size: string[];
  sort: SortOption;
}
