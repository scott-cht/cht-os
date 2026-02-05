/**
 * Filter Presets Storage
 * Manages saved filter views in localStorage
 */

import type { FilterPreset, FilterPresetInput, InventoryFilters } from '@/types/filters';
import { SYSTEM_PRESETS } from '@/types/filters';

const STORAGE_KEY = 'cht_filter_presets';

/**
 * Generate a unique ID for a preset
 */
function generateId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all presets (system + custom)
 */
export function getAllPresets(): FilterPreset[] {
  const systemPresets: FilterPreset[] = SYSTEM_PRESETS.map(preset => ({
    ...preset,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }));
  
  const customPresets = getCustomPresets();
  
  return [...systemPresets, ...customPresets];
}

/**
 * Get only custom (user-created) presets
 */
export function getCustomPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const presets = JSON.parse(stored) as FilterPreset[];
    return presets.filter(p => !p.isSystem);
  } catch (error) {
    console.error('Failed to load filter presets:', error);
    return [];
  }
}

/**
 * Save a new filter preset
 */
export function savePreset(input: FilterPresetInput): FilterPreset {
  const now = new Date().toISOString();
  const preset: FilterPreset = {
    id: generateId(),
    name: input.name.trim(),
    icon: input.icon || '📋',
    filters: input.filters,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  };
  
  const existing = getCustomPresets();
  const updated = [...existing, preset];
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  
  return preset;
}

/**
 * Update an existing custom preset
 */
export function updatePreset(id: string, updates: Partial<FilterPresetInput>): FilterPreset | null {
  const presets = getCustomPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) return null;
  
  const preset = presets[index];
  if (preset.isSystem) {
    throw new Error('Cannot modify system presets');
  }
  
  const updated: FilterPreset = {
    ...preset,
    name: updates.name?.trim() ?? preset.name,
    icon: updates.icon ?? preset.icon,
    filters: updates.filters ?? preset.filters,
    updatedAt: new Date().toISOString(),
  };
  
  presets[index] = updated;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  
  return updated;
}

/**
 * Delete a custom preset
 */
export function deletePreset(id: string): boolean {
  const presets = getCustomPresets();
  const preset = presets.find(p => p.id === id);
  
  if (!preset) return false;
  if (preset.isSystem) {
    throw new Error('Cannot delete system presets');
  }
  
  const filtered = presets.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  
  return true;
}

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): FilterPreset | null {
  return getAllPresets().find(p => p.id === id) || null;
}

/**
 * Find presets matching current filters
 */
export function findMatchingPresets(currentFilters: InventoryFilters): FilterPreset[] {
  const all = getAllPresets();
  
  return all.filter(preset => {
    const pf = preset.filters;
    const cf = currentFilters;
    
    // Normalize comparison
    const normalize = (val: unknown) => 
      (val === 'all' || val === undefined || val === null || val === '') ? undefined : val;
    
    return (
      normalize(pf.listing_type) === normalize(cf.listing_type) &&
      normalize(pf.sync_status) === normalize(cf.sync_status) &&
      normalize(pf.listing_status) === normalize(cf.listing_status) &&
      normalize(pf.search) === normalize(cf.search) &&
      normalize(pf.minPrice) === normalize(cf.minPrice) &&
      normalize(pf.maxPrice) === normalize(cf.maxPrice)
    );
  });
}

/**
 * Count items that would match a preset (requires API call)
 * This is a placeholder - actual counts should come from the API
 */
export function getPresetCounts(): Record<string, number> {
  // This would ideally be fetched from the API
  // For now, return empty counts
  return {};
}
