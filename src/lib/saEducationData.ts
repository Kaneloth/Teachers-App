export const TOWNS_BY_DISTRICT: Record<string, string[]> = {
  'Alfred Nzo East': ['Bizana','Flagstaff','Other'],'Alfred Nzo West': ['Mount Frere','Matatiele','Maluti','Other'],
  'Amatole East': ['Butterworth','Idutywa','Ngqamakhwe','Other'],'Amatole West': ['East London','King Williams Town','Stutterheim','Komani','Other'],
  'Buffalo City': ['East London','Mdantsane','Bhisho','Other'],'Chris Hani East': ['Queenstown','Komani','Cofimvaba','Other'],'Chris Hani West': ['Cradock','Middelburg EC','Tarkastad','Other'],
  'Joe Gqabi': ['Aliwal North','Sterkstroom','Burgersdorp','Other'],'Nelson Mandela Bay': ['Port Elizabeth','Uitenhage','Kariega','Other'],
  'OR Tambo Coastal': ['Port St Johns','Lusikisiki','Ingquza','Other'],'OR Tambo Inland': ['Mthatha','Qumbu','Tsolo','Other'],'Sarah Baartman': ['Grahamstown','Port Alfred','Humansdorp','Jeffreys Bay','Other'],
  'Fezile Dabi': ['Sasolburg','Parys','Viljoenskroon','Other'],'Lejweleputswa': ['Welkom','Odendaalsrus','Virginia','Other'],
  'Motheo': ['Bloemfontein','Botshabelo','Thaba Nchu','Other'],'Thabo Mofutsanyana': ['Phuthaditjhaba','Harrismith','Bethlehem','Other'],'Xhariep': ['Springfontein','Trompsburg','Philippolis','Other'],
  'Ekurhuleni North': ['Tembisa','Kempton Park','Edenvale','Other'],'Ekurhuleni South': ['Alberton','Germiston','Boksburg','Other'],
  'Gauteng North': ['Pretoria North','Soshanguve','Mabopane','Other'],'Gauteng West': ['Krugersdorp','Randfontein','Westonaria','Other'],
  'Johannesburg Central': ['Johannesburg CBD','Soweto','Orlando','Other'],'Johannesburg East': ['Bedfordview','Edenvale','Katlehong','Other'],
  'Johannesburg North': ['Sandton','Randburg','Midrand','Other'],'Johannesburg South': ['Lenasia','Ennerdale','Orange Farm','Other'],
  'Sedibeng East': ['Vereeniging','Vanderbijlpark','Sebokeng','Other'],'Sedibeng West': ['Heidelberg GP','Balfour','Other'],
  'Tshwane North': ['Pretoria North','Soshanguve','Hammanskraal','Other'],'Tshwane South': ['Centurion','Pretoria East','Other'],'Tshwane West': ['Atteridgeville','Ga-Rankuwa','Other'],
  'Amajuba': ['Newcastle','Utrecht','Dannhauser','Other'],'Harry Gwala': ['Ixopo','Kokstad','Umzimkulu','Other'],
  'Ilembe': ['KwaDukuza','Stanger','Mandeni','Other'],'King Cetshwayo': ['Richards Bay','Empangeni','Nkandla','Other'],
  'Pinetown': ['Pinetown','Westville','Kloof','Other'],'Ugu': ['Port Shepstone','Margate','Hibiscus Coast','Other'],
  'Umgungundlovu': ['Pietermaritzburg','Howick','Camperdown','Other'],'Umkhanyakude': ['Jozini','Hluhluwe','Mkuze','Other'],
  'Umzinyathi': ['Dundee','Greytown','Nqutu','Other'],'Uthukela': ['Ladysmith','Estcourt','Bergville','Other'],
  'Uthungulu': ['Richards Bay','Empangeni','Mthunzini','Other'],'Zululand': ['Ulundi','Vryheid','Nongoma','Other'],
  'Capricorn North': ['Bela-Bela','Mokopane','Other'],'Capricorn South': ['Polokwane','Seshego','Other'],
  'Mopani East': ['Tzaneen','Letsitele','Other'],'Mopani West': ['Phalaborwa','Giyani','Other'],
  'Sekhukhune East': ['Marble Hall','Groblersdal','Other'],'Sekhukhune South': ['Burgersfort','Jane Furse','Other'],
  'Vhembe East': ['Thohoyandou','Malamulele','Other'],'Vhembe West': ['Louis Trichardt','Musina','Other'],
  'Waterberg': ['Mokopane','Lephalale','Thabazimbi','Other'],'Mogalakwena': ['Mokopane','Mahwelereng','Other'],
  'Bohlabela': ['Bushbuckridge','Acornhoek','Other'],'Ehlanzeni': ['Mbombela','White River','Hazyview','Other'],
  'Gert Sibande': ['Ermelo','Secunda','Standerton','Other'],'Nkangala': ['Witbank','Middelburg MP','Bronkhorstspruit','Other'],
  'Bojanala': ['Rustenburg','Brits','Phokeng','Other'],'Dr Kenneth Kaunda': ['Klerksdorp','Orkney','Stilfontein','Other'],
  'Dr Ruth Segomotsi Mompati': ['Vryburg','Schweizer-Reneke','Other'],'Ngaka Modiri Molema': ['Mafikeng','Zeerust','Lichtenburg','Other'],
  'Frances Baard': ['Kimberley','Barkly West','Other'],'John Taolo Gaetsewe': ['Kuruman','Kathu','Other'],
  'Namakwa': ['Springbok','Calvinia','Other'],'Pixley-ka-Seme': ['De Aar','Prieska','Victoria West','Other'],'ZF Mgcawu': ['Upington','Kakamas','Other'],
  'Metro Central': ['Cape Town CBD','Bellville','Parow','Other'],'Metro East': ['Mitchells Plain','Khayelitsha','Strand','Other'],
  'Metro North': ['Durbanville','Kraaifontein','Brackenfell','Other'],'Metro South': ['Wynberg','Retreat','Muizenberg','Other'],
  'Cape Winelands': ['Stellenbosch','Paarl','Worcester','Franschhoek','Other'],
  'Eden and Central Karoo': ['George','Mossel Bay','Knysna','Oudtshoorn','Other'],
  'Overberg': ['Hermanus','Bredasdorp','Swellendam','Other'],'West Coast': ['Moorreesburg','Malmesbury','Vredenburg','Other'],
};

export const ALL_TOWNS: string[] = [...new Set(Object.values(TOWNS_BY_DISTRICT).flat())].sort((a, b) => a.localeCompare(b));

export function getDistrictForTown(town: string): string | undefined {
  const n = town.toLowerCase().trim();
  for (const [d, towns] of Object.entries(TOWNS_BY_DISTRICT)) {
    if (towns.some(t => t.toLowerCase().trim() === n)) return d;
  }
  return undefined;
}

export function isTownInPreferredDistricts(town: string, preferredDistricts: string[]): boolean {
  if (!town || !preferredDistricts.length) return false;
  const d = getDistrictForTown(town);
  return d ? preferredDistricts.includes(d) : false;
}

export function getTownsForDistricts(preferredDistricts: string[]): string[] {
  const all = new Set<string>();
  for (const d of preferredDistricts) {
    for (const t of (TOWNS_BY_DISTRICT[d] || [])) { if (t !== 'Other') all.add(t); }
  }
  return [...all];
}
