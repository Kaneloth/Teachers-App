import { MapPin, Navigation, Monitor, ChevronRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
// District → towns (inlined to avoid external import)
const TOWNS_BY_DISTRICT: Record<string, string[]> = {
  'Alfred Nzo East':['Bizana','Flagstaff','Other'],'Alfred Nzo West':['Mount Frere','Matatiele','Maluti','Other'],
  'Amatole East':['Butterworth','Idutywa','Ngqamakhwe','Other'],'Amatole West':['East London','King Williams Town','Stutterheim','Komani','Other'],
  'Buffalo City':['East London','Mdantsane','Bhisho','Other'],'Chris Hani East':['Queenstown','Komani','Cofimvaba','Other'],'Chris Hani West':['Cradock','Middelburg EC','Tarkastad','Other'],
  'Joe Gqabi':['Aliwal North','Sterkstroom','Burgersdorp','Other'],'Nelson Mandela Bay':['Port Elizabeth','Uitenhage','Kariega','Other'],
  'OR Tambo Coastal':['Port St Johns','Lusikisiki','Ingquza','Other'],'OR Tambo Inland':['Mthatha','Qumbu','Tsolo','Other'],'Sarah Baartman':['Grahamstown','Port Alfred','Humansdorp','Jeffreys Bay','Other'],
  'Fezile Dabi':['Sasolburg','Parys','Viljoenskroon','Other'],'Lejweleputswa':['Welkom','Odendaalsrus','Virginia','Other'],
  'Motheo':['Bloemfontein','Botshabelo','Thaba Nchu','Other'],'Thabo Mofutsanyana':['Phuthaditjhaba','Harrismith','Bethlehem','Other'],'Xhariep':['Springfontein','Trompsburg','Philippolis','Other'],
  'Ekurhuleni North':['Tembisa','Kempton Park','Edenvale','Other'],'Ekurhuleni South':['Alberton','Germiston','Boksburg','Other'],
  'Gauteng North':['Pretoria North','Soshanguve','Mabopane','Other'],'Gauteng West':['Krugersdorp','Randfontein','Westonaria','Other'],
  'Johannesburg Central':['Johannesburg CBD','Soweto','Orlando','Other'],'Johannesburg East':['Bedfordview','Edenvale','Katlehong','Other'],
  'Johannesburg North':['Sandton','Randburg','Midrand','Other'],'Johannesburg South':['Lenasia','Ennerdale','Orange Farm','Other'],
  'Sedibeng East':['Vereeniging','Vanderbijlpark','Sebokeng','Other'],'Sedibeng West':['Heidelberg GP','Balfour','Other'],
  'Tshwane North':['Pretoria North','Soshanguve','Hammanskraal','Other'],'Tshwane South':['Centurion','Pretoria East','Other'],'Tshwane West':['Atteridgeville','Ga-Rankuwa','Other'],
  'Amajuba':['Newcastle','Utrecht','Dannhauser','Other'],'Harry Gwala':['Ixopo','Kokstad','Umzimkulu','Other'],
  'Ilembe':['KwaDukuza','Stanger','Mandeni','Other'],'King Cetshwayo':['Richards Bay','Empangeni','Nkandla','Other'],
  'Pinetown':['Pinetown','Westville','Kloof','Other'],'Ugu':['Port Shepstone','Margate','Hibiscus Coast','Other'],
  'Umgungundlovu':['Pietermaritzburg','Howick','Camperdown','Other'],'Umkhanyakude':['Jozini','Hluhluwe','Mkuze','Other'],
  'Umzinyathi':['Dundee','Greytown','Nqutu','Other'],'Uthukela':['Ladysmith','Estcourt','Bergville','Other'],
  'Uthungulu':['Richards Bay','Empangeni','Mthunzini','Other'],'Zululand':['Ulundi','Vryheid','Nongoma','Other'],
  'Capricorn North':['Bela-Bela','Mokopane','Other'],'Capricorn South':['Polokwane','Seshego','Other'],
  'Mopani East':['Tzaneen','Letsitele','Other'],'Mopani West':['Phalaborwa','Giyani','Other'],
  'Sekhukhune East':['Marble Hall','Groblersdal','Other'],'Sekhukhune South':['Burgersfort','Jane Furse','Other'],
  'Vhembe East':['Thohoyandou','Malamulele','Other'],'Vhembe West':['Louis Trichardt','Musina','Other'],
  'Waterberg':['Mokopane','Lephalale','Thabazimbi','Other'],'Mogalakwena':['Mokopane','Mahwelereng','Other'],
  'Bohlabela':['Bushbuckridge','Acornhoek','Other'],'Ehlanzeni':['Mbombela','White River','Hazyview','Other'],
  'Gert Sibande':['Ermelo','Secunda','Standerton','Other'],'Nkangala':['Witbank','Middelburg MP','Bronkhorstspruit','Other'],
  'Bojanala':['Rustenburg','Brits','Phokeng','Other'],'Dr Kenneth Kaunda':['Klerksdorp','Orkney','Stilfontein','Other'],
  'Dr Ruth Segomotsi Mompati':['Vryburg','Schweizer-Reneke','Other'],'Ngaka Modiri Molema':['Mafikeng','Zeerust','Lichtenburg','Other'],
  'Frances Baard':['Kimberley','Barkly West','Other'],'John Taolo Gaetsewe':['Kuruman','Kathu','Other'],
  'Namakwa':['Springbok','Calvinia','Other'],'Pixley-ka-Seme':['De Aar','Prieska','Victoria West','Other'],'ZF Mgcawu':['Upington','Kakamas','Other'],
  'Metro Central':['Cape Town CBD','Bellville','Parow','Other'],'Metro East':['Mitchells Plain','Khayelitsha','Strand','Other'],
  'Metro North':['Durbanville','Kraaifontein','Brackenfell','Other'],'Metro South':['Wynberg','Retreat','Muizenberg','Other'],
  'Cape Winelands':['Stellenbosch','Paarl','Worcester','Franschhoek','Other'],
  'Eden and Central Karoo':['George','Mossel Bay','Knysna','Oudtshoorn','Other'],
  'Overberg':['Hermanus','Bredasdorp','Swellendam','Other'],'West Coast':['Moorreesburg','Malmesbury','Vredenburg','Other'],
};

export interface MyProfile {
  phase?: string;
  current_province?: string;
  preferred_provinces?: string[];
  town?: string;
  subjects?: string[];
  preferred_provinces?: string[];
  preferred_districts?: string[];
  preferred_town_coords?: { town: string; lat: number; lng: number }[];
  town_lat?: number;
  town_lng?: number;
}

function townInPreferred(
  town: string,
  preferred: string[],
  prefCoords: { lat: number; lng: number }[],
  tLat?: number | null,
  tLng?: number | null
): boolean {
  if (!town || !preferred.length) return false;
  const t = town.toLowerCase().trim();

  const townToDistrict: Record<string, string> = {};
  for (const [district, towns] of Object.entries(TOWNS_BY_DISTRICT)) {
    for (const townName of towns) {
      townToDistrict[townName.toLowerCase()] = district;
    }
  }

  // 1. Exact town name match
  if (preferred.some(p => p.toLowerCase().trim() === t)) return true;

  // 2. District lookup (preferred contains district names, check their towns)
  for (const p of preferred) {
    const districtTowns = TOWNS_BY_DISTRICT[p] || [];
    if (districtTowns.some(x => x.toLowerCase().trim() === t)) return true;
  }

  // 3. Reverse lookup: town belongs to a district that is in preferred
  const townDistrict = townToDistrict[t];
  if (townDistrict && preferred.some(p => p === townDistrict)) return true;

  // 4. Coord proximity within 50km
  if (tLat != null && tLng != null && prefCoords.length) {
    const lat1 = tLat * Math.PI / 180;
    const lng1 = tLng * Math.PI / 180;
    for (const p of prefCoords) {
      const lat2 = p.lat * Math.PI / 180;
      const lng2 = p.lng * Math.PI / 180;
      const dLat = lat2 - lat1;
      const dLng = lng2 - lng1;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      if (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 50) return true;
    }
  }
  return false;
}

export function calculateMatch(me: MyProfile, them: MyProfile): number {
  const setA = new Set((me.subjects || []).map(s => s.toLowerCase().trim()));
  const setB = new Set((them.subjects || []).map(s => s.toLowerCase().trim()));
  const common = [...setA].filter(s => setB.has(s)).length;
  if (common === 0) return 0;

  const totalDistinct = new Set([...setA, ...setB]).size;
  const subjectScore = totalDistinct > 0 ? common / totalDistinct : 0;
  const phaseScore = me.phase && them.phase && me.phase === them.phase ? 0.20 : 0;

  // Province (20%): THEIR current province is in MY preferred provinces,
  // OR MY current province is in THEIR preferred provinces.
  // Asymmetric — A's score for B may differ from B's score for A.
  const myPrefProvinces   = me.preferred_provinces   || [];
  const themPrefProvinces = them.preferred_provinces || [];
  const provinceScore = (
    (them.current_province && myPrefProvinces.includes(them.current_province)) ||
    (me.current_province   && themPrefProvinces.includes(me.current_province))
  ) ? 0.20 : 0;

  const mePrefCoords = (me.preferred_town_coords || []) as { lat: number; lng: number }[];
  const themPrefCoords = (them.preferred_town_coords || []) as { lat: number; lng: number }[];

  const townScore = (
    townInPreferred(them.town || '', me.preferred_districts || [], mePrefCoords, them.town_lat, them.town_lng) ||
    townInPreferred(me.town || '', them.preferred_districts || [], themPrefCoords, me.town_lat, me.town_lng)
  ) ? 0.20 : 0;

  return Math.round((phaseScore + provinceScore + townScore + subjectScore * 0.40) * 100);
}

export const MATCH_THRESHOLD = 85;

export function isTownSwapMatch(mine: MyProfile, them: MyProfile): boolean {
  const mySubjects = new Set((mine.subjects || []).map(s => s.toLowerCase().trim()));
  const theirSubjects = new Set((them.subjects || []).map(s => s.toLowerCase().trim()));
  const sharesSubject = [...mySubjects].some(s => theirSubjects.has(s));
  if (!sharesSubject) return false;

  const townToDistrict: Record<string, string> = {};
  for (const [district, towns] of Object.entries(TOWNS_BY_DISTRICT)) {
    for (const townName of towns) { townToDistrict[townName.toLowerCase()] = district; }
  }

  const myTownDistrict = mine.town ? townToDistrict[mine.town.toLowerCase()] : null;
  const theyWantMyTown = !!(mine.town && (
    (them.preferred_districts || []).includes(mine.town) ||
    (myTownDistrict && (them.preferred_districts || []).includes(myTownDistrict))
  ));

  const theirTownDistrict = them.town ? townToDistrict[them.town.toLowerCase()] : null;
  const iWantTheirTown = !!(them.town && (
    (mine.preferred_districts || []).includes(them.town) ||
    (theirTownDistrict && (mine.preferred_districts || []).includes(theirTownDistrict))
  ));

  return iWantTheirTown || theyWantMyTown;
}

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
  preferred_provinces?: string[];
  preferred_districts?: string[];
  preferred_town_coords?: { town: string; lat: number; lng: number }[];
  town_lat?: number;
  town_lng?: number;
  subjects?: string[];
  phase?: string;
  user_id?: string;
  profile_type?: string;
  distance_km?: number;
}

interface Props {
  educator: Educator;
  myProfile?: MyProfile;
  isPro?: boolean;
  index?: number;
  distanceKm?: number;
}

export default function EducatorCard({ educator, myProfile, isPro = false, index = 0, distanceKm }: Props) {
  const match = myProfile ? calculateMatch(myProfile, educator) : 0;
  const initial = educator.full_name?.[0]?.toUpperCase() || '?';

  const locationParts = [educator.current_province, educator.town].filter(Boolean);
  const location = locationParts.length ? locationParts.join(' – ') : '–';

  const wants = educator.preferred_districts?.length
    ? educator.preferred_districts.join(', ')
    : educator.preferred_provinces?.length
    ? educator.preferred_provinces.join(', ')
    : 'Any';

  const subjectsStr = educator.subjects?.length
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
        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
          {educator.avatar_url
            ? <img src={educator.avatar_url} alt={educator.full_name} className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-primary">{initial}</span>
          }
        </div>

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

        <div className="flex flex-col items-center gap-1.5 shrink-0">
          {isPro ? (
            <div className="relative w-9 h-9">
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5"
                  strokeDasharray={`${(match / 100) * 94.2} 94.2`} strokeLinecap="round" />
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
