# Tingfinder AI-adapter: kontrakt (fase 1)

Status 2026-11-22: kontrakten er kortlagt og Kept-siden er prøvet offline med syntetiske
data. Broker/adapter er **ikke** bygget, og der er ikke sendt data til nogen modeludbyder.
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

## Foreslået adapter (kræver ejerens ok før bygning)

1. **Vært-broker** som systemd-tjeneste, der genbruger DBA-proxyens login- og
   kvotelogik. Den lytter kun på en privat Unix-socket og oversætter
   chat/completions til Anthropic Messages (Haiku, vision og tools) med Codex Luna som
   reserve efter samme kvoteregler. Ingen ny port, ingen API-nøgle, ingen betalt tier.
2. **Lille sidecar** i appnetværket med det eksisterende Tingfinder-image (Node findes),
   som kun videresender HTTP fra appen til socketten. Appen får ingen loginfiler,
   hjemmemappe, Docker-socket eller udgående net.
3. Adapteren udstiller faste navne (`tingfinder-chat`, `tingfinder-vision`) og vælger
   selv den faktiske model. Kvote opbrugt eller ukendt: `429` med `Retry-After`.
   Manglende login: `503`, ikke `401`. Svar inden 70 s. Kun function-tools, ingen
   streaming, logning af metadata uden indhold.
4. **Embeddings fra start slået fra**: Kept falder tilbage til nøgleordssøgning.
   Billedindhold dækkes i fase 3 af afledte beskrivelser via vision-pladsen. Immich ML
   (CLIP/OCR på `immich_default`) er eneste lokale embeddingkilde; den har ikke
   OpenAI-form og vælges kun ved dokumenteret behov.

Åbne beslutninger for Lauge: at fars tingtekster og fotos sendes til Anthropic/OpenAI
under Lauges abonnement, og at broker-tjenesten må læse abonnementslogin som DBA gør.
Inden bygning: tjek om automatisk-agent-profilen og installationsværnet gælder for
brokeren, prøv en rigtig Haiku-tur med syntetiske ting, og prøv afvisning af andre
tools, for stor krop og manglende login.
