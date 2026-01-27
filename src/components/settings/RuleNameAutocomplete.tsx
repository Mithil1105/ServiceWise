import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchRuleNames } from '@/hooks/use-services';
import { cn } from '@/lib/utils';
import { Wrench } from 'lucide-react';

interface RuleNameAutocompleteProps {
  ruleName: string;
  onRuleNameChange: (name: string) => void;
  required?: boolean;
}

export function RuleNameAutocomplete({
  ruleName,
  onRuleNameChange,
  required = false,
}: RuleNameAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: suggestions = [] } = useSearchRuleNames(searchValue);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRuleNameChange = (value: string) => {
    onRuleNameChange(value);
    setSearchValue(value);
    setShowSuggestions(value.length >= 2 && suggestions.length > 0);
  };

  const handleSelectRuleName = (selectedName: string) => {
    onRuleNameChange(selectedName);
    setSearchValue(selectedName);
    setShowSuggestions(false);
  };

  return (
    <div ref={containerRef} className="space-y-2 relative">
      <Label htmlFor="rule-name">
        Rule Name {required && <span className="text-destructive">*</span>}
      </Label>
      
      <Input
        id="rule-name"
        value={ruleName}
        onChange={(e) => handleRuleNameChange(e.target.value)}
        placeholder="e.g., Engine Oil Change"
        autoComplete="off"
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
          {suggestions.map((name, index) => (
            <button
              key={index}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors",
                "border-b last:border-b-0"
              )}
              onClick={() => handleSelectRuleName(name)}
            >
              <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
