import {
  BUILTIN_TYPES,
  builtinFieldName,
  builtinTypeName,
  MODULE_IDS,
  searchShapes,
} from '../packages/shared/src/index.js';
import { describe, expect, it } from 'vitest';
import { offeredTools } from '../apps/server/src/assistant/select.js';
import { noAnswer, viewerRefusal } from '../apps/server/src/assistant/words.js';
import type { SecurityEvent } from '../apps/server/src/auth/security.js';
import { expiredPage, langOf } from '../apps/server/src/incidents/download.js';
import type { AdminAction, MailBody } from '../apps/server/src/mail/mailer.js';
import {
  CHROME,
  MAIL_LOCALES,
  MESSAGES,
  mailLocale,
  messageFor,
} from '../apps/server/src/mail/messages.js';
import { renderMail } from '../apps/server/src/mail/render.js';
import { testPush } from '../apps/server/src/notify/push.js';
import {
  REMINDER_COUNT,
  REMINDER_WORDS,
  type ReminderFacts,
} from '../apps/server/src/notify/words.js';
import { REPORT_LOCALES, reportLocaleOf } from '../apps/server/src/reports/locale.js';
import { PDF_WORDS } from '../apps/server/src/reports/words/index.js';
import { toolsIn } from '../apps/server/src/tools/context.js';

const PUBLIC_URL = 'http://kept.test';
const ctx = { publicUrl: PUBLIC_URL };

const SECURITY: SecurityEvent[] = [
  'passkey-added',
  'two-factor-disabled',
  'password-changed',
  'unverified-account-reset',
  'unverified-account-link',
];
const ADMIN: AdminAction[] = [
  'disabled',
  'enabled',
  'two-factor-reset',
  'signed-out-everywhere',
  'instance-admin-granted',
  'instance-admin-revoked',
  'password-reset-issued',
  'location-ownership-received',
  'location-ownership-moved',
];

/** A reminder's facts (notify/words.ts), with Latin names so only Arabic mail has Arabic. */
const REMINDER: ReminderFacts = {
  sourceType: 'schedule',
  kind: 'overdue',
  title: 'Boiler service',
  subject: { type: 'place', name: 'Kitchen', path: 'Ground floor' },
  locationName: 'Home',
  dueOn: '2031-01-15',
  dueValue: null,
  unit: null,
  link: '/p/0192f0c3-7c55-7000-8000-000000000001',
};

/** A backup-code notice (#419): Safari on an iPhone, in Cairo, nine codes left. */
function backupCodeUsed(
  facts: Partial<Extract<MailBody, { kind: 'backup-code-used' }>> = {},
): MailBody {
  return {
    kind: 'backup-code-used',
    to: 'a@x.test',
    at: '2031-01-15T14:05:00.000Z',
    timeZone: 'Africa/Cairo',
    browser: 'Safari',
    os: 'iPhone',
    left: 9,
    ...facts,
  };
}

