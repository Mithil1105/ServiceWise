import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDrivers, useSearchDrivers, Driver } from '@/hooks/use-drivers';
import { cn } from '@/lib/utils';
import { User, Phone } from 'lucide-react';

interface DriverAutocompleteProps {
  driverName: string;
  driverPhone: string;
  onNameChange: (name: string) => void;
  onPhoneChange: (phone: string) => void;
  onSelectDriver?: (driver: Driver) => void;
}

export function DriverAutocomplete({
  driverName,
  driverPhone,
  onNameChange,
  onPhoneChange,
  onSelectDriver,
}: DriverAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: allDrivers = [] } = useDrivers();
  const { data: suggestions = [] } = useSearchDrivers(searchValue);

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
    setShowSuggestions(value.length >= 2);
  };

  const handlePhoneChange = (value: string) => {
    onPhoneChange(value);
    setSearchValue(value);
    setShowSuggestions(value.length >= 2);
  };

  const handleSelectDriver = (driver: Driver) => {
    onNameChange(driver.name);
    onPhoneChange(driver.phone);
    setShowSuggestions(false);
    onSelectDriver?.(driver);
  };

  return (
    <div ref={containerRef} className="space-y-2 relative">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Driver Name</Label>
          <Input
            value={driverName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Start typing to search..."
            autoComplete="off"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Driver Phone</Label>
          <Input
            value={driverPhone}
            onChange={e => handlePhoneChange(e.target.value)}
            placeholder="Enter phone number"
            autoComplete="off"
            className="h-8 text-sm"
          />
        </div>
      </div>
      
      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
          {suggestions.map(driver => (
            <button
              key={driver.id}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors",
                "border-b last:border-b-0"
              )}
              onClick={() => handleSelectDriver(driver)}
            >
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{driver.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {driver.phone}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
