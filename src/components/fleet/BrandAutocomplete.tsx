import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrands, useSearchBrands } from '@/hooks/use-brands';
import { cn } from '@/lib/utils';
import { Car } from 'lucide-react';

interface BrandAutocompleteProps {
  brand: string;
  onBrandChange: (brand: string) => void;
  required?: boolean;
}

export function BrandAutocomplete({
  brand,
  onBrandChange,
  required = false,
}: BrandAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: allBrands = [] } = useBrands();
  const { data: suggestions = [] } = useSearchBrands(searchValue);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBrandChange = (value: string) => {
    onBrandChange(value);
    setSearchValue(value);
    setShowSuggestions(value.length >= 1);
  };

  const handleSelectBrand = (selectedBrand: string) => {
    onBrandChange(selectedBrand);
    setSearchValue(selectedBrand);
    setShowSuggestions(false);
  };

  const handleDropdownSelect = (selectedBrand: string) => {
    if (selectedBrand && selectedBrand !== 'none') {
      handleSelectBrand(selectedBrand);
    }
  };

  return (
    <div ref={containerRef} className="space-y-2 relative">
      <Label htmlFor="brand">
        Brand {required && <span className="text-destructive">*</span>}
      </Label>
      
      {/* Dropdown to select from existing brands */}
      <Select value={brand || ''} onValueChange={handleDropdownSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Choose from existing brands..." />
        </SelectTrigger>
        <SelectContent>
          {allBrands.length === 0 ? (
            <SelectItem value="none" disabled>No brands found</SelectItem>
          ) : (
            allBrands.map(brandName => (
              <SelectItem key={brandName} value={brandName}>
                {brandName}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Or enter manually with autocomplete */}
      <Input
        id="brand"
        value={brand}
        onChange={e => handleBrandChange(e.target.value)}
        placeholder="Or type brand name (e.g., Toyota, Maruti)"
        autoComplete="off"
        className="mt-2"
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
          {suggestions.map(brandName => (
            <button
              key={brandName}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors",
                "border-b last:border-b-0"
              )}
              onClick={() => handleSelectBrand(brandName)}
            >
              <Car className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{brandName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
