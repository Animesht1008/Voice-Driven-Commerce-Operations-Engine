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

- Frontend: React, Vite, React Router, Axios
- Backend: Node.js, Express, dotenv, optional Mongoose
- Storage: local JSON file or MongoDB
- Voice integration: Bolna voice API + webhook handling

## Environment setup

### `server/.env`

Required values:

- `PORT=5000`
- `FRONTEND_URL=http://localhost:5173`
- `APP_BASE_URL=http://localhost:5000`
- `STORAGE_MODE=json` or `mongo`
- `MONGODB_URI=` (when using `mongo`)
- `WORKFLOW_TICK_MS=10000`
- `RETRY_DELAY_MINUTES=1`
- `MAX_RETRIES=2`
- `SIMULATION_MODE=true`
- `BOLNA_API_KEY=`
- `BOLNA_API_BASE_URL=https://api.bolna.ai`
- `BOLNA_AGENT_ID_PHASE1=`
- `BOLNA_AGENT_ID_PHASE2=`
- `BOLNA_WEBHOOK_PATH=/api/webhook/bolna`
- `BOLNA_WEBHOOK_SECRET=`
- `NODE_ENV=development`

### `client/.env`

For the frontend to call the backend:

- `VITE_APP_BASE_URL=http://localhost:5000/api`

> The frontend validation requires the phone number to be entered in the full international format: `+91XXXXXXXXXX`.

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

## Workflow behavior

- New orders start as `Pending` and are immediately scheduled for a Phase 1 call.
- When Phase 1 succeeds, the order moves to `Confirmed` and Phase 2 is scheduled.
- If Phase 1 or Phase 2 receives no valid confirmation, the order can move to `Retry Pending` and retry later.
- Phase 2 handles delivery slot confirmation or rescheduling.

## Bolna webhook behavior

- Incoming webhook payloads are parsed from `context_details.recipient_data` and fallback fields.
- The webhook extracts `orderId`, `phase`, and `callId` to update the correct order workflow.
- It ignores lifecycle-only events like `initiated`, `ringing`, or `in-progress`.
- It infers user intent from transcript text when explicit intent fields are missing.
- Duplicate completed webhooks for the same phase are ignored.

## Production notes

- Use `STORAGE_MODE=mongo` and set `MONGODB_URI` for a persistent database in production.
- Set correct `APP_BASE_URL`, `FRONTEND_URL`, and Bolna webhook URL in your deployment.
- For Render/Vercel, frontend should point to backend API at `VITE_APP_BASE_URL=https://<backend-host>/api`.
- Keep `BOLNA_WEBHOOK_SECRET` configured if Bolna supports signing webhooks.

## Notes

- Phone input requires full `+91XXXXXXXXXX`; plain 10-digit numbers are rejected.
- The dashboard reflects active operations and call outcomes in real time through polling.
- Local JSON storage is suitable for demos but not production; use MongoDB for stable storage.
