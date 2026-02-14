import { useCallback, useState } from 'react';
import { notify } from '@/lib/store/app-store';
import type { InventoryPickerItem } from '@/components/klaviyo/types';

interface UseKlaviyoInventoryPickerOptions {
  maxPickerSelect: number;
}

export function useKlaviyoInventoryPicker({ maxPickerSelect }: UseKlaviyoInventoryPickerOptions) {
  const [filterListingTypes, setFilterListingTypes] = useState<string[]>(['new', 'trade_in', 'ex_demo']);
  const [filterLimit, setFilterLimit] = useState(10);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);
  const [pickerItems, setPickerItems] = useState<InventoryPickerItem[]>([]);
  const [pickerTotal, setPickerTotal] = useState(0);
  const [pickerOffset, setPickerOffset] = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerListingType, setPickerListingType] = useState<string>('all');

  const fetchInventoryForPicker = useCallback(async (opts?: { search?: string; listingType?: string; offset?: number }) => {
    const search = opts?.search ?? pickerSearch;
    const listingType = opts?.listingType ?? pickerListingType;
    const offset = opts?.offset ?? 0;
    setPickerLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('offset', String(offset));
      if (search.trim()) params.set('search', search.trim());
      if (listingType && listingType !== 'all') params.set('listing_type', listingType);
      const res = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      if (data.error || !res.ok) {
        setPickerItems([]);
        setPickerTotal(0);
        return;
      }
      setPickerItems((data.items ?? []).map((r: { id: string; brand: string; model: string; title: string | null; sale_price: number; listing_type: string; image_urls: string[] }) => ({
        id: r.id,
        brand: r.brand,
        model: r.model,
        title: r.title,
        sale_price: r.sale_price,
        listing_type: r.listing_type,
        image_urls: Array.isArray(r.image_urls) ? r.image_urls : [],
      })));
      setPickerTotal(data.total ?? data.items?.length ?? 0);
      setPickerOffset(offset);
    } finally {
      setPickerLoading(false);
    }
  }, [pickerSearch, pickerListingType]);

  const quickFillFromFilter = useCallback(async () => {
    setPickerLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(Math.min(filterLimit, maxPickerSelect)));
      if (filterListingTypes.length) {
        filterListingTypes.forEach((t) => params.append('listing_type', t));
      }
      const res = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      if (data.error || !res.ok) {
        notify.error('Quick fill failed', data.error?.message ?? 'Could not load inventory');
        return;
      }
      const ids = (data.items ?? []).map((r: { id: string }) => r.id).slice(0, maxPickerSelect);
      setSelectedInventoryIds(ids);
      notify.success('Quick fill', `Selected ${ids.length} product(s) from filter`);
    } finally {
      setPickerLoading(false);
    }
  }, [filterListingTypes, filterLimit, maxPickerSelect]);

  const togglePickerProduct = useCallback((id: string) => {
    setSelectedInventoryIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxPickerSelect) return prev;
      return [...prev, id];
    });
  }, [maxPickerSelect]);

  const clearPickerSelection = useCallback(() => setSelectedInventoryIds([]), []);

  const toggleFilterListingType = useCallback((listingType: string) => {
    setFilterListingTypes((prev) =>
      prev.includes(listingType) ? prev.filter((x) => x !== listingType) : [...prev, listingType]
    );
  }, []);

  return {
    filterListingTypes,
    setFilterListingTypes,
    filterLimit,
    setFilterLimit,
    selectedInventoryIds,
    setSelectedInventoryIds,
    pickerItems,
    pickerTotal,
    pickerOffset,
    pickerLoading,
    pickerSearch,
    setPickerSearch,
    pickerListingType,
    setPickerListingType,
    fetchInventoryForPicker,
    quickFillFromFilter,
    togglePickerProduct,
    clearPickerSelection,
    toggleFilterListingType,
  };
}
