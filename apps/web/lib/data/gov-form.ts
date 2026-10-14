import 'server-only';
import { getDictionary } from '@/i18n/dictionaries';
import { getCitiesByCountry, getSpecialties } from '@/lib/data/partner-gov';

/** Server-side props for the city picker (G9) and the specialty picker (G1) in onboarding and /profile. */
export async function govFormProps(locale: 'fr' | 'en') {
  const [{ t }, cities, specs] = await Promise.all([getDictionary(), getCitiesByCountry(), getSpecialties()]);
  const C = t.cityPicker;
  const S = t.specialties;
  const aria = t.creatorTips.aria;
  return {
    cities,
    specialtyOptions: specs.map((s) => ({ code: s.code, label: locale === 'fr' ? s.label_fr : s.label_en })),
    cityL: {
      country: C.countryLabel,
      city: C.label, placeholder: C.placeholder, other: C.other, otherLabel: C.otherLabel, noMatch: C.noMatch,
      countryChanged: C.countryChanged, cityHelp: t.creatorForm.cityHelp, tip: C.tip, aria, overLimit: t.creatorForm.errors.city,
    },
    specL: { legend: S.legend, counter: S.counter, help: S.help, max: S.max, legacy: S.legacy, tip: S.tip, aria },
  };
}
