# Voice-Driven Commerce Operations Engine

COD voice operations: **confirm** → **schedule delivery** → **auto-update** dashboard and call logs.

A full-stack COD order workflow with voice confirmation and delivery scheduling. The app allows a user to create a COD order, sends a Phase 1 verification call via Bolna, and once confirmed, schedules a Phase 2 delivery slot call. The frontend dashboard updates status and call logs as the workflow progresses.

## What it does

| Phase | Voice goal | Outcomes |
|-------|-------------|----------|
| 1 | COD confirmation | Confirmed / Cancelled / Retry Pending |
| 2 | Delivery slot | Slot Confirmed / Rescheduled / Retry Pending |
| 3 | Ops visibility | Dashboard + call logs + `nextActionAt` scheduling |

## System design

### Complete Integration Flow

```mermaid
flowchart TD
    FE["<b>React Frontend</b><br/>Create Order / Dashboard / Logs"]
    API["<b>Backend API</b><br/>Workflow Engine<br/>+ Scheduler<br/>+ State Manager"]
    DB1[("MongoDB Atlas<br/>(Production)")]
    DB2[("JSON Store<br/>(Local/Demo)")]
    BOLNA["<b>Bolna Voice AI</b><br/>Agent Phone Call"]
    PHONE["📞 Customer<br/>Phone"]
    WEBHOOK["Webhook Listener<br/>/api/webhook/bolna"]
    
    FE -->|"POST /api/orders"| API
    API -->|"Order Created"| BOLNA
    BOLNA -->|"Phone Call"| PHONE
    PHONE -->|"Speech"| BOLNA
    BOLNA -->|"POST webhook"| WEBHOOK
    WEBHOOK -->|"Update Order"| API
    API -->|"Status Change"| FE
    API -->|"Polling"| FE
    
    API -->|"STORAGE_MODE=mongo"| DB1
    API -->|"STORAGE_MODE=json"| DB2
    
    style FE fill:#4f46e5,color:#fff
    style API fill:#10b981,color:#fff
    style BOLNA fill:#f59e0b,color:#fff
    style WEBHOOK fill:#8b5cf6,color:#fff
    style PHONE fill:#ef4444,color:#fff
```

### Workflow architecture

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> CallingConfirmation: Order Created<br/>Phase 1 Triggered
    
    CallingConfirmation --> Confirmed: ✅ User says YES<br/>to confirmation
    CallingConfirmation --> Cancelled: ❌ User says NO<br/>cancels order
    CallingConfirmation --> RetryPending: ⏱️ No response<br/>or unclear
    
    Confirmed --> CallingDelivery: Phase 2 Scheduled<br/>nextActionAt reached
    
    CallingDelivery --> SlotConfirmed: ✅ Keep slot
    CallingDelivery --> Rescheduled: 🔄 User reschedules<br/>new delivery date
    CallingDelivery --> RetryPending: ⏱️ No response
    
    RetryPending --> CallingConfirmation: Retry Phase 1<br/>retryCount++
    RetryPending --> CallingDelivery: Retry Phase 2<br/>retryCount++
    RetryPending --> Completed: maxRetries reached
    
    Confirmed --> Completed: Delivery scheduled
    Cancelled --> Completed: Order cancelled
    Rescheduled --> Completed: Slot updated
    
    Completed --> [*]
    
    style CallingConfirmation fill:#fbbf24,stroke:#f59e0b,stroke-width:2px
    style CallingDelivery fill:#fbbf24,stroke:#f59e0b,stroke-width:2px
    style Confirmed fill:#86efac,stroke:#22c55e,stroke-width:2px
    style Rescheduled fill:#86efac,stroke:#22c55e,stroke-width:2px
    style SlotConfirmed fill:#86efac,stroke:#22c55e,stroke-width:2px
    style Cancelled fill:#fca5a5,stroke:#ef4444,stroke-width:2px
    style RetryPending fill:#e0e7ff,stroke:#6366f1,stroke-width:2px
