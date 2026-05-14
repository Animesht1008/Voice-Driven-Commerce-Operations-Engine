# Voice-Driven Commerce Operations Engine

Voice-first operations system for COD ecommerce workflows.

## What It Automates

- **Phase 1:** COD confirmation call (`Confirmed` / `Cancelled` / `Retry Pending`)
- **Phase 2:** Delivery slot call (`Keep` / `Rescheduled` / `Retry Pending`)
- **Phase 3:** Auto dashboard + call log + workflow state transitions

## System Architecture

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

### Workflow State Machine

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

### Webhook Data Flow

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

## Core Features

- Event-driven workflow logic (`Order Created`, `Call Completed`, `Retry Due`)
- Retry engine with:
  - `retryCount` / `maxRetries`
  - `nextActionAt` scheduling
  - Exponential backoff support
- Real Bolna API integration with:
  - Metadata passing (`recipient_data`)
  - Transcript capture (string/array handling)
  - Intent extraction from speech
- Transcript storage and "View Conversation" in call logs
- Dashboard sections:
  - Overview cards (total, pending, confirmed, etc.)
  - Active operations table with live status
  - Recent call activity with transcripts
- Visual polish:
  - Status pulse animation for calling states
  - Toast notifications on state changes
  - Real-time polling
- Multi-language support:
  - English prompts
  - Hindi prompts
  - Dynamic template variable substitution

### Latest Changes (v1.0.5 - Workflow & Variable Fixes)

✅ **Variable Interpolation Fixed** - Changed prompts to use `{{name}}`, `{{product}}`, `{{amount}}` for Bolna dashboard compatibility  
✅ **Webhook Guards Added** - Only process webhooks with transcripts to prevent premature status updates  
✅ **Duplicate Webhook Prevention** - Skip processing if phase already has completed call log  
✅ **Improved Response Extraction** - Phase-aware intent detection from full transcript text  
✅ **Mongoose Warnings Fixed** - Replaced deprecated `new: true` with `returnDocument: "after"`  

