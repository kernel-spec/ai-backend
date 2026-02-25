# Project Overview — `ai-backend`

> Cíl: pochopit projekt do 5 minut. Každé tvrzení je doloženo konkrétním souborem.

---

## A) Co to je

**`ai-backend`** je Cloudflare Worker (TypeScript), který slouží jako auditovatelná HTTP proxy brána nad OpenAI Chat Completions API — přijme uživatelský dotaz, předá ho modelu GPT-4.1 a vrátí odpověď obohacenou o unikátní `request_id` a SHA-256 otisky vstupu i výstupu.

*Důkaz:* `wrangler.toml:1–2` (`name = "ai-backend"`, `main = "src/index.ts"`), `src/index.ts:34–35` (`fetch("https://api.openai.com/v1/chat/completions", …)`).

---

## B) Pro koho a k čemu

- **Autoři Custom GPT** — potřebují serverový endpoint, který skryje a centralizuje OpenAI API klíč (`src/index.ts:39`).
- **Vývojáři s požadavkem na audit** — každá interakce dostane SHA-256 otisk vstupu i výstupu pro zpětnou dohledatelnost (`src/index.ts:25–70`).
- **Edge-performance aplikace** — Cloudflare Workers zajišťují nízkou latenci globálně bez nutnosti vlastního serveru (`wrangler.toml`).
- **Týmy sdílející jeden API klíč** — klíč je uložen jako Cloudflare Secret, nikdy není v kódu ani CI logu (`wrangler.toml:5–6`).
- **Prototypy a MVP AI produktů** — minimální codebase (jeden soubor, zero dependencies) umožňuje rychlý start.

---

## C) Struktura repa

| Cesta | Role | Poznámka |
|---|---|---|
| `src/index.ts` | Jediný Worker handler | Veškerá business logika: routing, validace, volání OpenAI, audit hash |
| `wrangler.toml` | Cloudflare Workers konfigurace | Název, entrypoint, `compatibility_date`; secrets jsou v CF UI |
| `.github/workflows/deploy.yml` | CI/CD pipeline | Push na `main` → automatický deploy přes `wrangler-action@v3` |
| `.env.example` | Šablona lokálního prostředí | Názvy proměnných s komentáři; bez skutečných hodnot |
| `README.md` | Uživatelská dokumentace | Quickstart, Mermaid diagram, API reference, deploy instrukce |
| `docs/audit.md` | Repo Intelligence Report | Detailní auditní zpráva s grep důkazy a evidence indexem |
| `docs/overview.md` | Tento soubor | Stručný A–H přehled pro nové přispěvatele |
| `contracts/README.md` | Placeholder | Prázdný; vyhrazen pro OpenAPI/JSON Schema kontrakty |

---

## D) Jak to spustit, testovat a deployovat

### Předpoklady

```bash
npm install -g wrangler   # Wrangler CLI (vyžaduje Node.js ≥ 20)
```

### Lokální vývoj

```bash
# 1. Klonuj repozitář
git clone https://github.com/kernel-spec/ai-backend.git
cd ai-backend

# 2. Nastav OpenAI API klíč pro lokální běh
echo "OPENAI_API_KEY=sk-..." > .dev.vars

# 3. Spusť lokální dev server (http://localhost:8787)
wrangler dev
```

### Testovací volání

```bash
# Platný požadavek
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"input": "Napiš hello world v Pythonu."}'

# Chybný požadavek (chybí input) → 400
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{}'

# Nepovolená metoda → 405
curl http://localhost:8787
```

> **Upozornění:** Repozitář neobsahuje žádné automatizované testy (unit/integration). Testování je výhradně manuální.

### Deploy do produkce

```bash
# Nastav produkční secret (jednou, nebo při rotaci klíče)
wrangler secret put OPENAI_API_KEY

# Manuální deploy
wrangler deploy
```

---

## E) CI/CD přehled

| Soubor | Workflow název | Spouštěč | Kroky |
|---|---|---|---|
| `.github/workflows/deploy.yml` | Deploy Worker | `push` na větev `main` | 1. `actions/checkout@v4` → 2. `actions/setup-node@v4` (Node 20) → 3. `cloudflare/wrangler-action@v3` (deploy) |

**Vyžadovaný GitHub Secret:** `CLOUDFLARE_API_TOKEN`  
*Nastavení:* GitHub repozitář → Settings → Secrets and variables → Actions → New repository secret.

