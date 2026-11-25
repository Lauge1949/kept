/**
 * Lingui (D96): ICU messages, PO catalogues in src/locales/<locale>/messages.po, compiled on
 * import by @lingui/vite-plugin. `pnpm --filter @kept/web i18n:extract` refreshes the catalogues.
 */
import { i18n, type Messages } from '@lingui/core';
// Danish is part of the app shell: a failed on-demand catalogue must never show IDs.
import { messages as danishMessages } from '../locales/da/messages.po';
import { localiseSeparators } from '@/lib/format';
import {
  type Digits,
  formatLocale,
  initialLocale,
  type Locale,
  settleStoredLocale,
  showLocale,
  storedDigits,
} from '@/lib/prefs';

const loaders: Record<Locale, () => Promise<{ messages: Messages }>> = {
  ar: () => import('../locales/ar/messages.po'),
  da: async () => ({ messages: danishMessages }),
  de: () => import('../locales/de/messages.po'),
  en: () => import('../locales/en/messages.po'),
  es: () => import('../locales/es/messages.po'),
  fr: () => import('../locales/fr/messages.po'),
  it: () => import('../locales/it/messages.po'),
  uk: () => import('../locales/uk/messages.po'),
  vi: () => import('../locales/vi/messages.po'),
};

/**
 * `locales` carries the digit choice (D143) into Lingui's own number, date and plural `#`
 * formatting, so `plural(n, …)` in Arabic shows ٣ or 3 as the person chose.
 */
export async function activateLocale(locale: Locale, digits: Digits = 'eastern'): Promise<void> {
  const { messages } = await loaders[locale]();
  i18n.loadAndActivate({
    locale,
    locales: [formatLocale(locale, digits)],
    messages: localiseSeparators(messages, locale),
  });
}

/**
 * The language a page starts in: the one picked on this device, else the browser's, shown and not
 * stored (#474): only a language the person picks is kept. Offline, a catalogue never loaded online
 * isn't cached (sw.ts): the bundled Danish catalogue keeps the shell readable.
 */
export async function startLocale(): Promise<Locale> {
  settleStoredLocale();
  const locale = initialLocale();
  let active = locale;
  try {
    await activateLocale(locale, storedDigits());
  } catch {
    // The static Danish catalogue travels with the shell, including offline starts.
    // Never activate an empty catalogue: production macros otherwise display opaque IDs.
    active = 'da';
    await activateLocale(active, storedDigits());
  }
  showLocale(active);
  return active;
}

export { i18n };
