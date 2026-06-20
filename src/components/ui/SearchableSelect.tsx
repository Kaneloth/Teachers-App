/**
 * SearchableSelect — a dropdown with a built-in search box.
 * Drop-in replacement for shadcn <Select> for long lists.
 *
 * Usage:
 *   <SearchableSelect
 *     value={value}
 *     onValueChange={setValue}
 *     options={['Option A', 'Option B', ...]}
 *     placeholder="Select an option"
 *     searchPlaceholder="Search..."
 *     disabled={false}
 *   />
 *
 * Place at: src/components/ui/SearchableSelect.tsx
 */

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  className,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (option: string) => {
    onValueChange(option);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between rounded-xl font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 rounded-xl shadow-lg border border-border"
        align="start"
        sideOffset={4}
      >
        {/* Search box */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        {/* Options list */}
        <div className="max-h-52 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No results found</p>
          ) : (
            filtered.map(option => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors',
                  option === value && 'bg-primary/5 font-medium text-primary'
                )}
              >
                <Check
                  className={cn('w-3.5 h-3.5 shrink-0', option === value ? 'text-primary opacity-100' : 'opacity-0')}
                />
                {option}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
