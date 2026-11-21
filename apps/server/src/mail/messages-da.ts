// Danish mail for Tingfinder. Technical URLs and event identifiers are unchanged.
import type { SecurityEvent } from '../auth/security.js';
import type { AdminAction, AiCapFacts } from './mailer.js';
import {
  aiPage,
  type Chrome,
  type CoreTable,
  capFactsOf,
  capitalise,
  day,
  deviceName,
  diskFacts,
  type Message,
  type MessageContext,
  mailDay,
  mailTime,
  num,
  page,
  tokens,
} from './message-kit.js';

const ROLE = { admin: 'administrator', member: 'medlem', viewer: 'læser' } as const;
const NOT_YOU = 'Hvis det ikke var dig, skal du nulstille din adgangskode nu fra loginsiden.';
const SECURITY: Record<SecurityEvent, (ctx: MessageContext) => Message> = {
  'passkey-added': () => ({
    subject: 'En adgangsnøgle er føjet til din Tingfinder-konto',
    paragraphs: [
      'En ny adgangsnøgle er føjet til din Tingfinder-konto, og alle andre enheder er logget ud.',
    ],
    footnote:
      'Hvis det ikke var dig, skal du nulstille din adgangskode nu og fjerne adgangsnøglen under Indstillinger → Login og sikkerhed.',
  }),
  'two-factor-disabled': () => ({
    subject: 'Totrinslogin er slået fra',
    paragraphs: [
      'Totrinsgodkendelse er slået fra for din Tingfinder-konto, og alle andre enheder er logget ud.',
    ],
    footnote:
      'Hvis det ikke var dig, skal du nulstille din adgangskode nu og slå totrinslogin til igen.',
  }),
  'passkey-removed': () => ({
    subject: 'En adgangsnøgle er fjernet fra din Tingfinder-konto',
    paragraphs: [
      'En adgangsnøgle er fjernet fra din Tingfinder-konto, og alle andre enheder er logget ud. Nøglen kan ikke længere bruges til login.',
    ],
    footnote: NOT_YOU,
  }),
  'two-factor-enabled': () => ({
    subject: 'Totrinslogin er slået til',
    paragraphs: [
      'Totrinsgodkendelse er slået til for din Tingfinder-konto, og alle andre enheder er logget ud. Ved login skal du nu indtaste en kode fra din godkendelsesapp.',
    ],
    footnote:
      'Hvis det ikke var dig, skal du nulstille din adgangskode nu og kontrollere Indstillinger → Login og sikkerhed.',
  }),
  'two-factor-replaced': () => ({
    subject: 'Totrinslogin er sat op igen',
    paragraphs: [
      'Totrinsgodkendelse til din Tingfinder-konto er sat op igen med en ny godkendelsesapp, og alle andre enheder er logget ud. Koderne fra den gamle app og de gamle reservekoder virker ikke længere.',
    ],
    footnote:
      'Hvis det ikke var dig, skal du nulstille din adgangskode nu og kontrollere Indstillinger → Login og sikkerhed.',
  }),
  'backup-codes-new': () => ({
    subject: 'Nye reservekoder er oprettet til din Tingfinder-konto',
    paragraphs: [
      'Der er oprettet nye reservekoder til din Tingfinder-kontos totrinslogin, og alle andre enheder er logget ud. De gamle reservekoder virker ikke længere.',
    ],
    footnote: NOT_YOU,
  }),
  'sign-in-unlinked': () => ({
    subject: 'En loginmetode er fjernet fra din Tingfinder-konto',
    paragraphs: [
      'Et eksternt login, for eksempel Google, er fjernet fra din Tingfinder-konto, og alle andre enheder er logget ud. Det kan ikke længere bruges til login.',
    ],
    footnote: NOT_YOU,
  }),
  'password-changed': () => ({
    subject: 'Din Tingfinder-adgangskode er ændret',
    paragraphs: [
      'Adgangskoden til din Tingfinder-konto er ændret, og alle andre enheder er logget ud.',
    ],
    footnote: NOT_YOU,
  }),
  'unverified-account-reset': () => ({
    subject: 'Din mailadresse er bekræftet',
    paragraphs: [
      'Din Tingfinder-adgangskode blev nulstillet fra denne postkasse. Det bekræfter, at kontoens mailadresse tilhører dig.',
      'Adressen var ikke tidligere bekræftet. For at beskytte dig, hvis en anden oprettede kontoen, er alle hidtidige adgangsnøgler, totrinsindstillinger og login på andre enheder fjernet.',
    ],
    footnote:
      'Log ind med din nye adgangskode, og sæt totrinslogin op igen, hvis du bruger det. Hvis du ikke nulstillede adgangskoden, skal du nulstille den igen nu.',
  }),
  'unverified-account-link': () => ({
    subject: 'Din mailadresse er bekræftet',
    paragraphs: [
      'Du loggede ind i Tingfinder med et link sendt til denne postkasse. Det bekræfter, at kontoens mailadresse tilhører dig.',
      'Adressen var ikke tidligere bekræftet. For at beskytte dig, hvis en anden oprettede kontoen, er dens adgangskode, adgangsnøgler, totrinsindstillinger og alle andre enheders login fjernet.',
    ],
    footnote:
      'Vælg en ny adgangskode i kontoindstillingerne, og sæt totrinslogin op igen, hvis du bruger det.',
  }),
};
const ADMIN: Record<AdminAction, (name: string) => Message> = {
  disabled: () => ({
    subject: 'Din Tingfinder-konto er deaktiveret',
    paragraphs: [
      'En administrator har deaktiveret din Tingfinder-konto. Du kan ikke logge ind, før den er aktiveret igen.',
    ],
  }),
  enabled: () => ({
    subject: 'Din Tingfinder-konto er aktiveret igen',
    paragraphs: ['En administrator har aktiveret din konto igen. Du kan logge ind som før.'],
  }),
  'two-factor-reset': () => ({
    subject: 'Totrinslogin er nulstillet på din konto',
    paragraphs: [
      'En administrator har fjernet totrinsgodkendelse fra din konto og logget den ud overalt, typisk fordi du mistede din godkendelsesapp.',
      'Sæt totrinslogin op igen i kontoindstillingerne.',
    ],
  }),
  'signed-out-everywhere': () => ({
    subject: 'Du er logget ud af Tingfinder overalt',
    paragraphs: [
      'En administrator har logget din konto ud på alle enheder. Log ind igen for at fortsætte.',
    ],
  }),
  'instance-admin-granted': () => ({
    subject: 'Du er nu administrator i Tingfinder',
    paragraphs: [
      'Du er blevet serveradministrator og kan nu administrere Tingfinders brugere og indstillinger.',
    ],
  }),
  'instance-admin-revoked': () => ({
    subject: 'Du er ikke længere administrator i Tingfinder',
    paragraphs: [
      'Dine rettigheder som serveradministrator er fjernet. Dine egne lokationer og alt i dem er uændret.',
    ],
  }),
  'password-reset-issued': () => ({
    subject: 'Der er udstedt en nulstilling af din adgangskode',
    paragraphs: [
      'Den ansvarlige for Tingfinder har udstedt en engangsnulstilling af din adgangskode og logget din konto ud overalt.',
      'Du får udleveret en kode, som du kan bruge til at vælge en ny adgangskode.',
    ],
  }),
  'location-ownership-received': (name) => ({
    subject: `Du ejer nu ${name}`,
    paragraphs: [`Den ansvarlige for Tingfinder har gjort dig til ejer af ${name}.`],
  }),
  'location-ownership-moved': (name) => ({
    subject: `${name} har fået ny ejer`,
    paragraphs: [
      `Den ansvarlige for Tingfinder har overdraget ${name} til en ny ejer. Du beholder din adgang som administrator.`,
    ],
  }),
  'token-created': () => ({
    subject: 'Der er oprettet en token til din konto',
    paragraphs: [
      'Den ansvarlige for Tingfinder har oprettet en personlig token til din konto på serveren, til en app som Home Assistant eller en AI-assistent. Den har samme rettigheder som dig på de lokationer, den er oprettet til.',
      'Hvis du ikke bad om det, skal du tilbagekalde den under Indstillinger → Forbindelser.',
    ],
  }),
};
function capOf(c: AiCapFacts): string {
  switch (c.scope) {
    case 'location':
      return `AI-grænsen for ${c.target}`;
    case 'member':
      return c.target ? `AI-grænsen for ${c.target}` : 'en persons AI-grænse';
    case 'account':
      return 'din kontos AI-grænse';
    case 'user':
      return 'din personlige AI-grænse';
    case 'instance':
      return 'serverens AI-grænse';
    case 'instance_account':
      return c.target
        ? `kvoten for ${c.target} på serverens AI-nøgle`
        : 'kvoten på serverens AI-nøgle';
  }
}
const used = (c: AiCapFacts) =>
  c.unit === 'money'
    ? `${c.currency} ${c.used} af ${c.currency} ${c.limit}`
    : `${tokens('da', c.used)} af ${tokens('da', c.limit)} tokens`;