See [DETAILED_README.md](DETAILED_README.md#latest-changes-v105---workflow--variable-fixes) for full details.

## Data Schema (Order)

```js
{
  customer: { name, phone },
  product: { name, amount },
  address,
  language,             // en | hi
  status,               // Pending, Calling-Confirmation, Confirmed, etc.
  deliverySlot,         // "Tomorrow 2-5 PM" or null
  retryCount,           // current retry attempt
  maxRetries,           // max retry attempts (default 2)
  nextActionAt,         // ISO timestamp for scheduler
  callLogs: [
    { 
      phase,            // 1 or 2
      callId,           // Bolna call_id
      status,           // initiated, completed, failed
      response,         // confirmed | cancelled | rescheduled | kept
      durationSec,      // call duration
      timestamp,        // when call was made
      newSlot,          // new delivery slot if rescheduled
      transcript: [
        { text: "agent: Hello..." },
        { text: "user: yes confirm" }
      ]
    }
  ],
  createdAt,
  updatedAt
}
```

## Quick Start (Local)

```bash
npm install
npm install --prefix server
npm install --prefix client
```

Copy envs:

- `server/.env.example` -> `server/.env`
- `client/.env.example` -> `client/.env`

Run:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## API

- `POST /api/orders` - Create order + emit `Order Created Event`
- `GET /api/orders` - List orders
- `PATCH /api/orders/:id` - Manual patch
- `POST /api/orders/:id/simulate` - Simulate failure/success scenarios
- `POST /api/webhook/bolna` - Bolna webhook event intake
- `GET /api/calls` - Flattened call logs

## Real Bolna Integration

Configure backend env:

- `BOLNA_API_KEY` - API authentication key
- `BOLNA_API_BASE_URL` - API base URL (default: https://api.bolna.ai)
- `BOLNA_AGENT_ID_PHASE1` - Agent ID for order confirmation
- `BOLNA_AGENT_ID_PHASE2` - Agent ID for delivery slot
- `BOLNA_WEBHOOK_SECRET` - Webhook signature secret
- `APP_BASE_URL` - Public backend URL for webhook callbacks

Webhook format (Bolna sends):

```json
{
  "context_details": {
    "recipient_data": {
      "orderId": "...",
      "phase": 1,
      "callId": "call_...",
      "customer_name": "Animesh",
      "product_name": "Laptop",
      "amount": 120000
    }
  },
  "transcript": "agent: Hello...\nuser: confirm\nagent: Thank you",
  "telephony_data": {
    "duration": 45
  }
}
```

## Production Deployment (Render + MongoDB Atlas)

### Step 1: Set up MongoDB Atlas

1. Create Atlas cluster (free tier OK)
2. Get connection URI: `mongodb+srv://user:pass@cluster.mongodb.net/?appName=Cluster0`

### Step 2: Deploy Backend on Render

1. Create new Web Service on Render
2. Connect GitHub repo
3. Set root directory: `server`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables:

```
STORAGE_MODE=mongo
MONGODB_URI=<your-atlas-uri>
APP_BASE_URL=https://<render-service-name>.onrender.com
FRONTEND_URL=https://<vercel-frontend-url>.vercel.app
BOLNA_API_KEY=<your-bolna-key>
BOLNA_AGENT_ID_PHASE1=<agent-id>
BOLNA_AGENT_ID_PHASE2=<agent-id>
BOLNA_WEBHOOK_SECRET=<webhook-secret>
```

### Step 3: Deploy Frontend on Vercel

1. Fork repo on GitHub
2. Create new project on Vercel
3. Set root directory: `client`
4. Add environment variable:

```
VITE_API_URL=https://<render-service-name>.onrender.com/api
```

### Step 4: Configure Bolna Webhook

In Bolna agent settings, set webhook URL to:

```
https://<render-service-name>.onrender.com/api/webhook/bolna
```

## Engineering Notes

### Storage Adapter Pattern

The system uses an adapter pattern for storage, allowing seamless switching:

```javascript
// Local/Demo mode
STORAGE_MODE=json  // In-memory JSON file storage

// Production mode
STORAGE_MODE=mongo // MongoDB Atlas persistence
```

Both modes implement the same interface, so business logic remains unchanged.

### Webhook Security

- Raw body middleware is registered before JSON parsing for signature verification
- Supports both HMAC-verified and demo modes
- Optional re-enablement in production with proper secret configuration

### Environment Variable Handling

**Development**: Reads from `.env` file using dotenv
**Production (Render)**: Reads directly from `process.env` (injected by platform)

This ensures:
- No exposed secrets in production deployments
- Seamless local development workflow
- Support for dynamic configuration

### Prompt Templating

Prompts support variable substitution:

```javascript
fillTemplate(
  "Hello {{name}}, your {{product}} order for ₹{{amount}} is confirmed.",
  { name: "Animesh", product: "Laptop", amount: 120000 }
)
// → "Hello Animesh, your Laptop order for ₹120000 is confirmed."
```

Variables are passed through the entire call chain: workflow → service → Bolna.

### For Demo Simplicity

Delayed scheduling uses in-memory `nextActionAt` timestamps.  
In production, migrate to persistent queue systems like BullMQ or Temporal for reliability.


npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## API

- `POST /api/orders` - Create order + emit `Order Created Event`
- `GET /api/orders` - List orders
- `PATCH /api/orders/:id` - Manual patch
- `POST /api/orders/:id/simulate` - Simulate failure/success scenarios
- `POST /api/webhook/bolna` - Bolna webhook event intake
- `GET /api/calls` - Flattened call logs

## Real Bolna Integration

Configure backend env:

- `BOLNA_API_KEY`
- `BOLNA_API_BASE_URL`
- `BOLNA_AGENT_ID_PHASE1`
- `BOLNA_AGENT_ID_PHASE2`
- `BOLNA_WEBHOOK_SECRET`
- `APP_BASE_URL` (public backend URL so Bolna can call webhook)

Webhook should send at least:

- `orderId` (or `metadata.orderId`)
- `phase` (or `metadata.phase`)
- `response` / `intent`
- `callId`
- optional `transcript`

## Production Deployment (Render + MongoDB Atlas)

1. Create Atlas cluster and copy `MONGODB_URI`.
2. Deploy backend on Render:
   - Root: `server`
   - Build: `npm install`
   - Start: `npm start`
   - Env: set all backend vars, especially:
     - `STORAGE_MODE=mongo`
     - `MONGODB_URI=<atlas-uri>`
     - `APP_BASE_URL=<render-backend-url>`
3. Deploy frontend on Vercel:
   - Root: `client`
   - Env: `VITE_API_URL=<render-backend-url>/api`
4. Put backend webhook URL into Bolna agent config:
   - `<APP_BASE_URL>/api/webhook/bolna`

## Engineering Note

For demo simplicity, delayed scheduling can be handled in-memory.  
In production, move scheduling/retry jobs to a persistent queue (BullMQ / Temporal).
