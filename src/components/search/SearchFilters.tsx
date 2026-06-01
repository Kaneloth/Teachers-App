import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PROVINCES, SUBJECTS, PHASES } from '@/lib/constants';

interface Filters {
  province: string;
  subject: string;
  phase: string;
  activeOnly: boolean;
}

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export default function SearchFilters({ filters, onFiltersChange }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = [filters.province, filters.subject, filters.phase, filters.activeOnly].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 relative">
          <SlidersHorizontal className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="mb-6">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Province</Label>
            <Select value={filters.province || '__all__'} onValueChange={val => onFiltersChange({ ...filters, province: val === '__all__' ? '' : val })}>
              <SelectTrigger><SelectValue placeholder="All provinces" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All provinces</SelectItem>
                {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Phase</Label>
            <Select value={filters.phase || '__all__'} onValueChange={val => onFiltersChange({ ...filters, phase: val === '__all__' ? '' : val })}>
              <SelectTrigger><SelectValue placeholder="All phases" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All phases</SelectItem>
                {PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={filters.subject || '__all__'} onValueChange={val => onFiltersChange({ ...filters, subject: val === '__all__' ? '' : val })}>
              <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All subjects</SelectItem>
                {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-sm">Actively Looking Only</Label>
              <p className="text-xs text-muted-foreground">Only show educators ready to exchange</p>
            </div>
            <Switch checked={filters.activeOnly} onCheckedChange={val => onFiltersChange({ ...filters, activeOnly: val })} />
          </div>
          <Button className="w-full h-11 rounded-xl" onClick={() => setOpen(false)}>Apply Filters</Button>
          {activeCount > 0 && (
            <Button variant="ghost" className="w-full h-10 rounded-xl" onClick={() => { onFiltersChange({ province: '', subject: '', phase: '', activeOnly: false }); setOpen(false); }}>
              Clear All
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
