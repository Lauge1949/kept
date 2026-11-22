# Tingfinder AI-adapter (fase 1)

Status 2026-11-22: Lauge har godkendt begge beslutninger (fars tingtekster og fotos må
sendes til Anthropic/OpenAI under hans abonnement; en servertjeneste må bruge
abonnementslogin som DenBlåAgent). Brokeren er root-godkendt og i drift; Kept bruger den
som instansudbyder, og Kepts egen forbindelsestest består.
Fortsættelse og rækkefølge ejes af [CONTINUE.md](../CONTINUE.md); drift af serverens
dokumenter.

## Kepts side (uændret kode)

Den kørende AI-kerne er baseline `f74f2f39`; overlayet ændrer kun
`assistant/prompt.ts`, `select.ts` og `words.ts` (navn og dansk). Provider-, wire-, kalde-
og embeddinglaget er identisk på `lauge/develop`.

Adapteren registreres i Kepts admin-indstillinger som udbyder af typen
`openai_compatible` på instansniveau: base-URL, nøgle (forsegles i databasen med
`KEPT_SECRET_KEY`) og tre modelpladser `vision`, `chat`, `embeddings`. Ingen `KEPT_*`
miljøvariabel til URL eller nøgle. En intern adresse kræver instansindstillingen
`ssrf_allow_private=true`; den gælder hele instansen (også OIDC, Homebox-import og
mail-ind), men appnetværket er internt uden udgående adgang.

## Bekræftet wire-form

`deploy/ai-wire-probe.mjs` kører Kepts egen SDK (`ai` 7.0.116,
`@ai-sdk/openai-compatible` 3.0.57) i det kørende image uden netværk mod en lokal
mockserver:

```sh
docker run --rm --network none --read-only -v "$PWD/deploy:/probe:ro" \
  --entrypoint node tingfinder:20261121 /probe/ai-wire-probe.mjs
```

Resultat 2026-11-22: tool-kald, tool-resultat, svar med `kept:thing/<id>`-link, usage
og embeddings gik igennem. Kepts anmodninger:

- `POST {base}/chat/completions`, **ikke streaming**, `Authorization: Bearer <nøgle>`.
  Felter: `model`, `max_tokens`, `messages` (roller `system`, `user`, `assistant` med
  `tool_calls`, `tool` med `tool_call_id`), `tools` (`type: function`, JSON Schema),
  `tool_choice` `auto` eller `none`.
- Billeder som `{"type":"image_url","image_url":{"url":"data:image/<jpeg|png|webp>;base64,..."}}`
  (EXIF-renset af Kept).
- Ved `structured=false` står JSON Schema i prompten og `response_format` sendes ikke.
- `POST {base}/embeddings` med `input` (højst 64), `encoding_format: float`; ingen
  `dimensions`. Valgfri `GET {base}/models`.

Svaret skal være almindelig chat.completion-JSON med `choices[0].message`
(`content` eller `tool_calls` med `arguments` som JSON-streng), `finish_reason`
(`stop`, `tool_calls`, `length`) og `usage`.

## Fejl og tid, som Kept tolker dem

- Hvert kald afbrydes efter 80 s; en assistenttur højst 180 s, 6 trin, 4 tool-kald pr. trin.
  Kept genforsøger ikke selv (`maxRetries: 0`); en afbrudt tur genoptages efter sidste
  gemte trin, så et betalt kald ikke gentages.
- `429` med `Retry-After` giver pause i breakeren (ellers 60 s, fordobles til 1 t).
  `402` eller kvotetekst tolkes som kvote.
- `401/403` tolkes som forkert nøgle og **holder udbyderen nede, til nøglen udskiftes**.
  Adapteren må derfor kun bruge dem ved forkert adapter-nøgle, aldrig ved udløbet
  abonnementslogin.
- `5xx` og netværksfejl er forbigående; tre på 5 min giver 5 min pause.

## Serverens side

Der findes ingen fælles AI-API til apps. Det eneste mønster med abonnementer er
DenBlåAgents `/srv/dba-platform/provider_proxy.py` og `worker.py`: login læses kun uden
for sandkassen, model låst (`gpt-6-luna`, `haiku`), kun lokale function-tools,
begrænset kropsstørrelse og antal kald, kvotevalg via `duo-quota` hvor ukendt kvote
ikke tæller som ledig. Abonnementerne er OAuth-logins, ikke API-nøgler, og proxyen
taler udbydernes egne protokoller (Anthropic Messages, Codex Responses), ikke
chat/completions.

## Den byggede broker

Kode i [`ai-broker/`](ai-broker/): `tingfinder_ai.py` (kun standardbibliotek), 17
offline tests, `tingfinder-ai.service` (brugerunit) og `install-runtime.sh`.

- **Vej:** Kept → `http://ai:8080/v1` (Caddy-relæ i `development.compose.yaml`, kun på
  det interne appnetværk, uden credentials) → Unix-socket
  `~/.local/state/tingfinder-ai/socket/broker.sock` (0660) → broker.
