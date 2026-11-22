# Tingfinder: fortsæt her

Senest ajourført 2026-11-22. Dette er projektets fortsættelsesplan, så en ny
agentsession kan arbejde videre uden chathistorikken. Produktbeslutninger ejes af
[FORK.md](FORK.md); build og test af [deploy/README.md](deploy/README.md).
Opdatér denne plan efter hver afsluttet fase eller før et afbrudt forløb.

## Første handling i næste session

Kortlæg forbindelsen mellem Kepts AI-interface og serverens eksisterende
kvotestyrede modelvalg. Lever en konkret adapterkontrakt og en afgrænset prøve med
syntetiske data, før integrationen får adgang til rigtige inventarer. Antag ikke,
at serverens abonnementer kan bruges som almindelige OpenAI-kompatible API-nøgler.
Hvis ejeren fortsat oplever loginfejl på telefonen, prioriteres den fejl først.

## Formål og allerede trufne valg

Appen er en gave til Lauges far: tag et foto af en ting, giv den titel og fysisk
lokation, og find den igen via søgning eller en enkel AI-chat. Beskrivelse er valgfri.

- Vi videreudvikler den eksisterende Kept-fork, ikke en ny app fra bunden.
- Navnet er **Tingfinder**; det oprindelige ravgule K-logo og design bevares.
- Dansk er et officielt sprog. Nye funktioner skal også være oversat.
- Kepts oversigt over chattråde er accepteret. Vis en almindelig chat, uden
  agentjobs, sessions-ID'er eller teknisk harness i brugerfladen.
- AI skal bruge titler, beskrivelser, lokationer og billedindhold. Svar skal vise
  eksisterende opslag med deres aktuelle lokation, eget billede og fungerende link.
- Genbrug DenBlåAgents kvotestyrede modelvalg med den mindste egnede model.
  Ingen betalt overforbrug eller nye udbyderkonti. Etablerede ejerregler for
  udbyderskift gælder; en ukendt kvote tæller ikke som ledig kapacitet.
- Bevar private brugerinventarer, upstream-attribution og AGPL-licens.

## Verificeret kontrolpunkt

Read-only kontrol 2026-11-22: app, database og fælles logincontainer er healthy.
Git er ren på `lauge/develop`, og efter fetch matcher HEAD origin:
`2ad27e5d8738ff1590fc84ff22103dd07b2c6878` (før dette dokumentationscommit).

| Område | Status |
| --- | --- |
| Fork, egen database, fotolager og beskyttet HTTPS-preview | Udført |
| Capture kræver titel og konkret rum/beholder; slet én uden at kassere resten | Udført og browserprøvet |
| Tingfinder-navn, bevaret logo og dansk oversættelse | Udført og udrullet |
| Mistet loginformularsession gav rå CSRF-fejl | Rettet i det fælles loginlag; offentlig browserprøve består |
| Bekræftelse af rettelsen på ejerens fysiske iPhone | Udestår |
| AI via eksisterende abonnement/kvoterouter | Ikke implementeret |
| Billedbaseret AI-søgning og valg af embeddings | Ikke implementeret/afklaret |
| Fysisk iPhone/Android-PWA, WebKit og værtsboot | Ikke verificeret |

Preview: <https://dev-kept.laugesbin.win/>. Teknisk URL og `KEPT_*`-nøgler er bevaret.
Der er både fælles serverlogin og en indre appkonto. Ejeren har allerede oprettet
konto og været logget ind. Genudsted ikke invitationer og nulstil ikke opsætningen.

**Kilde og runtime er forskellige:** Git-grenen bygger på nyere upstream-kode,
men den kørende server er stabil **1.14.7**, kildebaseline
`f74f2f39161ab8caa5992978a5ac0aa2580e0672`, med et udtrykkeligt overlay.
Det kørende image `tingfinder:20261121` har overlay-kildecommit
`f8f42a054ef4beb8af07ba87e6a1f7911843bfa3`. De efterfølgende commits til
`2ad27e5d` ændrer tests. Deploy aldrig hele nyere develop med migrationer som en
genvej til næste funktion. Brug [det aktuelle build](deploy/build-tingfinder.sh)
og [overlaylisten](deploy/tingfinder-files.txt), og kontrollér også den stabile kilde.

Testbevis fra 2026-11-21: 98 webtests og 278 shared-/sprog-/gendannelsestests,
TypeScript, produktionsbuild, bundlebudget og 6989 aktive oversættelser består.
`deploy/tingfinder-smoke.mjs` og `deploy/capture-smoke.mjs` består på den kørende
udgave i Chromium ved mobil- og desktopbredder. Dansk PDF er kompileret i faktisk
runtime. Loginrettelsen har 55 isolerede tests og offentlig HTTPS-browserprøve.
Det er ikke bevis for fysisk Safari/PWA eller fuldt offentligt login med ejerens
adgangskode. Claude-review fik timeout og tælles ikke som bestået.

