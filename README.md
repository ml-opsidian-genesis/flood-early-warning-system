# 🌊 Pravaha — Autonomous Flood-risk Early-Warning System

Pravaha turns the ML Opsidian flood-risk model into a real product. Every
morning a scheduled pipeline scores a fixed set of Sri Lankan locations using
**real weather and terrain data**, stores the results, paints them on a public
risk map, and sends **WhatsApp alerts** to subscribers whenever a place they
follow crosses the high-risk threshold. User-submitted feedback flows back
into an optional retraining loop, and both services are monitored end to end
(error tracking, prediction logging, usage/performance analytics).

```
                    ┌──────────────────────────────────────────────────┐
   Vercel Cron ───▶ │  Next.js  /api/cron/score                         │
   (daily 01:00 UTC)│    1. read locations (Postgres)                   │
                    │    2. fetch real rainfall/elevation/river/hospital │
                    │       data, fall back to mock per-field if needed  │
                    │    3. POST /predict/batch ──▶ FastAPI + ONNX (HF)  │
                    │    4. store daily RiskScores                      │
                    │    5. alert subscribers ───▶ Twilio WhatsApp      │
                    └──────────────────────────────────────────────────┘
        ▲                              │
   Leaflet map  ◀── /api/locations ────┘     Admin portal ◀── /api/stats,
   + WhatsApp OTP subscribe/manage             /api/admin/*, /api/predictions
   + map feedback (flooded? accurate?)
                                  │
                                  ▼
                    python -m src.import_feedback (opt-in via USE_FEEDBACK)
                    → data/feedback.csv → next retrain → evaluate_gate.py
                      (only ships if it beats the currently-deployed model)
```

## Try It Live.