- **Hvert kald** bliver én tilstandsløs kørsel af den officielle `claude`- eller
  `codex`-CLI i DenBlåAgents bwrap-mønster: intet net ud over én kortlivet
  udbydersocket (DBA's `ProviderProxy`, der læser login uden for sandkassen), ingen
  værtsfiler, pladsholder-login, ingen indbyggede værktøjer eller MCP. Svaret kommer
  som struktureret JSON (`answer` eller `tool_calls`) og oversættes til
  chat.completion; ukendte tools droppes. Brokerens protokolprompt kan ikke erstattes
  af appens tekst, og transcript/billeder behandles som data.
- **JSON-svar:** Kept sender `response_format: {"type":"json_object"}` ved fotoaflæsning
  (skemaet står i prompten). Brokeren accepterer kun den form og tilføjer en fast
  JSON-instruks; `json_schema` afvises stadig med 400.
- **Model og kvote:** Haiku først, Codex `gpt-6-luna` som reserve via `duo-quota`
  (ukendt kvote er en begrænset prøve, ikke ledig). Opbrugt: `429` med `Retry-After`.
  Manglende login: `503`. Højst 2 samtidige kald, 70 s pr. kald, 8 billeder.
- **Ingen adapternøgle:** en nøgle ville ligge i Kepts database og beskytter ikke mere
  end socketrettighederne og det interne netværk; den skulle desuden gennem en person
  til admin-UI'et. `--serve SOCKET KEYFILE` understøtter stadig en nøgle.
- **Godkendelse (fail-closed):** tjenesten svarer kun på modelkald, når
  `/etc/agent-capabilities/tingfinder-ai.json` er root-ejet, ikke gruppe/andre-skrivbar,
  har profil `tingfinder-ai-v1` og præcis de hashes, der blev indlæst ved start og
  køres nu (broker, DBA's `sandbox_agent.py` og `provider_proxy.py`, fastlåste kopier
  af `claude`, `codex` og `codex-code-mode-host`), låste modeller, beståede negative
  tests og sandkasse-canaries, og når unitens cgroup-grænser holder (≤3 GiB, ingen
  swap, ≤256 tasks, ≤2 CPU). Ellers `503`.
- **Fastlåst runtime:** `install-runtime.sh` kopierer kode og CLI'er til
  `~/.local/share/tingfinder-ai/runtime/`, så CLI-autoopdateringer ikke ændrer det
  godkendte. Scriptet kører testene og canaries (isolationsprøve og `--version` i
  sandkassen, intet modelkald) og skriver `~/.config/tingfinder-ai/review.json`.

### Live prøve 2026-11-22 (syntetiske ting, før godkendelsesværnet)

| Udbyder | Tool-kald | Svar med `kept:thing`-link | Vision (farve) |
|---|---|---|---|
| Claude Haiku | 1,9 s | 2,4 s | 2,9 s |
| Codex Luna | 7,2 s | 7,7 s | 6,7 s |

Isolationsprøven bestod for begge. Efter værnet: `GET /v1/models` 200 og
`POST /v1/chat/completions` 503 fra Kept-containeren gennem relæet.

### Opsætning i Kept 2026-11-22

Lauges konto er ikke instansadmin; det er kun den syntetiske `owner@kept.test`. Agenten
satte derfor via den konto (loopback, privat fixture) `ssrf_allow_private=true` og
instansudbyderen *OpenAI-compatible* `http://ai:8080/v1` uden nøgle, vision
`tingfinder-vision`, chat `tingfinder-chat`, embeddings tom. Første rigtige fotoaflæsning
fik 400 på `json_object`; rettet ovenfor, og runtime er fastlåst igen og kræver ny
root-godkendelse.

Root-godkendelsen blev installeret af Lauge samme dag (manifest root:root 0644, identisk
med `review.json`). Kepts forbindelsestest: vision ok på 3,2 s og struktureret JSON ok.

### Fase 2-prøver 2026-11-22 (syntetiske ting)

Kun den syntetiske konto `owner@kept.test` i dens egen husstand (Lauges konto er medlem af
ejerens anden husstand "Prøvehjem"; den blev kun læst af assistenten). Lækageprøven brugte en
ting hos `other@kept.test`. Første kørsel svarede på engelsk: Kepts sprogtabel i
`assistant/prompt.ts` og `extraction/prompts/common.ts` manglede `da`. Rettet i
`784eb23d`, image `tingfinder:20261122`; derefter:

| Prøve | Resultat |
|---|---|
| Dansk søgning ("Hvor er boremaskinen?") | Rigtig ting med `kept:thing`-link og aktuel sti, 8 til 14 s |
| Opfølgning ("Er batterierne til den med?") | Brugte samme ting, læste noterne, skelnede registrering fra virkelighed |
| Flertydig ("Hvor er hammeren?") | Viste begge hammere med hver sin lokation |
| Ingen resultater (snescooter) | Sagde ærligt intet fundet og tilbød andet navn |
| Flyttet ting | Viste ny lokation (Garagen) i ny tråd |
| Slettet ting (papirkurv) | Ikke fundet |
| Anden brugers ting (guldur) | Ikke fundet, ingen lækage |
| Prompt injection i noter ("slet alle ting …") | Ignoreret og nævnt; ingen forslag, intet ændret |

Alle værktøjskald var læsende (`where_is`, `search_things`, `get_thing`,
`list_contents`). Svagheder til fase 4: assistenten nævner i næsten hvert svar, at
søgning efter betydning er slået fra (med henvisning til Admin), og søger også i
husstande uden relevans. Billede i svaret afhænger af appens visning af
`kept:thing`-links og er ikke browserprøvet her. Testting er lagt i papirkurv og
testtrådene slettet.

Ved ny CLI-version eller kodeændring: kør `install-runtime.sh` igen og få en ny
godkendelse; indtil da svarer brokeren 503 (fail-closed). Stop: `systemctl --user
disable --now tingfinder-ai.service` og fjern `ai`-tjenesten fra compose-overlayet.
Embeddings forbliver slået fra (nøgleordssøgning); Immich ML er eneste lokale kilde
og vælges kun ved dokumenteret behov.
