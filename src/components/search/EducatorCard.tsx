import { MapPin, Navigation, Monitor, ChevronRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export interface MyProfile {
  phase?: string;
  current_province?: string;
  town?: string;
  subjects?: string[];
  preferred_districts?: string[];
  // Geocoded coords for each preferred town — [{town, lat, lng}]
  preferred_town_coords?: { town: string; lat: number; lng: number }[];
  // Own geocoded town coordinates (from geo_location column)
  town_lat?: number;
  town_lng?: number;
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TOWN_MATCH_RADIUS_KM = 50; // within 50km counts as a town match

/**
 * Weighted match formula:
 *   Phase 20% + Province 20% + Preferred-town proximity 20% + Subjects (Jaccard) 40%
 *
 * Preferred-town proximity (20%):
 *   - THEM's current town is within 50km of any of MY preferred towns, OR
 *   - MY current town is within 50km of any of THEIR preferred towns.
 *   Falls back to exact town-name match if coordinates are not available.
 *
 * Hard rule: no common subjects → always 0%.
 */
export function calculateMatch(me: MyProfile, them: MyProfile): number {
  const setA = new Set((me.subjects || []).map(s => s.toLowerCase()));
  const setB = new Set((them.subjects || []).map(s => s.toLowerCase()));
  const common = [...setA].filter(s => setB.has(s)).length;

  if (common === 0) return 0;

  const totalDistinct = new Set([...setA, ...setB]).size;
  const subjectScore  = totalDistinct > 0 ? common / totalDistinct : 0;

  const phaseScore    = me.phase && them.phase && me.phase === them.phase ? 0.20 : 0;
  const provinceScore = me.current_province && them.current_province
                        && me.current_province === them.current_province ? 0.20 : 0;

  // ── Town proximity score ──────────────────────────────────────────────────
  // Check if THEM's current town is near any of MY preferred towns (or vice versa)
  let townScore = 0;

  const myPreferredCoords  = me.preferred_town_coords   || [];
  const themPreferredCoords = them.preferred_town_coords || [];

  // Try coordinate-based distance first
  const themLat = them.town_lat;
  const themLng = them.town_lng;
  const meLat   = me.town_lat;
  const meLng   = me.town_lng;

  let foundByCoords = false;

  // MY preferred towns → THEIR current location
  if (themLat != null && themLng != null && myPreferredCoords.length > 0) {
    for (const pref of myPreferredCoords) {
      if (haversineKm(pref.lat, pref.lng, themLat, themLng) <= TOWN_MATCH_RADIUS_KM) {
        townScore = 0.20;
        foundByCoords = true;
        break;
      }
    }
  }

  // THEIR preferred towns → MY current location (if not already matched)
  if (!foundByCoords && meLat != null && meLng != null && themPreferredCoords.length > 0) {
    for (const pref of themPreferredCoords) {
      if (haversineKm(pref.lat, pref.lng, meLat, meLng) <= TOWN_MATCH_RADIUS_KM) {
        townScore = 0.20;
        foundByCoords = true;
        break;
      }
    }
  }

  // Fallback: exact town-name match (covers cases where coords not yet geocoded)
  if (!foundByCoords) {
    const myPreferredNames   = (me.preferred_districts   || []).map(t => t.toLowerCase());
    const themPreferredNames = (them.preferred_districts || []).map(t => t.toLowerCase());
    const themTown = them.town?.toLowerCase() || '';
    const meTown   = me.town?.toLowerCase()   || '';

    if ((themTown && myPreferredNames.includes(themTown)) ||
        (meTown   && themPreferredNames.includes(meTown))) {
      townScore = 0.20;
    }
  }

  return Math.round((phaseScore + provinceScore + townScore + subjectScore * 0.40) * 100);
}

/** Matches page shows scores ≥ this threshold, plus any town-swap matches. */
export const MATCH_THRESHOLD = 85;

/**
 * "Town swap" exception — qualifies for the Matches page even below
 * MATCH_THRESHOLD, because it represents a direct transfer-exchange
 * opportunity:
 *   - Both educators share at least one subject, AND
 *   - My current town is one of THEIR preferred districts, OR
 *   - Their current town is one of MY preferred districts
 * (i.e. each could plausibly move to where the other currently is).
 */
export function isTownSwapMatch(mine: MyProfile, them: MyProfile): boolean {
  const mySubjects    = new Set((mine.subjects || []).map(s => s.toLowerCase()));
  const theirSubjects = new Set((them.subjects || []).map(s => s.toLowerCase()));
  const sharesSubject = [...mySubjects].some(s => theirSubjects.has(s));
  if (!sharesSubject) return false;

  const iWantTheirTown = !!(them.town && (mine.preferred_districts || []).includes(them.town));
  const theyWantMyTown = !!(mine.town && (them.preferred_districts || []).includes(mine.town));

  return iWantTheirTown || theyWantMyTown;
}

/**
 * Single source of truth for "does this educator belong on the Matches
 * page" — used both to populate Matches and to EXCLUDE these educators
 * from the general Search page (so the same person isn't listed twice).
 */
export function qualifiesForMatchesPage(mine: MyProfile, them: MyProfile, score?: number): boolean {
  const s = score ?? calculateMatch(mine, them);
  return s >= MATCH_THRESHOLD || isTownSwapMatch(mine, them);
}

interface Educator {
  id: string;
  full_name: string;
  avatar_url?: string;
  is_actively_looking?: boolean;
  is_sace_verified?: boolean;
  current_province?: string;
  town?: string;
  preferred_provinces?: string[];
  subjects?: string[];
  phase?: string;
}

interface Props {
  educator: Educator;
  myProfile?: MyProfile;
  isPro?: boolean;
  index?: number;
  distanceKm?: number;
}

export default function EducatorCard({ educator, myProfile, isPro = false, index = 0, distanceKm }: Props) {
  const match   = myProfile ? calculateMatch(myProfile, educator) : 0;
  const initial = educator.full_name?.[0]?.toUpperCase() || '?';

  const locationParts = [educator.current_province, educator.town].filter(Boolean);
  const location      = locationParts.length ? locationParts.join(' – ') : '–';
  const wants         = educator.preferred_provinces?.length ? educator.preferred_provinces.join(', ') : 'Any';
  const subjectsStr   = educator.subjects?.length
    ? `${educator.subjects.join(', ')}${educator.phase ? ` (${educator.phase})` : ''}`
    : '()';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Link
        to={`/educator/${educator.id}`}
        className="flex items-center gap-3 bg-card rounded-2xl border border-border px-4 py-3.5 hover:shadow-sm transition-all duration-200 group"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
          {educator.avatar_url
            ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-primary">{initial}</span>
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="font-semibold text-sm text-foreground truncate">{educator.full_name}</p>
            {educator.is_sace_verified && (
              <span title="Identity Verified" className="shrink-0 inline-flex items-center gap-0.5 bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-primary/20">
                <ShieldCheck className="w-3 h-3" />Verified
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            {/* Current province — Pro only; free users see nothing here */}
            {isPro && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Navigation className="w-3 h-3 shrink-0" />
              <span className="truncate">Wants: {wants}</span>
            </div>
            {distanceKm != null && (
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{distanceKm < 1 ? '<1 km away' : `${Math.round(distanceKm)} km away`}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Monitor className="w-3 h-3 shrink-0" />
              <span className="truncate">{subjectsStr}</span>
            </div>
          </div>
        </div>

        {/* Match % ring — Pro only; free users see only the chevron */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          {isPro ? (
            <div className="relative w-9 h-9">
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeDasharray={`${(match / 100) * 94.2} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary leading-none">
                {match}%
              </span>
            </div>
          ) : null}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}
