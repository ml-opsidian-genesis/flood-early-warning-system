# 🌊 Pravaha — Autonomous Flood-risk Early-Warning System

Pravaha turns the ML Opsidian flood-risk model into a real product. Every
morning a scheduled pipeline scores a fixed set of Sri Lankan locations, stores
the results, paints them on a public risk map, and sends **WhatsApp alerts** to
subscribers whenever a place they follow crosses the high-risk threshold.

```
                    ┌──────────────────────────────────────────────┐
   Vercel Cron ───▶ │  Next.js  /api/cron/score                     │
   (daily 06:30)    │    1. read locations (Postgres)               │
                    │    2. POST /predict/batch ──▶ FastAPI + ONNX   │
                    │    3. store daily RiskScores                   │
                    │    4. alert subscribers ───▶ Twilio WhatsApp   │
                    └──────────────────────────────────────────────┘
        ▲                              │
   Leaflet map  ◀── /api/locations ────┘     Ops dashboard ◀── /api/stats
   + OTP subscribe (Twilio Verify)
```

## Architecture

| Component | Tech | Responsibility |
|-----------|------|----------------|
| **ML service** | FastAPI + ONNX (`../ml-model`) | Stateless scoring. `POST /predict/batch` scores all locations using deterministic **mock daily features**. |
| **Web app** | Next.js 14 (App Router) | Owns the database, risk map, OTP subscription, cron pipeline, ops dashboard. |
| **Database** | Postgres (Supabase/Neon) via Prisma | Locations, daily scores, subscribers, subscriptions, alert log, run log. |
| **Messaging** | Twilio Verify (OTP) + WhatsApp (alerts) | Phone verification and outbound flood alerts. |
| **Scheduler** | Vercel Cron | Triggers `/api/cron/score` every morning. |

> **Mock features:** for this demo the pipeline does not pull a live weather
> feed. The ML service synthesises plausible feature values per location that are
> deterministic per (location, date) but vary day to day (a random weather
> regime), so scores move and alerts fire realistically. Swapping in a real
> Open-Meteo feed is a one-function change in `ml-model/src/mock_features.py`.

## Prerequisites

- Node.js 18+
- The ML service running (see `../ml-model`)
- A Postgres database (free Supabase or Neon project)
- A Twilio account with a **Verify** service and the **WhatsApp sandbox** joined

## 1. Start the ML scoring service

```bash
cd ../ml-model
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m src.train_serving                        # builds the serving-consistent model
uvicorn app.main:app --port 8000
```

Verify: `http://127.0.0.1:8000/docs` → try `POST /predict/batch`.

## 2. Configure the web app

```bash
cd pravaha
cp .env.example .env        # then fill in the values
npm install
```

Fill `.env`:
- `DATABASE_URL` / `DIRECT_URL` — from Supabase (Settings → Database).
- `ML_SERVICE_URL` — `http://127.0.0.1:8000` locally.
- `TWILIO_*` — Account SID, Auth Token, Verify Service SID, WhatsApp sender.
- `ALERT_THRESHOLD` — default `0.55` (≈ High and above).
- `CRON_SECRET` — any long random string.

## 3. Database + seed

```bash
npm run db:push     # create tables
npm run db:seed     # load the 30 Sri Lankan locations
```

## 4. Run

```bash
npm run dev         # http://localhost:3000
```

- **/** — risk map + OTP subscription.
- **/dashboard** — monitoring + **Run morning pipeline now** button (generates today's scores and fires alerts).

Run the pipeline once so the map has data (dashboard button, or):

```bash
curl -X POST http://localhost:3000/api/cron/score -H "x-cron-secret: <CRON_SECRET>"
```

## Twilio notes (demo)

- **Trial accounts** can only message **verified** numbers — add the demo phone in the Twilio console.
- For WhatsApp, join the **sandbox**: send the join code to `+1 415 523 8886` from the demo phone.
- OTP is delivered over **SMS** via Verify; flood alerts go over **WhatsApp**.
- Without Twilio env vars the app runs in **simulation mode** (OTP `123456`, alerts logged to the dashboard) so it still demos.

## Deployment

**ML service** → Render/Railway from `../ml-model/Dockerfile`, then set
`ML_SERVICE_URL` to its public URL.

**Web app** → Vercel:
1. Import the repo, root directory `pravaha`.
2. Add all `.env` variables in Vercel project settings.
3. `vercel.json` registers the daily cron (`0 1 * * *` UTC ≈ 06:30 Sri Lanka).
4. Set `CRON_SECRET` so Vercel signs cron requests automatically.

## API reference

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/locations` | GET | Locations + latest score (map data) |
| `/api/subscribe` | POST | `{phone, locationIds}` → send OTP |
| `/api/verify` | POST | `{phone, code, locationIds}` → create subscription |
| `/api/cron/score` | GET/POST | Run the scoring + alert pipeline (secret-protected) |
| `/api/stats` | GET | Monitoring snapshot |

## Data model

`Location → RiskScore` (daily), `Subscriber → Subscription → Location`,
`Alert` (delivery log), `ScoringRun` (pipeline observability).
