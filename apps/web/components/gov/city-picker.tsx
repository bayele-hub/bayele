'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SectionTip } from '@/components/admin/section-tip';
import { OTHER_CITY, filterCities, foldCity, initialCityChoice } from '@/lib/gov/cities';
import { PROFILE_LIMITS } from '@/lib/profile-limits';

export interface CityPickerLabels {
  country: string; city: string; placeholder: string; other: string; otherLabel: string; noMatch: string;
  countryChanged: string; cityHelp: string; tip: string; aria: string; overLimit: string;
}

/**
 * G9 / §6: « Pays » first, then « Ville » — a WAI-ARIA 1.2 combobox over the country's cities plus
 * « Autre ville… » (free text ≤ 60). Without JS it is a native select + text input. Submits
 * `city_choice` (a listed name or __other__) and `city_other`; the server resolves them (and the DB
 * trigger normalises a listed city to its spelling).
 */
export function CountryCityFields({ cities, countries, defaultCountry, defaultCity, L, error }: {
  cities: Record<string, string[]>; countries: { code: string; label: string }[]; defaultCountry: string; defaultCity: string;
  L: CityPickerLabels; error?: string | null;
}) {
  const id = useId();
  const [mounted, setMounted] = useState(false);
  const [country, setCountry] = useState(defaultCountry);
  const list = useMemo(() => cities[country] ?? [], [cities, country]);
  const init = useMemo(() => initialCityChoice(cities[defaultCountry] ?? [], defaultCity), [cities, defaultCountry, defaultCity]);
  const [choice, setChoice] = useState(init.choice);
  const [other, setOther] = useState(init.other);
  const [query, setQuery] = useState(init.choice && init.choice !== OTHER_CITY ? init.choice : init.choice === OTHER_CITY ? L.other : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);

  const options = useMemo(() => [...filterCities(list, query === L.other ? '' : query), OTHER_CITY], [list, query, L.other]);
  const label = (o: string) => (o === OTHER_CITY ? L.other : o);
  const overOther = choice === OTHER_CITY && other.replace(/\s+/g, ' ').trim().length > PROFILE_LIMITS.city;
  const shownError = error ?? (overOther ? L.overLimit : null);

  function pick(o: string) {
    setChoice(o);
    setQuery(label(o));
    setOpen(false);
    setActive(-1);
    if (o === OTHER_CITY) setTimeout(() => otherRef.current?.focus(), 0);
  }

  function onCountry(next: string) {
    setCountry(next);
    if (choice !== OTHER_CITY) {
      setChoice('');
      setQuery('');
      setStatus(L.countryChanged);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const countrySelect = (
    <div>
      <label htmlFor={`${id}-country`} className="text-xs font-semibold text-ink">{L.country}</label>
      <select id={`${id}-country`} name="country" value={country} onChange={(e) => onCountry(e.target.value)}
        className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm">
        {countries.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
      </select>
    </div>
  );

  const labelEl = (forId: string) => (
    <label htmlFor={forId} className="flex items-center text-xs font-semibold text-ink">
      {L.city}<span aria-hidden className="ml-0.5 text-rose-700">*</span>
      <SectionTip id={`${id}-tip`} label={L.city} text={L.tip} ariaTemplate={L.aria} />
    </label>
  );

  const otherInput = mounted && choice === OTHER_CITY && (
    <div className="mt-2">
      <label htmlFor={`${id}-other`} className="text-xs font-semibold text-ink">{L.otherLabel}</label>
      <input ref={otherRef} id={`${id}-other`} name="city_other" value={other} onChange={(e) => setOther(e.target.value)} maxLength={80} autoComplete="address-level2"
        aria-invalid={!!shownError || undefined} aria-describedby={`${id}-help`}
        className={`mt-1 min-h-tap w-full rounded-xl border bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm ${shownError ? 'border-rose-400' : 'border-line'}`} />
      <p className="mt-0.5 text-right text-[11px] tabular-nums text-muted">{other.replace(/\s+/g, ' ').trim().length}/{PROFILE_LIMITS.city}</p>
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {countrySelect}
      <div className="relative min-w-0">
        {!mounted ? (
          <>
            {labelEl(`${id}-native`)}
            <select id={`${id}-native`} name="city_choice" defaultValue={choice}
              className="mt-1 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink sm:text-sm">
              <option value="">{L.placeholder}</option>
              {list.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={OTHER_CITY}>{L.other}</option>
            </select>
            <input name="city_other" defaultValue={other} placeholder={L.otherLabel} maxLength={80}
              className="mt-2 min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink sm:text-sm" />
          </>
        ) : (
          <>
            {labelEl(`${id}-in`)}
            <input type="hidden" name="city_choice" value={choice} />
            <input
              ref={inputRef}
              id={`${id}-in`}
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={open && active >= 0 ? `${id}-o${active}` : undefined}
              aria-invalid={!!shownError || undefined}
              aria-describedby={`${id}-help`}
              autoComplete="off"
              value={query}
              placeholder={L.placeholder}
              onChange={(e) => { setQuery(e.target.value); setChoice(''); setOpen(true); setActive(0); setStatus(''); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => {
                setOpen(false);
                // Tab out with typed text: a listed match is taken, anything else becomes « Autre ».
                if (!choice && query.trim() && query !== L.other) {
                  const hit = list.find((c) => foldCity(c) === foldCity(query));
                  if (hit) pick(hit); else { setOther(query.trim()); pick(OTHER_CITY); }
                }
              }, 120)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (open && active >= 0 && options[active]) pick(options[active]!);
                  else if (query.trim()) {
                    const hit = list.find((c) => foldCity(c) === foldCity(query));
                    if (hit) pick(hit); else { setOther(query.trim()); pick(OTHER_CITY); }
                  }
                } else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
              }}
              className={`mt-1 min-h-tap w-full rounded-xl border bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm ${shownError ? 'border-rose-400' : 'border-line'}`}
            />
            {open && (
              <ul id={`${id}-list`} role="listbox" aria-label={L.city} className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg">
                {options.length === 1 && <li className="px-3 py-2 text-[12px] text-muted">{L.noMatch}</li>}
                {options.map((o, i) => (
                  <li key={o} id={`${id}-o${i}`} role="option" aria-selected={i === active || o === choice}
                    onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                    className={`flex min-h-tap cursor-pointer items-center px-3 text-sm ${o === OTHER_CITY ? 'border-t border-line font-semibold text-brand-700' : 'text-ink'} ${i === active ? 'bg-brand-50' : 'hover:bg-surface'}`}>
                    {label(o)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {otherInput}
        <p id={`${id}-help`} className={`mt-1 text-[11px] ${shownError ? 'font-semibold text-rose-700' : 'text-muted'}`} role={shownError ? 'alert' : undefined}>{shownError ?? L.cityHelp}</p>
        <p role="status" className="sr-only">{status}</p>
      </div>
    </div>
  );
}
