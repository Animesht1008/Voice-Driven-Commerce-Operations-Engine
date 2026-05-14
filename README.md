# Voice-Driven Commerce Operations Engine

COD voice operations: **confirm** → **schedule delivery** → **auto-update** dashboard and call logs.


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

## Stack

- **Frontend:** React (Vite), React Router, Axios, polling
- **Backend:** Node.js, Express, Mongoose (optional), Bolna REST + webhook
- **Storage:** `STORAGE_MODE=json` (local) or `STORAGE_MODE=mongo` (production)

## Quick start (local)

```bash
npm install
npm install --prefix server
npm install --prefix client
```

Copy `server/.env.example` → `server/.env` and set **`SIMULATION_MODE=true`** if you do not have Bolna keys yet.  
Copy `client/.env.example` → `client/.env` for production API URL, or use default localhost in `client/.env` (see repo’s local template).

```bash
npm run dev
```

- UI: `http://localhost:5173`  
- API: `http://localhost:5000`

## API

- `POST /api/orders` — create order + start workflow  
- `GET /api/orders`  
- `PATCH /api/orders/:id`  
- `POST /api/orders/:id/simulate` — demo success/failure paths  
- `POST /api/webhook/bolna` — Bolna outcomes (`metadata.orderId`, `metadata.phase`, …)  
- `GET /api/calls` — flattened logs  

## Bolna webhook (production-hardened)

Aligned with **Voice-Driven-Commerce-Operations-Engine1**:

- **Raw JSON body** on `POST /api/webhook/bolna` so `BOLNA_WEBHOOK_SECRET` HMAC can use the **exact request bytes** (not `JSON.stringify` after parsing).
- **Immediate `200 { ok, received }`** response, then **async** processing (Bolna-friendly timeouts/retries).
- Parses **`context_details.recipient_data`** (and fallbacks) for `orderId` / `phase` / `callId`.
- **`extractIntent()`** from transcript text (English + common Hindi tokens) when `intent` is missing.
- **`transcript.summary`** (object-shaped `transcript`) is merged into text and used as a fallback **response** when Bolna sends a summary only.
- **Ignores** events with **no transcript** (pings / partial payloads) so they do not mutate workflow state.
- **Duplicate** completed webhooks for the same phase are ignored (no double state transitions).

Outbound calls include **`recipient_data` / `user_data` / `extra_data`** so Bolna can echo identifiers back into webhooks. Phase 2 also sends **`delivery_slot`** / **`deliverySlot`** for dashboard agent templates (e.g. `{{delivery_slot}}`).

**Scheduling:** `RETRY_DELAY_MINUTES` controls retry spacing; **`PHASE2_DELAY_MINUTES`** (default 2) controls how long after confirmation the delivery call is scheduled in production (simulation still uses 30s). JSON file mode applies the same **`Confirmed` / `Retry Pending`** filter as Mongo when selecting due orders (fixes a common demo bug).

## Production (Render + MongoDB Atlas)

1. **Atlas:** cluster + user + allow `0.0.0.0/0` (or Render IPs) → `MONGODB_URI`  
2. **Render (backend):** root `server`, build `npm install`, start `npm start`  
   Set `STORAGE_MODE=mongo`, `MONGODB_URI`, `APP_BASE_URL` (Render URL), `FRONTEND_URL` (Vercel URL), Bolna vars from dashboard.  
3. **Vercel (frontend):** root `client`, `VITE_API_URL=https://<render-host>/api`  
4. **Bolna:** webhook = `https://<render-host>/api/webhook/bolna`  

## Engineering note

In-memory polling scheduler is fine for demos. For production scale, move delayed work to **BullMQ** or **Temporal**.