```

### Webhook data flow

```mermaid
flowchart LR
    A["📞 Bolna Call<br/>Completes"] 
    B["Webhook POST:<br/>context_details.recipient_data<br/>+ transcript<br/>+ response"]
    C["Parse:<br/>orderId<br/>phase<br/>intent"]
    D["Update Order<br/>Status"]
    E["Frontend<br/>Reflects<br/>Change"]
    
    A --> B
    B --> C
    C --> D
    D --> E
    
    style A fill:#f59e0b,color:#fff
    style B fill:#8b5cf6,color:#fff
    style C fill:#3b82f6,color:#fff
    style D fill:#10b981,color:#fff
    style E fill:#4f46e5,color:#fff
```

Statuses in the API use strings such as `Calling - Confirmation` and `Calling - Delivery Slot`; `workflowPhase` (1 or 2) decides which retry call is placed.

## Key features

- Order creation form with customer details, product, amount, address, and language selection
- Phone input requires `+91XXXXXXXXXX`
- Phase 1: voice confirmation call for COD order
- Phase 2: voice delivery slot confirmation/reschedule call after Phase 1 success
- Retry handling for missed/unclear calls
- Dashboard showing active operations and recent call activity
- Call log history and simulation endpoints for testing
- Supports local JSON storage or MongoDB production storage

## Project structure

- `client/` — React frontend built with Vite
- `server/` — Express backend, workflow engine, Bolna webhook handler, scheduler
- `package.json` — root scripts to run both client and server together

## Stack

- Frontend: React, Vite, React Router, Axios, Polling
- Backend: Node.js, Express, Mongoose(Optional)
- Storage: local JSON file or MongoDB
- Voice integration: Bolna voice API + webhook handling


## Installation

From the repository root:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

## Run locally

Start both server and client together:

```bash
npm run dev
```

Or run each separately:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

Then open:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

## Build and start

Build the client:

```bash
npm run build --prefix client
```

Start the backend:

```bash
npm start --prefix server
```

## API endpoints

- `POST /api/orders` — create a new order and start Phase 1 workflow
- `GET /api/orders` — list all orders
- `PATCH /api/orders/:id` — update an order
- `DELETE /api/orders/:id` — delete an order
- `POST /api/orders/:id/simulate` — simulate call outcomes for demo/testing
- `POST /api/webhook/bolna` — receive Bolna webhook events
- `GET /api/calls` — list flattened call logs

## Bolna webhook behavior

Aligned with Voice-Driven-Commerce-Operations-Engine:

- Raw JSON body on POST /api/webhook/bolna so BOLNA_WEBHOOK_SECRET HMAC can use the exact request bytes (not JSON.stringify after parsing).
- Immediate 200 { ok, received } response, then async processing (Bolna-friendly timeouts/retries).
- Parses context_details.recipient_data (and fallbacks) for orderId / phase / callId.
- extractIntent() from transcript text (English + common Hindi tokens) when intent is missing.
- transcript.summary (object-shaped transcript) is merged into text and used as a fallback response when Bolna sends a summary only.
- Ignores events with no transcript (pings / partial payloads) so they do not mutate workflow state.
- Duplicate completed webhooks for the same phase are ignored (no double state transitions).

Outbound calls include recipient_data / user_data / extra_data so Bolna can echo identifiers back into webhooks. Phase 2 also sends delivery_slot / deliverySlot for dashboard agent templates (e.g. {{delivery_slot}}).

Scheduling: RETRY_DELAY_MINUTES controls retry spacing; PHASE2_DELAY_MINUTES (default 2) controls how long after confirmation the delivery call is scheduled in production (simulation still uses 30s). JSON file mode applies the same Confirmed / Retry Pending filter as Mongo when selecting due orders (fixes a common demo bug).

## Production (Render + MongoDB Atlas)

- Atlas: cluster + user + allow 0.0.0.0/0 (or Render IPs) → MONGODB_URI
- Render (backend): root server, build npm install, start npm start
- Set STORAGE_MODE=mongo, MONGODB_URI, APP_BASE_URL (Render URL), FRONTEND_URL (Render URL), Bolna vars from dashboard.
- Render (frontend): root client, VITE_API_URL=https://<render-host>/api
- Bolna: webhook = https://<render-host>/api/webhook/bolna

## Notes

- Phone input requires full `+91XXXXXXXXXX`; plain 10-digit numbers are rejected.
- The dashboard reflects active operations and call outcomes in real time through polling.
- Local JSON storage is suitable for demos but not production; use MongoDB for stable storage.