---

## F) Integrace & konfigurace

### ENV proměnné a secrets

| Proměnná | Kde se čte | Jak nastavit |
|---|---|---|
| `OPENAI_API_KEY` | `src/index.ts:39` — `env.OPENAI_API_KEY` | `wrangler secret put OPENAI_API_KEY` (produkce) / `.dev.vars` (lokálně) |
| `CLOUDFLARE_API_TOKEN` | `.github/workflows/deploy.yml:22` — `secrets.CLOUDFLARE_API_TOKEN` | GitHub Actions Secret |

### Externí služby

| Služba | URL / SDK | Kde se používá |
|---|---|---|
| OpenAI Chat Completions | `https://api.openai.com/v1/chat/completions` | `src/index.ts:34–50` |
| Cloudflare Workers | runtime (wrangler) | `wrangler.toml`, deploy pipeline |

---

## G) Nejasnosti / chybějící info

| Oblast | Co chybí | Kde hledat / co ověřit |
|---|---|---|
| **Klientská autentizace** | Žádný Bearer/JWT/API-key pro volající klienty — Worker je veřejně přístupný | Nelze doložit ochranný mechanismus; ověřit u autora nebo přidat Cloudflare Access |
| **Rate limiting** | Žádné omezení počtu požadavků | Nelze doložit; riziko nekontrolovaných OpenAI nákladů |
| **Testy** | Žádné unit ani integration testy | Repozitář neobsahuje testovací soubory ani testovací skript |
| **Logování / observability** | Žádný structured log ani error tracking | Pouze HTTP status kódy; žádný Sentry, Logflare ani podobný nástroj |
| **`contracts/README.md`** | Prázdný soubor | Neznámý záměr; ověřit, zda je plánováno OpenAPI schema |
| **CORS hlavičky** | Chybí `Access-Control-Allow-Origin` | Přímé volání z prohlížeče selže; ověřit, zda je to záměr (server-to-server only) |
| **Model a parametry** | `gpt-4.1`, `temperature: 0.2` jsou hardcoded | Nelze konfigurovat bez změny kódu; ověřit záměr u autora |

---

## H) Doporučené další kroky

Prioritizováno dle dopadu a rychlosti implementace:

1. **Přidat klientskou autentizaci** *(~30 min)* — přidat Cloudflare secret `BACKEND_API_KEY` a ověřovat `Authorization: Bearer <token>` hlavičku před zpracováním požadavku. Zabrání neautorizovanému přístupu a nekontrolovaným nákladům.

2. **Přidat rate limiting** *(~20 min)* — použít [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) nebo KV-based počítadlo na IP/token. Ochrana před zneužitím.

3. **Typovat `env` parametr** *(~5 min)* — nahradit `env: any` (`src/index.ts:2`) za `interface Env { OPENAI_API_KEY: string }`. Zajistí compile-time bezpečnost a čitelnost.

4. **Přidat CORS hlavičky** *(~10 min)* — přidat `Access-Control-Allow-Origin` a zpracovat `OPTIONS` preflight, pokud je Worker volán přímo z prohlížeče.

5. **Přidat první unit test** *(~30 min)* — použít [Vitest](https://vitest.dev/) + `@cloudflare/workers-types` a otestovat alespoň: 400 na chybějící input, 405 na GET, formát JSON odpovědi a přítomnost `request_id`.

---

## Návrh PR — přehled souborů

Tento přehled byl realizován v PR větvi `copilot/create-repo-intelligence-report`. Obsahuje:

| Soubor | Typ změny | Obsah |
|---|---|---|
| `README.md` | Přepsán | Overview, Quickstart, Mermaid architektura, API reference, Konfigurace, Deploy |
| `.env.example` | Nový | Šablona s `OPENAI_API_KEY` a `CLOUDFLARE_API_TOKEN` s komentáři |
| `.github/workflows/deploy.yml` | Opraven | Přidány chybějící kroky `setup-node@v4` + `wrangler-action@v3` (původně jen `checkout`) |
| `docs/audit.md` | Nový | Detailní Repo Intelligence Report s grep auditními příkazemi a evidence indexem |
| `docs/overview.md` | Nový | Tento soubor — stručný A–H přehled pro nové přispěvatele |