/** One of every mail there is. */
const EVERY_MAIL: MailBody[] = [
  { kind: 'magic-link', to: 'a@x.test', url: `${PUBLIC_URL}/auth/confirm#token=t` },
  { kind: 'password-reset', to: 'a@x.test', url: `${PUBLIC_URL}/auth/reset#token=t` },
  { kind: 'email-change-confirm', to: 'a@x.test', url: `${PUBLIC_URL}/e#t`, newEmail: 'b@x.test' },
  { kind: 'email-change-verify', to: 'b@x.test', url: `${PUBLIC_URL}/e#t` },
  { kind: 'email-changed', to: 'a@x.test', newEmail: 'b@x.test' },
  {
    kind: 'account-deletion',
    to: 'a@x.test',
    purgeAfter: '2026-11-13T09:00:00.000Z',
    timezone: 'Africa/Cairo',
  },
  { kind: 'report-ready', to: 'a@x.test', report: 'inventory', place: 'Home', attached: true },
  ...(['admin', 'member', 'viewer'] as const).flatMap((role) =>
    ['Alfred', ''].map(
      (inviterName): MailBody => ({
        kind: 'invite',
        to: 'c@x.test',
        url: `${PUBLIC_URL}/invite#token=t`,
        locationName: 'Home',
        inviterName,
        role,
      }),
    ),
  ),
  { kind: 'sign-up-existing', to: 'a@x.test' },
  ...SECURITY.map((event): MailBody => ({ kind: 'security-notice', to: 'a@x.test', event })),
  // #419: each way the codes left are said, and a device named in full, in part or not at all.
  ...[0, 1, 2, 3, 9, 11, 21, 100].map((left): MailBody => backupCodeUsed({ left })),
  backupCodeUsed({ browser: 'Firefox', os: null }),
  backupCodeUsed({ browser: null, os: null, timeZone: 'Not/A_Zone' }),
  ...ADMIN.map(
    (action): MailBody => ({ kind: 'admin-action', to: 'a@x.test', action, locationName: 'Home' }),
  ),
  ...[true, false].map(
    (managed): MailBody => ({
      kind: 'owner-new-member',
      to: 'o@x.test',
      locationName: 'Home',
      memberName: 'Bruce',
      role: 'viewer',
      managed,
    }),
  ),
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'failed_jobs_rising',
    details: { failedLastHour: 7 },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'audit_default_partition',
    details: { rows: 3, oldest: '2031-01-02T00:00:00Z', newest: '2031-01-05T00:00:00Z' },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'llm_default_partition',
    details: { rows: 2, oldest: '2031-01-02T00:00:00Z', newest: '2031-01-05T00:00:00Z' },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'backup_failed',
    details: { error: 'pg_dump is version 9', lastOk: '2031-01-01T02:30:00Z' },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'backup_failed',
    details: { error: 'the target is not writable', lastOk: null },
  },
  // The reminder scan hasn't finished for 2 hours, or ever.
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'reminders_not_scanned',
    details: { lastOkAt: '2031-01-02T09:00:00.000Z', lastRunAt: '2031-01-02T11:45:00.000Z' },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'reminders_not_scanned',
    details: { lastOkAt: null, lastRunAt: '2031-01-02T11:45:00.000Z' },
  },
  // A location's webhook started failing.
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'webhook_failing',
    details: { webhookId: 'w', locationId: 'l', since: '2031-01-02T09:00:00.000Z' },
  },
  // The operations watch's alerts and the backup's size check.
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'backup_stale',
    details: { lastOkAt: '2031-01-02T02:40:00.000Z', hours: 40 },
  },
  { kind: 'admin-alert', to: 'admin@x.test', alert: 'backup_stale', details: { lastOkAt: null } },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'disk_space_low',
    details: { volume: 'data', usedRatio: 0.912, freeBytes: 1_500_000_000 },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'disk_space_low',
    details: { volume: 'backup', usedRatio: 0.86, freeBytes: 20_000_000_000 },
  },
  { kind: 'admin-alert', to: 'admin@x.test', alert: 'bucket_versioning_off', details: {} },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'restore_drill_due',
    details: { lastDrillAt: '2031-01-02T09:00:00.000Z' },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'restore_drill_due',
    details: { lastDrillAt: null },
  },
  { kind: 'admin-alert', to: 'admin@x.test', alert: 'backup_suspicious_size', details: {} },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'backup_verify_failed',
    details: { error: 'repository_check_failed' },
  },
  // The instance caps and a rejected instance key.
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'ai_instance_cap_warning',
    details: {
      scope: 'instance',
      target: '',
      unit: 'tokens',
      used: '2400000',
      limit: '3000000',
      currency: null,
      pausedUntil: null,
    },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'ai_instance_cap_reached',
    details: {
      scope: 'instance_account',
      target: 'Alfred',
      unit: 'money',
      used: '5.01',
      limit: '5',
      currency: 'USD',
      pausedUntil: '2031-02-01T00:00:00.000Z',
    },
  },
  {
    kind: 'admin-alert',
    to: 'admin@x.test',
    alert: 'ai_instance_key_rejected',
    details: { provider: 'Groq' },
  },
  // A location's money cap at 80%, a person's token cap at 100%.
  {
    kind: 'ai-cap',
    to: 'ibrahim@x.test',
    level: 80,
    cap: {
      scope: 'location',
      target: 'Home',
      unit: 'money',
      used: '4.0039',
      limit: '5',
      currency: 'USD',
      pausedUntil: null,
    },
  },
  {
    kind: 'ai-cap',
    to: 'louis@x.test',
    level: 100,
    cap: {
      scope: 'member',
      target: 'Louis',
      unit: 'tokens',
      used: '1000400',
      limit: '1000000',
      currency: null,
      pausedUntil: '2031-02-01T00:00:00.000Z',
    },
  },
  // Reminders, the digest, an ended membership, a channel's test and failure.
  { kind: 'reminder', to: 'bruce@x.test', item: REMINDER },
  {
    kind: 'reminder-digest',
    to: 'bruce@x.test',
    day: '2031-01-16',
    items: [
      REMINDER,
      {
        ...REMINDER,
        sourceType: 'loan',
        kind: 'overdue',
        title: null,
        subject: { type: 'thing', name: 'Drill', path: 'Garage › Shelf' },
        link: '/t/0192f0c3-7c55-7000-8000-000000000002',
      },
    ],
  },
  {
    kind: 'membership-ended',
    to: 'ibrahim@x.test',
    locationName: 'Home',
    memberName: 'Louis',
    role: 'member',
    endedOn: '2031-01-15',
  },
  { kind: 'channel-test', to: 'bruce@x.test' },
  { kind: 'channel-failing', to: 'bruce@x.test', label: 'Home Assistant', host: 'ha.example.org' },
  {
    kind: 'ai-summary',
    to: 'ibrahim@x.test',
    month: '2026-09',
    calls: 312,
    tokens: '812000',
    cost: [{ currency: 'USD', amount: '1.1234' }],
    unknownCostCalls: 2,
  },
  // The configuration notices.
  { kind: 'oidc-changed', to: 'louis@x.test', name: 'Home SSO' },
  { kind: 'oidc-changed', to: 'louis@x.test', name: null },
  { kind: 'smtp-changed', to: 'louis@x.test', sender: 'kept@example.org' },
  { kind: 'ai-provider-changed', to: 'louis@x.test', provider: 'groq' },
];

