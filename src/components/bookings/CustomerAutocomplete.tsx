import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomers, useSearchCustomers, Customer } from '@/hooks/use-customers';
import { cn } from '@/lib/utils';
import { User, Phone } from 'lucide-react';

interface CustomerAutocompleteProps {
  customerName: string;
  customerPhone: string;
  onNameChange: (name: string) => void;
  onPhoneChange: (phone: string) => void;
  onSelectCustomer?: (customer: Customer) => void;
}

export function CustomerAutocomplete({
  customerName,
  customerPhone,
  onNameChange,
  onPhoneChange,
  onSelectCustomer,
}: CustomerAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: allCustomers = [] } = useCustomers();
  const { data: suggestions = [] } = useSearchCustomers(searchValue);

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

  const handleSelectCustomer = (customer: Customer) => {
    onNameChange(customer.name);
    onPhoneChange(customer.phone);
    setShowSuggestions(false);
    onSelectCustomer?.(customer);
  };

  const handleDropdownSelect = (customerId: string) => {
    const customer = allCustomers.find(c => c.id === customerId);
    if (customer) {
      handleSelectCustomer(customer);
    }
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Dropdown to select from existing customers */}
      <div className="space-y-2">
        <Label>Select Existing Customer</Label>
        <Select onValueChange={handleDropdownSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Choose from phonebook..." />
          </SelectTrigger>
          <SelectContent>
            {allCustomers.length === 0 ? (
              <SelectItem value="none" disabled>No customers saved yet</SelectItem>
            ) : (
              allCustomers.map(customer => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Or enter manually with autocomplete */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        <div className="space-y-2">
          <Label>Customer Name *</Label>
          <Input
            value={customerName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Start typing to search..."
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label>Phone *</Label>
          <Input
            value={customerPhone}
            onChange={e => handlePhoneChange(e.target.value)}
            placeholder="Enter phone number"
            autoComplete="off"
          />
        </div>
        
        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
            {suggestions.map(customer => (
              <button
                key={customer.id}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors",
                  "border-b last:border-b-0"
                )}
                onClick={() => handleSelectCustomer(customer)}
              >
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{customer.name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {customer.phone}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