## Arbejdsrækkefølge og acceptkrav

1. **Afklar AI-kontrakten.** Læs serverens kanoniske app-/routerdokumentation og
   faktiske integrationskode. Undersøg Kepts `apps/server/src/ai/`,
   `apps/server/src/assistant/`, `apps/server/src/embeddings/provider.ts` og
   `packages/shared/src/assistant.ts`, både på grenen og i den stabile baseline.
   Beskriv protokol, autentificering, streaming, modelkapabiliteter, timeout,
   afbrydelse, kvoteafvisning og retry uden dobbelte jobs. Afklar særskilt, om
   embeddings og billedmodeller understøttes. Lever en testet syntetisk prøve;
   ved manglende adgang dokumenteres den konkrete blokering.
2. **Byg en afgrænset tekstassistent.** Søg kun i den indloggede brugers ting.
   Brug eksisterende værktøjer, hvor de opfylder kravene, og håndhæv læseadgang
   uden for modellen. Revalidér ejerskab og aktuelle felter, før svaret viser
   opslagets billede, lokation og link. Test dansk søgning, flertydige spørgsmål,
   ingen resultater, flyttede/slettede ting og dialogopfølgning. En tekstversion
   er et delmål; det opfylder ikke alene kravet om billedindhold.
3. **Tilføj billedforståelse.** Vælg en understøttet, kvotegodkendt vision/OCR-vej.
   Overvej afledte billedbeskrivelser ved upload frem for at sende hele fotolageret
   ved hvert spørgsmål. Bind afledt data til bruger og opslag; rettelser og
   sletninger skal slå igennem. Test fund af en ting ud fra et synligt kendetegn,
   der ikke står i titlen. Indfør kun embeddings eller nye tjenester ved et
   dokumenteret behov og efter serverens installationsregler.
4. **Afslut chatoplevelsen.** Bevar trådoversigten og Tingfinders danske design.
   Vis enkle svar med faktiske opslag og forståelig besked ved manglende kvote
   eller forbindelse. Spørg ved tvivl; opfind aldrig en ting eller dens lokation.
   Test at tekst i billeder/beskrivelser ikke kan ændre værktøjsrettigheder,
   lække andre brugeres data eller udløse skrivehandlinger.
5. **Gør udgaven klar til far.** Afprøv faktisk iPhone Safari, installeret PWA og
   Android: login, foto, obligatoriske felter, slet én, søgning, AI-link og
   genåbning. Kontrollér offlineadfærd og mislykket upload uden datatab.
   Afprøv backup/restore isoleret og dokumentér bootbevis efter serverreglerne.
   En eventuel permanent URL/produktionsflytning planlægges særskilt.

## Serverkontekst og sikker fortsættelse

På hjemmeserveren er repoet `/mnt/SSD1000/github/kept`. Læs først
`/mnt/SSD1000/agents/AGENTS.md`, områdereglerne og `/mnt/SSD1000/github/AGENTS.md`.
Disse lokale kilder ejer drift og rettigheder; kopier ikke hemmeligheder herind:

| Emne | Kanonisk serverdokument under `/mnt/SSD1000/agents/computer/hjemmeserver/` |
| --- | --- |
| Aktuel drift, images, private konfigurationsstier, build og acceptbevis | `operations/development.md`, afsnit `kept-fork-2026-11-21` |
| Fælles login og CSRF-recovery | `reference/clients.md` |
| Rollbackpunkter, ejer og reviewdatoer | `operations/rollback.md` |
| Appkrav og DenBlåAgent | `reference/app-standard.md`, `services/dba-platform.md` |
| Modelvalg, kvote og peer-runtime | `operations/peer-models.md` |
| Nye afhængigheder og begrænset agentadgang | `reference/agent-security.md`, `operations/automatic-agents.md` |

Appnetværket er internt uden udgående AI-adgang. En adapter kræver en bevidst,
afgrænset forbindelse; løs det ikke ved at give appen fri netadgang, serverens
hjemmemappe, Docker-socket eller udbydernes loginfiler. Første assistent skal være
læsebaseret og have begrænset kontekst, tidsforbrug og renset logning.

Start hver session med Git-status/fetch, relevante aktive jobs og faktisk runtime.
Undersøg udfaldet af afbrudte commits/deploys før gentagelse. Bevar konti, database,
fotos og andres arbejde. Brug syntetiske fixtures; kør aldrig bootstrap/reset eller
`down -v` på den eksisterende instans. Følg det aktuelle deployforløb og rollback
frem for gamle baselinescripts. Ingen credentials, cookies, billeder eller dumps i Git.

Afslut med relevante tests, præcist commit/push til aftalt branch og verificeret
remote-HEAD. Opdatér denne plans kontrolpunkt, næste handling og åbne gab samt
serverens kanoniske driftsdokumenter ved driftsændringer. En dokumentationsændring
kræver ikke genbygning eller genstart af appen.
