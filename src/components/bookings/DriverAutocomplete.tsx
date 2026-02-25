import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSearchDrivers, useDrivers, Driver } from '@/hooks/use-drivers';
import { cn } from '@/lib/utils';
import { User, Phone, Users } from 'lucide-react';

interface DriverAutocompleteProps {
  driverName: string;
  driverPhone: string;
  onNameChange: (name: string) => void;
  onPhoneChange: (phone: string) => void;
  onSelectDriver?: (driver: Driver) => void;
  /** When set, only show drivers eligible for this vehicle class: LMV → LMV or HMV drivers; HMV → HMV only */
  vehicleClass?: 'lmv' | 'hmv';
}

export function DriverAutocomplete({
  driverName,
  driverPhone,
  onNameChange,
  onPhoneChange,
  onSelectDriver,
  vehicleClass,
}: DriverAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allDrivers = [] } = useDrivers();
  const { data: searchResults = [] } = useSearchDrivers(searchValue);

  const suggestions = useMemo(() => {
    const list = searchValue.trim().length >= 2 ? searchResults : allDrivers;
    if (!vehicleClass) return list;
    const type = (d: Driver) => d.license_type ?? 'lmv';
    if (vehicleClass === 'hmv') return list.filter((d) => type(d) === 'hmv');
    return list.filter((d) => type(d) === 'lmv' || type(d) === 'hmv');
  }, [searchValue, searchResults, allDrivers, vehicleClass]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNameChange = (value: string) => {
    onNameChange(value);
    setSearchValue(value);
    setShowSuggestions(true);
  };

  const handlePhoneChange = (value: string) => {
    onPhoneChange(value);
    setSearchValue(value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  const handleSelectDriver = (driver: Driver) => {
    onNameChange(driver.name);
    onPhoneChange(driver.phone);
    setShowSuggestions(false);
    onSelectDriver?.(driver);
  };

  const togglePhonebook = () => {
    setShowSuggestions((prev) => !prev);
    if (!showSuggestions) setSearchValue('');
  };

  return (
    <div ref={containerRef} className="space-y-2 relative">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Driver Name</Label>
          <div className="flex gap-1">
            <Input
              value={driverName}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={handleFocus}
              placeholder="Type to search or browse all..."
              autoComplete="off"
              className="h-8 text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={togglePhonebook}
              title="Browse all drivers"
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Driver Phone</Label>
          <Input
            value={driverPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onFocus={handleFocus}
            placeholder="Enter phone number"
            autoComplete="off"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Phonebook dropdown: all drivers or search results */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-56 overflow-y-auto">
          {suggestions.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {searchValue.trim().length >= 2 ? 'No drivers match your search.' : 'No drivers found.'}
            </div>
          ) : (
            <>
              {searchValue.trim().length < 2 && (
                <p className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/30 sticky top-0">
                  All drivers — type to filter
                </p>
              )}
              {suggestions.map((driver) => (
                <button
                  key={driver.id}
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors',
                    'border-b last:border-b-0'
                  )}
                  onClick={() => handleSelectDriver(driver)}
                >
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{driver.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {driver.phone}
                      <span className="ml-1">·</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">
                        {(driver.license_type ?? 'lmv') === 'hmv' ? 'HMV' : 'LMV'}
                      </Badge>
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