function cap(level: 80 | 100, c: AiCapFacts, ctx: MessageContext, footnote: string): Message {
  const name = capOf(c);
  return level === 80
    ? {
        subject: `Tingfinder: 80 % af ${name} brugt denne måned`,
        paragraphs: [
          `${capitalise(name)} er på ${used(c)} indtil videre denne måned.`,
          'Når grænsen nås, sættes AI på pause indtil den 1. i næste måned. Registreringer gemmes stadig, og deres billeder bliver læst, når AI genoptages.',
        ],
        action: { label: 'Åbn AI-indstillinger', url: aiPage(ctx, c.scope) },
        footnote,
      }
    : {
        subject: `Tingfinder: AI på pause indtil ${day(c.pausedUntil)}`,
        paragraphs: [
          `${capitalise(name)} er nået: ${used(c)} denne måned.`,
          `AI er på pause indtil ${day(c.pausedUntil)}. Registreringer gemmes stadig, og deres billeder læses, når AI genoptages. Hæv eller fjern grænsen for at genoptage tidligere.`,
        ],
        action: { label: 'Genoptag nu', url: aiPage(ctx, c.scope) },
        footnote,
      };
}
export const DA: CoreTable = {
  'magic-link': (m) => ({
    subject: 'Dit loginlink til Tingfinder',
    paragraphs: [
      'Brug linket til at logge ind i Tingfinder. Det virker én gang inden for de næste 15 minutter.',
    ],
    action: { label: 'Log ind', url: m.url },
    footnote:
      'Hvis du ikke bad om at logge ind, kan du ignorere denne mail. Ingen kan logge ind uden linket.',
  }),
  'password-reset': (m) => ({
    subject: 'Nulstil din Tingfinder-adgangskode',
    paragraphs: [
      'Nogen har bedt om at nulstille adgangskoden til din Tingfinder-konto. Brug linket til at vælge en ny. Det virker én gang inden for den næste time.',
    ],
    action: { label: 'Vælg en ny adgangskode', url: m.url },
    footnote:
      'Hvis det ikke var dig, kan du ignorere denne mail. Din adgangskode forbliver uændret.',
  }),
  'email-change-confirm': (m) => ({
    subject: 'Bekræft din nye mailadresse',
    paragraphs: [
      `Nogen, der er logget ind på din Tingfinder-konto, har bedt om at flytte den til ${m.newEmail}. Hvis det var dig, skal du bekræfte det med linket inden for den næste time.`,
    ],
    action: { label: 'Bekræft ændringen', url: m.url },
    footnote:
      'Hvis det ikke var dig, skal du undlade at bruge linket. Kontoen beholder denne adresse. Overvej at skifte din adgangskode.',
  }),
  'email-change-verify': (m) => ({
    subject: 'Bekræft din mailadresse til Tingfinder',
    paragraphs: [
      'Brug linket til at færdiggøre flytningen af din Tingfinder-konto til denne adresse.',
    ],
    action: { label: 'Bekræft adressen', url: m.url },
    footnote:
      'Hvis du ikke forventede dette, kan du ignorere mailen. Intet ændres, før linket bruges.',
  }),
  'email-changed': (m) => ({
    subject: 'Din Tingfinder-mailadresse er ændret',
    paragraphs: [
      `Din Tingfinder-konto bruger nu ${m.newEmail}. Denne adresse modtager ikke længere mails til kontoen.`,
    ],
    footnote: 'Hvis du ikke foretog ændringen, skal du kontakte den ansvarlige for Tingfinder.',
  }),
  'account-deletion': (m) => {
    const when = mailDay('da', m.purgeAfter, m.timezone);
    return {
      subject: `Din Tingfinder-konto slettes den ${when}`,
      paragraphs: [
        `Du har bedt om at få slettet din Tingfinder-konto. Den slettes den ${when} sammen med din personlige lokation og alt i den.`,
        'Indtil da kan du logge ind for at se datoen og beholde kontoen. Det, du har føjet til andres lokationer, bliver der.',
      ],
      footnote:
        'Hvis du ikke bad om dette, skal du logge ind nu, vælge Behold min konto og skifte din adgangskode.',
    };
  },
  'report-ready': (m) => {
    const name = {
      inventory: 'Oversigt over ting',
      insurance: 'Forsikringsrapport',
      vehicle_history: 'Køretøjshistorik',
    }[m.report];
    return {
      subject: m.place ? `${name}: ${m.place}` : name,
      paragraphs: [
        m.attached
          ? 'Tingfinder har lavet den rapport, du bad om. Den er vedhæftet som PDF.'
          : 'Tingfinder har lavet den rapport, du bad om, men den er for stor til at vedhæfte. Udskriv den igen fra Tingfinder for at hente den.',
      ],
      footnote:
        'Planlagte rapporter findes under Indstillinger → Mig → Notifikationer, hvor du kan stoppe dem.',
    };
  },
  invite: (m) => ({
    subject: m.inviterName
      ? `${m.inviterName} har inviteret dig til ${m.locationName} på Tingfinder`
      : `Du er inviteret til ${m.locationName} på Tingfinder`,
    paragraphs: [
      m.inviterName
        ? `${m.inviterName} har inviteret dig til ${m.locationName} som ${ROLE[m.role]}.`
        : `Du er inviteret til ${m.locationName} som ${ROLE[m.role]}.`,
      'Tingfinder holder styr på dine ting, hvor de er, og hvad der skal gøres ved dem.',
    ],
    action: { label: 'Accepter invitationen', url: m.url },
    footnote:
      'Hvis du ikke forventede invitationen, kan du ignorere den. Intet sker, medmindre du accepterer.',
  }),
  'sign-up-existing': (_m, ctx) => ({
    subject: 'Nogen forsøgte at oprette en konto med din mailadresse',
    paragraphs: [
      'Nogen forsøgte at oprette en Tingfinder-konto med denne adresse, som allerede har en konto. Der blev ikke oprettet en ny konto.',
      'Hvis det var dig, skal du logge ind i stedet. Har du glemt din adgangskode, kan du nulstille den fra loginsiden.',
    ],
    action: { label: 'Log ind', url: page(ctx, '/signin') },
    footnote: 'Hvis det ikke var dig, behøver du ikke gøre noget.',
  }),
  'security-notice': (m, ctx) => SECURITY[m.event](ctx),
  'backup-code-used': (m) => {
    const when = mailTime('da', m.at, m.timeZone);
    const device = deviceName(m, (browser, os) => `${browser} på ${os}`);
    return {
      subject: 'En reservekode blev brugt til at logge ind på din Tingfinder-konto',
      paragraphs: [
        device
          ? `En reservekode blev brugt til at logge ind på din Tingfinder-konto den ${when} fra ${device}.`
          : `En reservekode blev brugt til at logge ind på din Tingfinder-konto den ${when}.`,
        m.left === 0
          ? 'Det var din sidste reservekode. Opret nye under Indstillinger → Login og sikkerhed → Nye reservekoder.'
          : m.left === 1
            ? 'Du har 1 reservekode tilbage.'
            : `Du har ${m.left} reservekoder tilbage.`,
        'Hvis du brugte koden, fordi din godkendelsesapp er væk, skal du sætte totrinslogin op igen med en ny app under Indstillinger → Login og sikkerhed → Sæt op igen. Du får også nye reservekoder.',
      ],
      footnote:
        'Hvis det ikke var dig, skal du nulstille din adgangskode nu fra loginsiden. Opret derefter nye reservekoder under Indstillinger → Login og sikkerhed → Nye reservekoder. De gamle koder holder op med at virke. Log også ud på alle andre enheder under Indstillinger → Sessioner og enheder → Log ud på alle andre enheder.',
    };
  },
  'admin-action': (m) => ({
    ...ADMIN[m.action](m.locationName ?? ''),
    footnote: 'Dette er en automatisk meddelelse om din konto.',
  }),
  'owner-new-member': (m) => ({
    subject: `${m.memberName} er tilmeldt ${m.locationName}`,
    paragraphs: [
      m.managed
        ? `${m.memberName} er føjet til ${m.locationName} som en administreret konto med rollen ${ROLE[m.role]}.`
        : `${m.memberName} har nu adgang til ${m.locationName} som ${ROLE[m.role]}.`,
    ],
    footnote:
      'Som ejer modtager du denne besked for hvert nyt medlem. Du kan ændre eller fjerne medlemmer i lokationens indstillinger.',
  }),
  'ai-cap': (m, ctx) =>
    cap(
      m.level,
      m.cap,
      ctx,
      'Du modtager denne mail, fordi du har sat grænsen, eller den omfatter dit arbejde. Den sendes én gang om måneden.',
    ),
  'admin-alert': (m, ctx) => {
    const footnote =
      'Du modtager denne mail som administrator i Tingfinder. Den sendes højst én gang om dagen, så længe problemet varer.';
    const status = () => ({ label: 'Åbn statussiden', url: page(ctx, '/admin/status') });
    const backups = () => ({ label: 'Åbn sikkerhedskopier', url: page(ctx, '/admin/backups') });
    const jobs = () => ({ label: 'Åbn fejlede job', url: page(ctx, '/admin/jobs') });
    if (m.alert === 'ai_instance_cap_warning' || m.alert === 'ai_instance_cap_reached') {
      const c = capFactsOf(m.details);
      if (c) return cap(m.alert === 'ai_instance_cap_warning' ? 80 : 100, c, ctx, footnote);
    }
    if (m.alert === 'ai_instance_key_rejected')
      return {
        subject: 'Tingfinder: serverens AI-nøgle blev afvist',
        paragraphs: [
          `${String(m.details.provider ?? 'Udbyderen')} afviste serverens AI-nøgle. Det AI-arbejde, som nøglen betaler for, venter derfor.`,
          'Udskift nøglen i administratorens AI-indstillinger. Ventende arbejde fortsætter, når en ny nøgle er gemt.',
        ],
        action: { label: 'Åbn AI-indstillinger', url: page(ctx, '/admin/ai') },
        footnote,
      };
    if (m.alert === 'failed_jobs_rising')
      return {
        subject: 'Tingfinder: baggrundsjob fejler',
        paragraphs: [
          `${num(m.details.failedLastHour)} baggrundsjob fejlede den seneste time.`,
          'Listen over fejlede job viser, hvad der fejlede og hvorfor. Derfra kan du prøve igen eller kassere dem.',
        ],
        action: jobs(),
        footnote,
      };
    if (m.alert === 'backup_failed')
      return {
        subject: 'Tingfinder: nattens sikkerhedskopi fejlede',
        paragraphs: [
          `Nattens sikkerhedskopi blev ikke færdig: ${String(m.details.error ?? '')}`,
          m.details.lastOk
            ? `Den seneste vellykkede sikkerhedskopi blev færdig den ${day(m.details.lastOk)}. Indtil en ny lykkes, er intet gemt siden da med i en sikkerhedskopi.`
            : 'Ingen sikkerhedskopi er lykkedes endnu. Intet i Tingfinder er derfor sikkerhedskopieret.',
        ],
        action: status(),
        footnote,
      };
    if (m.alert === 'backup_stale')
      return {
        subject: 'Tingfinder: ingen sikkerhedskopi i over 36 timer',
        paragraphs: [
          m.details.lastOkAt
            ? `Den seneste vellykkede sikkerhedskopi blev færdig den ${day(m.details.lastOkAt)}. Tingfinder tager en kopi hver nat, så den natlige sikkerhedskopiering virker ikke længere.`
            : 'Sikkerhedskopiering er sat op, men ingen kopi er færdig endnu.',
          'Siden med sikkerhedskopier viser hver kørsel, og hvorfor den fejlede. Start Tingfinders baggrundsproces igen, hvis den ikke kører.',
        ],
        action: backups(),
        footnote,
      };
    if (m.alert === 'disk_space_low') {
      const d = diskFacts(m.details, true);
      return {
        subject: d.backup
          ? 'Tingfinder: disken til sikkerhedskopier er næsten fuld'
          : 'Tingfinder: datadisken er næsten fuld',
        paragraphs: [
          `Disken er ${d.percent} % fuld med ${d.gb} GB tilbage.`,
          d.backup
            ? 'Når disken bliver fuld, fejler nattens sikkerhedskopi. Frigør plads, brug en større disk, eller behold færre kopier i indstillingerne for sikkerhedskopiering.'
            : 'Når disken bliver fuld, kan Tingfinder ikke gemme nye billeder eller dokumenter, og databasen kan stoppe. Frigør plads, eller brug en større disk.',
        ],
        action: status(),
        footnote,
      };
    }
    if (m.alert === 'bucket_versioning_off')
      return {
        subject: 'Tingfinder: versionshistorik er slået fra på fillageret',
        paragraphs: [
          'Tingfinder gemmer sine filer i en S3-bucket, og den natlige sikkerhedskopi lader dem blive der. Versionshistorik er slået fra, så en fil, der slettes eller overskrives ved en fejl eller af nogen med lagerets nøgle, ikke kan gendannes.',
          'Slå versionshistorik til for bucketen hos din lagerudbyder. Advarslen forsvinder, når næste sikkerhedskopi ser, at det er slået til.',
        ],
        action: status(),
        footnote,
      };
    if (m.alert === 'restore_drill_due')
      return {
        subject: 'Tingfinder: tid til at afprøve gendannelse',
        paragraphs: [
          m.details.lastDrillAt
            ? `Seneste gendannelsesprøve var den ${day(m.details.lastDrillAt)}, for over 30 dage siden.`
            : 'Der er endnu ikke udført en gendannelsesprøve.',
          'Prøven gendanner den seneste sikkerhedskopi i en testdatabase og kontrollerer hver tabel, så du ved, at sikkerhedskopierne kan gendannes. Kør `kept admin backup drill` som beskrevet i gendannelsesvejledningen.',
        ],
        action: backups(),
        footnote,
      };
    if (m.alert === 'backup_verify_failed')
      return {
        subject: 'Tingfinder: den ugentlige backupkontrol fandt et problem',
        paragraphs: [
          `Den ugentlige kontrol af sikkerhedskopilageret fejlede: ${String(m.details.error ?? '')}`,
          'Dine sikkerhedskopier kan muligvis ikke gendannes. Åbn Sikkerhedskopier for at se problemet, og kontrollér igen, når det er løst.',
        ],
        action: backups(),
        footnote,
      };
    if (m.alert === 'backup_suspicious_size')
      return {
        subject: 'Tingfinder: den nyeste sikkerhedskopi virker for lille',
        paragraphs: [
          'Den nyeste sikkerhedskopi er meget mindre end den seneste vellykkede. Tingfinder beholdt den, men slettede ingen ældre kopier, så de gode kopier er bevaret.',
          'Hvis meget blev slettet med vilje, er alt i orden, og de næste sikkerhedskopier fjerner advarslen. Ellers skal du finde årsagen, før du gendanner noget.',
        ],
        action: backups(),
        footnote,
      };
    if (m.alert === 'webhook_failing')
      return {
        subject: 'Tingfinder: en lokations webhook bliver ved med at fejle',
        paragraphs: [
          `En webhook på en af Tingfinders lokationer har fejlet ved alle leveringer siden ${day(m.details.since)}. Tingfinder har derfor markeret den som fejlramt.`,
          'Tingfinder prøver igen ved hver ny hændelse. Lokationens ejere og administratorer kan rette eller fjerne den under Lokationsindstillinger → Webhooks.',
        ],
        action: status(),
        footnote,
      };
    if (m.alert === 'reminders_not_scanned')
      return {
        subject: 'Tingfinder: påmindelser bliver ikke længere sendt',
        paragraphs: [
          m.details.lastOkAt
            ? `Tingfinder kontrollerede sidst for forfaldne påmindelser den ${day(m.details.lastOkAt)}, for over 2 timer siden. Ingen modtager nye påmindelser, før kontrollen kører igen.`
            : 'Tingfinder har endnu ikke fuldført en kontrol for forfaldne påmindelser. Ingen modtager derfor påmindelser.',
          'Kontrollen kører hvert 15. minut i Tingfinders baggrundsproces. Listen over fejlede job viser, hvorfor den stoppede. Start baggrundsprocessen igen, hvis den ikke kører.',
        ],
        action: jobs(),
        footnote,
      };
    if (m.alert === 'llm_default_partition')
      return {
        subject: 'Tingfinder: registreringer af AI-kald kræver handling',
        paragraphs: [
          `${num(m.details.rows)} registreringer af AI-kald (${day(m.details.oldest)} til ${day(m.details.newest)}) blev gemt uden for deres månedlige partition.`,
          'Tingfinder kan ikke oprette partitionen for den måned, før registreringerne flyttes ind i den. Den natlige AI-vedligeholdelse bliver derfor ved med at fejle. Flytningen er en databaseopgave for den ansvarlige for Tingfinder.',
        ],
        action: status(),
        footnote,
      };
    return {
      subject: 'Tingfinder: revisionshændelser kræver handling',
      paragraphs: [
        `${num(m.details.rows)} revisionshændelser (${day(m.details.oldest)} til ${day(m.details.newest)}) blev gemt uden for deres månedlige partition.`,
        'Tingfinder kan ikke oprette partitionen for den måned, før hændelserne flyttes ind i den. Den natlige vedligeholdelse bliver derfor ved med at fejle. Flytningen er en databaseopgave for den ansvarlige for Tingfinder.',
      ],
      action: status(),
      footnote,
    };
  },
};
export const DA_CHROME: Chrome = {
  dir: 'ltr',
  linkFallback: 'Hvis knappen ikke virker, kan du kopiere adressen ind i din browser:',
  sentBy: (host) => `Sendt fra Tingfinder på ${host}.`,
  about: (site) => `Tingfinder, det åbne system til at holde styr på dine ting: ${site}`,
};
