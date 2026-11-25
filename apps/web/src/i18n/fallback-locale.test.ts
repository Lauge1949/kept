import { afterEach, expect, it, vi } from 'vitest';
import { t } from '@lingui/core/macro';
import { i18n, startLocale } from './i18n';

vi.mock('../locales/es/messages.po', () => { throw new Error('Offline catalogue'); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it('shows Danish text, never message IDs, if a catalogue cannot load', async () => {
  vi.stubGlobal('navigator', { language: 'es-ES' });
  expect(await startLocale()).toBe('da');
  expect(i18n.locale).toBe('da');
  expect(document.documentElement.lang).toBe('da');
  expect(t`Home`).toBe('Forside');
  expect(t`More`).toBe('Mere');
});