describe('Danish as an official Tingfinder language', () => {
  it('finds Danish shapes and recognizes Danish assistant topics', () => {
    expect(searchShapes('kommode')).toContain('drawers');
    const all = toolsIn(
      { userId: 'u', mfa: true, scope: 'write' },
      'assistant',
      'owner',
      new Set(MODULE_IDS),
    );
    const offered = (question: string) => offeredTools(all, { questions: [question], used: [] })[0];
    expect(offered('Hvem har lånt stigen?')).toContain('lend_thing');
    expect(offered('Find kvitteringen')).toContain('find_documents');
  });
  it('selects Danish for regional language tags and all server surfaces', () => {
    expect(mailLocale('da-DK')).toBe('da');
    expect(reportLocaleOf('da-DK')).toBe('da');
    expect(langOf('da-DK, en;q=0.8')).toBe('da');
    expect(MAIL_LOCALES).toEqual(REPORT_LOCALES);
    expect(CHROME.da.dir).toBe('ltr');
    expect(expiredPage('da')).toContain('Dette link er udløbet');
    expect(noAnswer('da-DK')).toContain('færdiggøre svaret');
    expect(viewerRefusal('da', 'Hjem')).toContain('administrator');
    expect(testPush('da')).toMatchObject({
      title: 'Tingfinder',
      body: 'Notifikationer når frem til denne enhed.',
    });
  });
  it('renders every mail kind in Danish with links and escaping preserved', () => {
    expect(new Set(EVERY_MAIL.map((m) => m.kind)).size).toBe(Object.keys(MESSAGES.da).length);
    for (const mail of EVERY_MAIL) {
      const da = messageFor(mail, 'da', ctx),
        en = messageFor(mail, 'en', ctx);
      expect(da.subject, mail.kind).not.toBe(en.subject);
      expect(da.subject).not.toContain('Kept');
      for (const [i, p] of da.paragraphs.entries()) {
        expect(p.trim().length, mail.kind).toBeGreaterThan(0);
        expect(p, mail.kind).not.toBe(en.paragraphs[i]);
        expect(p).not.toMatch(/undefined|NaN/);
      }
      if ('url' in mail) expect(da.action?.url).toBe(mail.url);
      const rendered = renderMail(da, 'da', PUBLIC_URL);
      expect(rendered.html).toContain('TINGFINDER');
      expect(rendered.text).not.toContain('Kept');
    }
  });
  it('has Danish names for every built-in type and field', () => {
    for (const t of BUILTIN_TYPES) {
      expect(builtinTypeName(t.key, 'da'), t.key).toBeTruthy();
      for (const f of t.fields) expect(builtinFieldName(f.key, 'da'), f.key).toBeTruthy();
    }
  });
  it('uses Danish dates, plural forms and report text', () => {
    expect(REMINDER_WORDS.da.headline(REMINDER)).toContain('15. januar 2031');
    expect(REMINDER_COUNT.da(1)).toBe('1 påmindelse');
    expect(REMINDER_COUNT.da(2)).toBe('2 påmindelser');
    const walk = (da: unknown, en: unknown) => {
      if (typeof da === 'string') expect(da.trim()).not.toBe('');
      else if (da && typeof da === 'object') {
        expect(Object.keys(da)).toEqual(Object.keys(en as object));
        for (const k of Object.keys(da))
          walk((da as Record<string, unknown>)[k], (en as Record<string, unknown>)[k]);
      }
    };
    walk(PDF_WORDS.da, PDF_WORDS.en);
  });
});
