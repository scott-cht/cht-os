'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface SearchFormProps {
  onSearch: (brand: string, modelNumber: string) => void;
  isLoading?: boolean;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (brand.trim() && modelNumber.trim()) {
      onSearch(brand.trim(), modelNumber.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="brand"
          label="Brand"
          placeholder="e.g. Samsung, Dyson, LG"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          disabled={isLoading}
          required
        />
        <Input
          id="modelNumber"
          label="Model Number"
          placeholder="e.g. WF45R6100AW, V15"
          value={modelNumber}
          onChange={(e) => setModelNumber(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>
      <Button 
        type="submit" 
        size="lg" 
        isLoading={isLoading}
        disabled={!brand.trim() || !modelNumber.trim()}
        className="w-full md:w-auto"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Search Australian Retailers
      </Button>
    </form>
  );
}
