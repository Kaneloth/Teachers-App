import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, Lock, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { geocodeLocation } from '@/lib/geocode';

const PROVINCES = ['Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Mpumalanga', 'Limpopo', 'North West', 'Free State', 'Northern Cape'];
const SUBJECTS = [
  'Accounting','Afrikaans FAL','Afrikaans HL','Agricultural Sciences',
  'Agricultural Management Practices','Agricultural Technology','Business Studies',
  'Computer Applications Technology','Consumer Studies','Dance Studies','Design',
  'Dramatic Arts','Economics','Engineering Graphics and Design','English FAL','English HL',
  'Geography','History','Hospitality Studies','Information Technology',
  'isiNdebele FAL','isiNdebele HL','isiXhosa FAL','isiXhosa HL','isiZulu FAL','isiZulu HL',
  'Life Orientation','Life Sciences','Mathematical Literacy','Mathematics','Music',
  'Natural Sciences','Physical Sciences','Religion Studies',
  'Sepedi FAL','Sepedi HL','Sesotho FAL','Sesotho HL','Setswana FAL','Setswana HL',
  'Sign Language HL','Siswati FAL','Siswati HL','Social Sciences','Technology',
  'Tshivenda FAL','Tshivenda HL','Tourism','Visual Arts',
  'Xitsonga FAL','Xitsonga HL','Other',
];
const PHASES = ['Foundation', 'Intermediate', 'Senior', 'FET'];

export { PROVINCES };

// 0 = radius search off. Pro-only feature — see `radiusKm` usage below.
export const RADIUS_OFF = 0;
export const RADIUS_MIN = 10;
export const RADIUS_MAX = 200;
export const RADIUS_STEP = 10;
export const RADIUS_DEFAULT = 50;

export interface Filters {
  province: string;
  town: string;            // free-text town/area name — available to all users
  townLat?: number;        // geocoded coordinates for `town`, if resolved
  townLng?: number;
  townDisplayName?: string;
  radiusKm: number;         // Pro-only proximity radius around `town`; 0 = off
  subject: string;
  phase: string;
  activeOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  province: '', town: '', radiusKm: RADIUS_OFF, subject: '', phase: '', activeOnly: false,
};

interface Props {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  isPro?: boolean;
  onProGate?: () => void;
}

export default function SearchFilters({ filters, onFiltersChange, isPro = false, onProGate }: Props) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Filters>(filters);
  const [geocoding, setGeocoding] = useState(false);
  // geocodeTarget only changes on blur/Enter — keeps geocoding off every keystroke.
  const [geocodeTarget, setGeocodeTarget] = useState(filters.town);
  const lastGeocodedRef = useRef(filters.town);

  // Geocode only when the user commits a change to the town field (blur/Enter).
  useEffect(() => {
    const target = geocodeTarget.trim();
    if (target === lastGeocodedRef.current.trim()) return; // no change since last geocode

    if (target.length < 3) {
      lastGeocodedRef.current = target;
      setLocal(p => ({ ...p, townLat: undefined, townLng: undefined, townDisplayName: undefined }));
      return;
    }

    let cancelled = false;
    setGeocoding(true);
    geocodeLocation(target).then(coords => {
      if (cancelled) return;
      lastGeocodedRef.current = target;
      if (coords) {
        setLocal(p => ({
          ...p,
          townLat: coords.latitude,
          townLng: coords.longitude,
          townDisplayName: coords.displayName,
        }));
      } else {
        setLocal(p => ({ ...p, townLat: undefined, townLng: undefined, townDisplayName: undefined }));
      }
    }).finally(() => { if (!cancelled) setGeocoding(false); });

    return () => { cancelled = true; };
  }, [geocodeTarget]);

  const handleApply = () => {
    // Free users can't apply a radius — strip it defensively even if it was
    // somehow set (e.g. they downgraded after setting it).
    onFiltersChange(isPro ? local : { ...local, radiusKm: RADIUS_OFF });
    setOpen(false);
  };
  const handleReset = () => {
    setLocal(DEFAULT_FILTERS);
    setGeocodeTarget('');
    lastGeocodedRef.current = '';
    onFiltersChange(DEFAULT_FILTERS);
    setOpen(false);
  };

  const activeCount = [
    local.province, local.town, local.subject, local.phase,
    local.activeOnly, isPro && local.radiusKm > RADIUS_OFF,
  ].filter(Boolean).length;

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

          {/* Province — disabled while a town-radius search is active, since
              radius search defines its own geographic area and combining it
              with a province filter produces contradictory/empty results
              (e.g. "within 45km of Polokwane" + "KZN" — Polokwane isn't in
              KZN at all). */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Province</Label>
            <Select
              value={local.province}
              onValueChange={v => setLocal(p => ({ ...p, province: v }))}
              disabled={isPro && local.radiusKm > RADIUS_OFF && !!local.townLat}
            >
              <SelectTrigger><SelectValue placeholder="All provinces" /></SelectTrigger>
              <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            {isPro && local.radiusKm > RADIUS_OFF && !!local.townLat && (
              <p className="text-xs text-muted-foreground">
                Ignored while searching by town radius — results are based on distance from {local.town}.
              </p>
            )}
          </div>

          {/* Town — free text, available to all users; geocoded on blur so we
              can confirm the place was identified correctly and (for Pro)
              feed coordinates to the radius search. */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Town</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={local.town}
                onChange={e => setLocal(p => ({ ...p, town: e.target.value }))}
                onBlur={e => setGeocodeTarget(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setGeocodeTarget(e.currentTarget.value); }}
                placeholder="e.g. Polokwane"
                className="pl-9"
              />
            </div>
            {geocoding ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Looking up "{local.town}"…
              </p>
            ) : local.townLat != null && local.townLng != null ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                Searching near: {local.townLat.toFixed(4)}°, {local.townLng.toFixed(4)}°
                {local.townDisplayName ? ` — ${local.townDisplayName}` : ''}
              </p>
            ) : local.town.trim().length >= 3 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">Place not found — check the spelling.</p>
            ) : !isPro ? (
              <p className="text-xs text-muted-foreground">Matches educators whose town contains this text.</p>
            ) : null}
          </div>

          {/* Radius slider — Pro only */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Search radius</Label>
              {isPro && local.radiusKm > RADIUS_OFF && (
                <span className="text-xs font-semibold text-primary">{local.radiusKm} km</span>
              )}
            </div>
            {isPro ? (
              <>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={local.radiusKm > RADIUS_OFF}
                    onCheckedChange={v => setLocal(p => ({
                      ...p,
                      radiusKm: v ? RADIUS_DEFAULT : RADIUS_OFF,
                      province: v ? '' : p.province, // radius supersedes province — avoid a silently-ignored filter
                    }))}
                  />
                  <span className="text-xs text-muted-foreground">
                    {local.radiusKm > RADIUS_OFF ? `Within ${local.radiusKm} km of this town` : 'Off — exact town match only'}
                  </span>
                </div>
                {local.radiusKm > RADIUS_OFF && (
                  <Slider
                    value={[local.radiusKm]}
                    min={RADIUS_MIN}
                    max={RADIUS_MAX}
                    step={RADIUS_STEP}
                    onValueChange={([v]) => setLocal(p => ({ ...p, radiusKm: v }))}
                  />
                )}
                {local.radiusKm > RADIUS_OFF && !local.town && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Enter a town above to search within this radius.</p>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onProGate}
                className="flex items-center gap-2 w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-left hover:border-primary/50 transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Upgrade to Pro</span> to search educators within a radius of a town
                </span>
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
