import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, Lock, Zap } from 'lucide-react';

const PROVINCES = ['Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Mpumalanga', 'Limpopo', 'North West', 'Free State', 'Northern Cape'];
const SUBJECTS = [
  'Mathematics', 'Mathematical Literacy', 'Physical Sciences', 'Life Sciences',
  'English HL', 'English FAL', 'Afrikaans HL', 'Afrikaans FAL',
  'isiZulu HL', 'isiZulu FAL', 'isiXhosa HL', 'History', 'Geography',
  'Business Studies', 'Accounting', 'Economics', 'Life Orientation',
  'Computer Applications Technology', 'Information Technology',
  'Agricultural Sciences', 'Natural Sciences', 'Social Sciences',
];
const PHASES = ['Foundation', 'Intermediate', 'Senior', 'FET'];

export { PROVINCES };

export interface Filters {
  province: string;
  subject: string;
  phase: string;
  activeOnly: boolean;
}

interface Props {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  isPro?: boolean;
  onProGate?: () => void;
}

export default function SearchFilters({ filters, onFiltersChange, isPro = false, onProGate }: Props) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Filters>(filters);

  const handleApply = () => { onFiltersChange(local); setOpen(false); };
  const handleReset = () => {
    const reset: Filters = { province: '', subject: '', phase: '', activeOnly: false };
    setLocal(reset); onFiltersChange(reset); setOpen(false);
  };

  const activeCount = [local.province, local.subject, local.phase, local.activeOnly].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full border-border">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 min-w-[18px]">{activeCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between pb-4">
          <SheetTitle className="text-lg">Filters</SheetTitle>
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">Reset</Button>
        </SheetHeader>
        <div className="space-y-6 pb-6">

          {/* Province — Pro only */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium">Province</Label>
              {!isPro && <Lock className="w-3 h-3 text-muted-foreground" />}
            </div>
            {isPro ? (
              <Select value={local.province} onValueChange={v => setLocal(p => ({ ...p, province: v }))}>
                <SelectTrigger><SelectValue placeholder="All provinces" /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <button
                type="button"
                onClick={() => { setOpen(false); onProGate?.(); }}
                className="w-full flex items-center justify-between px-3 h-10 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <span>All provinces</span>
                <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
                  <Zap className="w-3 h-3" /> Pro
                </div>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Subject (CAPS)</Label>
            <Select value={local.subject} onValueChange={v => setLocal(p => ({ ...p, subject: v }))}>
              <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
			  <SelectContent className="max-h-48 overflow-y-auto">{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Phase</Label>
            <Select value={local.phase} onValueChange={v => setLocal(p => ({ ...p, phase: v }))}>
              <SelectTrigger><SelectValue placeholder="All phases" /></SelectTrigger>
              <SelectContent>{PHASES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-sm font-medium">Actively looking only</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Show only educators seeking transfers</p>
            </div>
            <Switch checked={local.activeOnly} onCheckedChange={v => setLocal(p => ({ ...p, activeOnly: v }))} />
          </div>
          <Button onClick={handleApply} className="w-full rounded-xl h-12 text-base font-semibold">Apply Filters</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