**🔗 [flood-early-warning-system.vercel.app](https://flood-early-warning-system.vercel.app/)**
Admin Credentials : 
- email : admin@gmail.com  
- password : admin123

1. Open the deployed app above and look at the risk map — scores update daily
   from live weather data (see [Real data sources](#real-data-sources) below).
2. To actually **receive a WhatsApp alert**, you first need to join our
   Twilio WhatsApp **sandbox** (a one-time step per phone number, required by
   Twilio on a trial account — see below).
3. Subscribe to a location on the map (verify your number via WhatsApp OTP,
   pick a location, save). If it's High/Critical risk, you'll get an alert on
   the next pipeline run.
4. Click a marker → **Give feedback** to report whether it actually flooded —
   this feeds the retraining loop.

### Join the Twilio WhatsApp sandbox

Twilio's trial WhatsApp sandbox only delivers messages to numbers that have
explicitly joined it. **Do this once, from the phone you'll use to test:**

**Option A — scan the QR code:**

![Scan to join the Twilio WhatsApp sandbox](https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=https%3A%2F%2Fwa.me%2F14155238886%3Ftext%3Djoin%2520repeat-been)

**Option B — send it manually:**
1. Open WhatsApp on your phone.
2. Send a message to **+1 415 523 8886**.
3. Message text: `join repeat-been`

Twilio replies confirming you've joined — after that, OTPs and flood alerts
sent to that number will actually arrive. This only needs to be done once per
phone number (sandbox sessions do expire after a period of inactivity per
Twilio's policy — if alerts stop arriving after a while, rejoin with the same
code).

> The join code (`repeat-been`) is tied to our specific Twilio sandbox and
> will only work for this project's WhatsApp number. If you fork this project
> with your own Twilio account, your sandbox will have a different code —
> check your Twilio console under **Messaging → Try it out → WhatsApp**.

## Architecture

| Component | Tech | Responsibility |
|-----------|------|----------------|
| **ML service** | FastAPI + ONNX (`../ml-model`), deployed on Hugging Face Spaces | Stateless scoring. `POST /predict/batch` scores a list of fully-formed feature payloads; `POST /predict` scores one. Logs every prediction to Postgres (`PredictionLog`) and to Sentry on error. |
| **Web app** | Next.js 14 (App Router), deployed on Vercel | Owns the database, risk map, OTP subscribe/manage, feedback collection, cron pipeline, admin portal. Generates the daily feature payloads (real data + mock fallback) — the model never simulates its own inputs. |
| **Database** | Postgres (Neon) via Prisma | Locations, daily scores, subscribers, subscriptions, alerts, feedback, prediction log, scoring runs, admin accounts, settings. |
| **Messaging** | Twilio WhatsApp (alerts + custom OTP) | Phone verification and outbound flood alerts, both over WhatsApp (no SMS, no Twilio Verify — OTP is generated and matched ourselves, stored with a 10-minute TTL). |
| **Scheduler** | Vercel Cron | Triggers `/api/cron/score` daily at `01:00 UTC`. |
| **Monitoring** | Sentry (both services), Vercel Analytics + Speed Insights | Error tracking, real-user performance/usage data. |
| **CI/CD** | GitHub Actions (`ml-model/.github/workflows/mlops.yml`) | Train → evaluate-gate → upload to HF model repo → redeploy Space, triggered by a `VERSION` bump on push to `main`. |

## Real data sources

The pipeline used to fully simulate every feature. It now uses **real data
where a free, no-key API exists**, and falls back to deterministic mock
values per-field wherever it doesn't (a partial fetch failure never blocks
scoring):

| Field | Source |
|-------|--------|
| `rainfall_7d_mm`, `monthly_rainfall_mm` | [Open-Meteo](https://open-meteo.com) (free, no key) |
| `elevation_m` | [Open-Elevation](https://open-elevation.com) (free, no key) |
| `distance_to_river_m` | OpenStreetMap via the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) (nearest tagged river) |
| `nearest_hospital_km` | OpenStreetMap via Overpass (nearest tagged hospital) |
| Everything else (soil, landcover, road quality, demographics, etc.) | Deterministic mock, seeded per (location, date) — no reliable free live source exists for these at this granularity (see `src/lib/mockFeatures.ts` for the full reasoning) |

All of this lives in `src/lib/weather.ts`, `src/lib/geo.ts`, and
`src/lib/mockFeatures.ts` on the Next.js side — the ML service itself never
calls an external API; it only ever scores whatever feature payload it's
given.

## Prerequisites

- Node.js 18+, Python 3.10+
- A Postgres database (free [Neon](https://neon.tech) project)
- A Twilio account with the **WhatsApp sandbox** joined (see above)
- (Optional) A free [Sentry](https://sentry.io) account, one project per service, for error monitoring

## 1. Start the ML scoring service

```bash
cd ../ml-model
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Verify: `http://127.0.0.1:8000/docs` → try `POST /predict/batch`.

## 2. Configure the web app

```bash
cd pravaha
cp .env.example .env        # then fill in the values
npm install
```

Create `.env` with:

| Variable | Notes |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon — pooled and direct connection strings |
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` locally, or your deployed HF Space URL |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | From the Twilio console |
| `ALERT_THRESHOLD` | Default `0.50` |
| `CRON_SECRET` | Any long random string — protects `/api/cron/score` |
| `AUTH_SECRET` | Any long random string — signs admin sessions + manage tokens |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Optional — same DSN value, two names (server + browser) |

Without Twilio env vars the app runs in **simulation mode** (OTP is always
`123456`, alerts are logged instead of sent) — it still fully demos without a
Twilio account.

## 3. Database + seed

```bash
npm run db:push     # create tables
npm run db:seed     # load the monitored Sri Lankan locations
npm run admin:create # create your first admin login
```

## 4. Run

```bash
npm run dev         # http://localhost:3000
```

- **/** — risk map (markers / heatmap / district choropleth) + WhatsApp subscribe & manage.
- **/login** — admin login.
- **/dashboard** — pipeline status + **Run morning pipeline now** button.
- **/locations** — manage monitored locations, view current scores.
- **/subscribers** — manage who's subscribed to what.
- **/alerts** — delivery log for every WhatsApp alert attempted.
- **/generations** — two tabs: **Generations** (daily pipeline runs, scores, feedback, training-data export) and **Predictions** (raw log of every model call, including ad-hoc ones).
- **/settings** — risk thresholds, your profile, and (superadmin only) admin account management.

Run the pipeline once so the map has data (dashboard button, or):

```bash
curl -X POST "http://localhost:3000/api/cron/score?secret=<CRON_SECRET>"
```

## Feedback → retraining loop

Anyone can click a map marker and report whether a location actually
flooded, and how accurate the prediction felt. That's stored in `Feedback`,
joined back to the exact feature snapshot the model scored
(`RiskScore.features`), and can be turned into labeled training rows:

```bash
cd ../ml-model
python -m src.import_feedback   # writes data/feedback.csv from current DB feedback
python -m src.train             # trains on train.csv only by default
USE_FEEDBACK=1 python -m src.train   # explicit opt-in: also trains on feedback.csv
python -m src.evaluate_gate     # only passes if the new model beats production
```

Feedback is **opt-in by design** — a feedback-informed retrain is a
deliberate choice (`USE_FEEDBACK=1`, or the `use_feedback` toggle on a manual
GitHub Actions run), not a silent default, since unvalidated user feedback
can bias a model if trusted blindly.

## Deployment

**ML service** → Hugging Face Spaces (Docker SDK). Push to `main` with a
`VERSION` bump to trigger `ml-model/.github/workflows/mlops.yml`:
train → evaluate-gate → upload to the HF model repo → redeploy the Space.
A push *without* a `VERSION` bump still redeploys the Space with the latest
code (no retrain) via the same workflow's `test-and-deploy` job.

Required GitHub Actions secrets: `HF_TOKEN`, `DATABASE_URL` (for the feedback
import step).

Required Hugging Face Space secrets: `DATABASE_URL` (prediction logging),
`SENTRY_DSN` (optional, error monitoring).

**Web app** → Vercel:
1. Import the repo.
2. Add all `.env` variables under Project Settings → Environment Variables.
3. `vercel.json` registers the daily cron (`0 1 * * *` UTC).
4. Vercel Analytics + Speed Insights activate automatically once deployed — no extra config.

## Monitoring

- **Sentry** — wired into both services (`src/instrumentation.ts` /
  `instrumentation-client.ts` on the web app, `sentry_sdk.init()` in
  `ml-model/app/main.py`). No-ops safely if `SENTRY_DSN` isn't set.
- **Prediction logging** — every `/predict` and `/predict/batch` call writes
  to `PredictionLog` in Postgres (not the model service's local disk, which
  is ephemeral on HF Spaces). Viewable in the admin portal's **Predictions**
  tab, or via the model's own `/metrics` endpoint.
- **Vercel Analytics / Speed Insights** — page views, traffic, and real-user
  Core Web Vitals, visible in the Vercel project dashboard.

## API reference

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/locations` | GET | Locations + latest score (public map data) |
| `/api/districts` | GET | District-level aggregates for the choropleth view |
| `/api/feedback` | POST | Public — submit ground-truth feedback on a prediction |
| `/api/manage/request` | POST | `{phone}` → send WhatsApp OTP |
| `/api/manage/verify` | POST | `{phone, code}` → returns a 15-min manage token + existing subscriptions |
| `/api/manage/update` | POST | `{token, locationIds}` → replace subscriptions, send confirmation |
| `/api/cron/score` | GET/POST | Run the scoring + alert pipeline (secret-protected) |
| `/api/stats` | GET | Admin dashboard snapshot |
| `/api/admin/locations` | GET/POST/DELETE | Manage monitored locations |
| `/api/admin/subscribers` | GET/PUT/DELETE | Admin view/edit/remove subscribers |
| `/api/admin/alerts` | GET | Alert delivery log |
| `/api/admin/predictions` | GET | Raw prediction log (joins `PredictionLog` with location names) |
| `/api/admin/generations` | GET | List of pipeline generations |
| `/api/admin/generations/[date]` | GET | Scores + feedback for one generation, training-data export |
| `/api/admin/settings` | GET/PUT | Risk/alert thresholds |
| `/api/admin/profile`, `/api/admin/profile/password` | PUT | Admin's own email/password |
| `/api/admin/admins` | GET/POST/DELETE | Superadmin-only: manage admin accounts |

## Data model

`Location → RiskScore` (daily, with `features` JSON snapshot) `→ Feedback`
(ground truth, joined by location + scoredFor) · `Subscriber → Subscription
→ Location` · `OtpCode` (10-min TTL WhatsApp OTP) · `Alert` (delivery log) ·
`ScoringRun` (pipeline observability) · `PredictionLog` (every model call,
written directly by the ML service) · `Admin` + `Settings` (admin portal,
role-based: `admin` / `superadmin`).
