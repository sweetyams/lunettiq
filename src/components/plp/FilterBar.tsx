'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Product } from '@/types/shopify';
import type { SortOption } from '@/types/filters';

interface ActiveFilters {
  shape: string[];
  colour: string[];
  material: string[];
  size: string[];
}

interface FilterBarProps {
  itemCount: number;
  sort: SortOption;
  filters: ActiveFilters;
  onSortChange: (sort: SortOption) => void;
  onFilterChange: (filters: ActiveFilters) => void;
  onClearFilters: () => void;
  products: Product[];
}

type FilterCategory = 'shape' | 'colour' | 'material' | 'size';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Featured' },
  { value: 'for-you', label: 'For You' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
];

const FILTER_CATEGORIES: { key: FilterCategory; label: string; tagPrefix: string }[] = [
  { key: 'shape', label: 'Shape', tagPrefix: 'shape:' },
  { key: 'colour', label: 'Colour', tagPrefix: 'colour:' },
  { key: 'material', label: 'Material', tagPrefix: 'material:' },
  { key: 'size', label: 'Size', tagPrefix: 'size:' },
];

/**
 * Extracts available filter values from product tags.
 * Tags follow the format: "shape:round", "colour:black", "material:acetate", "size:small"
 */
function extractFilterOptions(products: Product[]): Record<FilterCategory, string[]> {
  const options: Record<FilterCategory, Set<string>> = {
    shape: new Set(),
    colour: new Set(),
    material: new Set(),
    size: new Set(),
  };

  // Extract filter values from product tags (format: "shape:round", "colour:black", etc.)
  for (const product of products) {
    const tags = (product as Product & { tags?: string[] }).tags ?? [];
    for (const tag of tags) {
      for (const cat of FILTER_CATEGORIES) {
        if (tag.toLowerCase().startsWith(cat.tagPrefix)) {
          const value = tag.slice(cat.tagPrefix.length).trim();
          if (value) options[cat.key].add(value);
        }
      }
    }
  }

  return {
    shape: Array.from(options.shape).sort(),
    colour: Array.from(options.colour).sort(),
    material: Array.from(options.material).sort(),
    size: Array.from(options.size).sort(),
  };
}

export default function FilterBar({
  itemCount,
  sort,
  filters,
  onSortChange,
  onFilterChange,
  onClearFilters,
  products,
}: FilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<FilterCategory | 'sort' | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const filterOptions = useMemo(() => extractFilterOptions(products), [products]);

  const hasActiveFilters =
    filters.shape.length > 0 ||
    filters.colour.length > 0 ||
    filters.material.length > 0 ||
    filters.size.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFilterValue = useCallback(
    (category: FilterCategory, value: string) => {
      const current = filters[category];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFilterChange({ ...filters, [category]: updated });
    },
    [filters, onFilterChange]
  );

  const removeFilter = useCallback(
    (category: FilterCategory, value: string) => {
      const updated = filters[category].filter((v) => v !== value);
      onFilterChange({ ...filters, [category]: updated });
    },
    [filters, onFilterChange]
  );

  return (
    <div ref={barRef} className="mb-6">
      {/* Filter bar row */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4">
        {/* Item count */}
        <span className="text-sm text-gray-500 mr-2" suppressHydrationWarning>{itemCount} items</span>

        {/* Filter dropdowns */}
        {FILTER_CATEGORIES.map((cat) => {
          const options = filterOptions[cat.key];
          const activeCount = filters[cat.key].length;
          if (options.length === 0) return null;

          return (
            <div key={cat.key} className="relative">
              <button
                onClick={() =>
                  setOpenDropdown(openDropdown === cat.key ? null : cat.key)
                }
                className={`flex items-center gap-1 px-3 py-2 text-sm border rounded-full transition-colors min-h-[44px] ${
                  activeCount > 0
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 hover:border-gray-500'
                }`}
              >
                {cat.label}
                {activeCount > 0 && (
                  <span className="ml-1 text-xs">({activeCount})</span>
                )}
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>

              {openDropdown === cat.key && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-2">
                  {options.map((option) => {
                    const isActive = filters[cat.key].includes(option);
                    return (
                      <button
                        key={option}
                        onClick={() => toggleFilterValue(cat.key, option)}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 min-h-[44px]"
                      >
                        <span
                          className={`w-4 h-4 border rounded flex items-center justify-center ${
                            isActive ? 'bg-black border-black' : 'border-gray-300'
                          }`}
                        >
                          {isActive && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="capitalize">{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === 'sort' ? null : 'sort')
            }
            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-full hover:border-gray-500 transition-colors min-h-[44px]"
          >
            Sort: {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Featured'}
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>

          {openDropdown === 'sort' && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] py-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setOpenDropdown(null);
                  }}
                  className={`block w-full px-4 py-2 text-sm text-left hover:bg-gray-50 min-h-[44px] ${
                    sort === option.value ? 'font-medium' : ''
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {FILTER_CATEGORIES.map((cat) =>
            filters[cat.key].map((value) => (
              <span
                key={`${cat.key}-${value}`}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 rounded-full"
              >
                <span className="capitalize">
                  {cat.label}: {value}
                </span>
                <button
                  onClick={() => removeFilter(cat.key, value)}
                  className="ml-1 hover:text-black min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
                  aria-label={`Remove ${cat.label}: ${value} filter`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))
          )}
          <button
            onClick={onClearFilters}
            className="text-xs text-gray-500 underline hover:text-black ml-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
