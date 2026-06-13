# StockSnap — High-Level Design (HLD)

**Author:** Sidhant Allawadi
**Status:** Prototype / assignment submission

---

## 1. Problem

Kirana (neighbourhood grocery) stores receive **daily perishable deliveries** — milk, bread, curd, eggs — from **local ad-hoc vendors** who hand over a **rough, handwritten paper slip** (e.g. *"Toned Milk – 1 crate"*, *"Bread – 10"*). These deliveries never make it into the formal inventory system, because:

- they arrive on paper, not as digital invoices/POs;
- they happen daily, often informally;
- typing them in by hand is slow and error-prone, so it simply doesn't get done.

The result is an inventory system that is **always out of date** for exactly the fast-moving, perishable items that matter most.

**Goal:** let the store owner capture a handwritten delivery slip in seconds — by photo (uploaded, or sent on WhatsApp) — have AI read it, match it to the catalogue, and update stock after a quick human confirmation.

### Goals
- Read a handwritten note (English / Hindi / Hinglish) into structured items + quantities.
- Match each item to the store's catalogue; convert units (e.g. crate → packets).
- Keep a **human in the loop** — nothing changes stock without confirmation.
- Two intake channels: **web upload** and **WhatsApp**.
- A live dashboard with stock, low-stock and expiry signals, plus an AI assistant.

### Non-goals (for this prototype)
- Replacing the full formal inventory/POs (we only handle the daily-vendor slice).
- Multi-store / multi-user accounts and authentication.
- Payments, vendor billing, or accounting.
- Consumption/sales tracking (we track *receipts*, not *sales*).

---

## 2. High-level architecture

A single **Next.js** application serves both the UI and the backend API routes (a **monolith**). It talks to a **SQLite** database via **Prisma**, and to **Google Gemini** for vision (reading notes) and text (assistant/insights). **Twilio** bridges WhatsApp to a webhook.

```
                 ┌──────────────────────── Intake ────────────────────────┐
                 │                                                          │
   Web browser ──┤  Upload photo (modal)                                    │
                 │                                                          │
   WhatsApp ─────┤  Send photo ─► Twilio ─► webhook                         │
                 └──────────────────────────┬───────────────────────────────┘
                                            │
                ┌───────────────────────────▼─────────────────────────────┐
                │                NEXT.JS APP  (UI + API routes)            │
                │                                                          │
                │   /api/extract        /api/whatsapp                      │
                │        └──────────┬───────────┘                          │
                │                   ▼                                       │
                │      processDeliveryImage()                              │
                │        1. Gemini Vision  → items as JSON                 │
                │        2. Matcher        → catalogue product (aliases)   │
                │        3. Unit resolver  → crates → base units           │
                │        4. save PENDING delivery                          │
                │                                                          │
                │   Review (web modal)  OR  reply "CONFIRM" (WhatsApp)     │
                │                   │                                       │
                │                   ▼                                       │
                │   /api/.../confirm → applyDeliveryToStock()              │
                │        increments stock + writes a dated Batch           │
                │                                                          │
                │   /api/chat, /api/insights → Gemini over live inventory  │
                └───────────────────────────┬─────────────────────────────┘
                                            │  Prisma
                                ┌───────────▼───────────┐
                                │   SQLite database      │
                                │   Product · Delivery   │
                                │   DeliveryLine · Batch │
                                └────────────────────────┘
```

### Components
- **UI (React/Next.js, Tailwind):** dashboard (sortable/filterable/collapsible tables), the New-Delivery modal (multi-photo upload → review → confirm), the AI assistant panel (chat + insights, with voice input), the editable delivery log.
- **API routes (Next.js):** `extract`, `whatsapp`, `deliveries/[id]/confirm|reopen`, `deliveries/[id]` (GET/DELETE), `products`, `chat`, `insights`.
- **Domain libraries (`src/lib`):** `gemini` (vision), `match` (catalogue matching + unit conversion), `processNote` (shared intake pipeline incl. image normalization — auto-rotate + downscale via `sharp` — handling one or more photos), `deliveries` (apply/reverse stock), `inventory` (live snapshot for AI), `prisma` (DB client).
- **Database (SQLite via Prisma):** the source of truth for catalogue and stock.
- **External services:** Google Gemini (AI), Twilio (WhatsApp bridge), cloudflared (dev tunnel to expose localhost).

---

## 3. Data model

```
Product                          Delivery                       DeliveryLine
─────────                        ──────────                     ─────────────
id                               id                             id
name (unique)                    vendorName                     deliveryId  ─► Delivery
brand                            source  (upload | whatsapp)    rawText      (what AI read)
category                         sourceRef (WhatsApp sender)    rawName, quantity, rawUnit
unit  (packet/loaf/tray…)        imagePath                      productId    ─► Product (nullable)
unitsPerCrate                    status  (pending|confirmed)    resolvedQty  (in base units)
stock                            createdAt, confirmedAt         confidence
shelfLifeDays (nullable)                                        status (matched|unmatched|confirmed)
aliases (csv, for matching)
supply (local_vendor|distributor)     Batch
                                      ──────
                                      id, productId ─► Product
                                      deliveryId ─► Delivery (nullable)
                                      quantity, receivedAt, expiresAt
```

Key ideas:
- **`supply`** splits the catalogue into the *daily-vendor* subset (what slips contain) and *formal* stock (rice, soap…). AI matching is scoped to `local_vendor` only — more accurate, true to the domain.
- **`unitsPerCrate`** is **per product**, because a "crate" isn't universal (milk ≈ 30 pouches, curd ≈ 12 cups).
- **`Batch`** is a small ledger: each confirmed line creates a batch with its own `expiresAt` (= received + `shelfLifeDays`). This powers **"expiring today"** and **"added today"**, and — because each batch is tagged with `deliveryId` — makes a delivery's stock effect **reversible** (for edit/delete).

---

## 4. Key flows

**A. Web upload → confirm**
1. Owner uploads **one or more** photos in the modal → `POST /api/extract`.
2. Each image is normalized (auto-rotated, downscaled), then Gemini reads → matcher maps to products → unit resolver. Lines from all photos are **combined into one pending delivery**.
3. Owner reviews note + items side-by-side, corrects anything, clicks Confirm → `POST /api/deliveries/:id/confirm` → `applyDeliveryToStock` increments stock and writes batches.

**B. WhatsApp → confirm in chat**
1. Vendor/owner sends a photo to the WhatsApp number → Twilio → `POST /api/whatsapp`. An **instant "Reading…" acknowledgement** is sent back (via Twilio's REST API) so the user knows it's working while the AI runs.
2. Same intake pipeline → pending delivery (with `sourceRef` = sender) → reply lists items + *"Reply CONFIRM / CANCEL"*.
3. Owner replies **CONFIRM** (case/punctuation-tolerant; also `yes`/`haan`/`ok`) → the latest pending delivery for that sender is applied via the same `applyDeliveryToStock`. **CANCEL** discards it.

**C. Edit / delete a delivery (reversible)**
- **Edit/reopen:** if confirmed, its stock is first **reversed** (subtract back out, delete its batches) and set back to pending, then reopened for re-review.
- **Delete:** if confirmed, reverse first, then remove.

**D. AI assistant**
- `chat` and `insights` build a **live text snapshot** of inventory and pass it to Gemini, so answers are grounded in current data (can't invent products). Voice uses the browser's Web Speech API.

---

## 5. Technology choices & why

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js (App Router, JS)** | One project for UI + API; fast to build; huge ecosystem |
| Styling | **Tailwind CSS** | Consistent UI quickly |
| Database | **SQLite + Prisma** | Zero-setup, file-based; type-safe queries; trivial to run anywhere |
| AI (vision + text) | **Google Gemini 2.5 Flash** | Strong handwriting reading; cheap/fast; generous free tier |
| Image handling | **sharp** | Auto-rotate (EXIF) + downscale uploads → robust, faster AI |
| WhatsApp | **Twilio sandbox** | Fastest path to a working WhatsApp demo |
| Dev tunnel | **cloudflared** | Exposes localhost to Twilio with no signup |
| Tests | **Node built-in test runner** | No extra dependencies |

---

## 6. Key design decisions & tradeoffs

1. **Human-in-the-loop, always.** AI never writes to stock directly; the owner confirms every delivery.
   - *Why:* inventory is a system of record; a wrong silent update is worse than a small manual correction. The system **degrades gracefully** — worst case is fixing one row.

2. **AI does only the hard, fuzzy part (reading); matching & conversion are plain code.**
   - *Why:* deterministic, testable, explainable. We can unit-test matching; we can't unit-test "the model felt like it".

3. **Vendor-scoped matching** (match only against `local_vendor` SKUs).
   - *Why:* slips never contain rice or shampoo, so scoping cuts false matches. *Tradeoff:* a formal item on a slip won't auto-match — mitigated by letting the reviewer pick from the full catalogue.

4. **Batch ledger for expiry + reversibility.**
   - *Why:* perishables expire per-batch (FEFO); tagging batches to deliveries makes stock changes auditable and undoable. *Tradeoff:* we don't track sales, so expired units aren't auto-removed (shown as a warning, not deducted).

5. **Monolith, SQLite, sandbox.**
   - *Why:* simplest thing that fully works for a prototype. *Tradeoff:* not yet built for high concurrency / many stores — see roadmap.

---

## 7. Edge cases & failure handling

- **Unreadable / blank note** → AI returns no items → UI says "couldn't read, send a clearer photo"; blank reads never match a random product (matcher rejects empty input).
- **Ambiguous names** ("milk", "double toned") → matcher scores by *specificity* (length-weighted); the reviewer can override. *(Both covered by unit tests.)*
- **Non-image / oversized upload** → rejected with a friendly message (10 MB cap, per image).
- **Sideways phone photos** → auto-rotated from EXIF orientation before the AI reads them.
- **Multiple photos in one delivery** → each is validated and read independently, then merged into a single review.
- **Malformed AI JSON** (markdown fences, wrong shape) → defensive parser returns an empty list, never crashes.
- **Double confirm** → blocked; **delivery not found** → 404; **negative quantity** → clamped to ≥ 0.
- **WhatsApp media** → downloaded with Twilio Basic auth; failures reply with a retry message.

Tested with `npm test` (matching + parsing, 19 cases) plus integration checks of the confirm/reverse/delete lifecycle.

---

## 8. Security & secrets

- API keys / tokens live in `.env.local` / `.env`, which are **git-ignored** — never committed. A committed **`.env.example`** documents the required variables without exposing values.
- For the WhatsApp prototype, the dev tunnel and Twilio sandbox are demo-only. Production would verify Twilio's request signature, use the official Meta WhatsApp Cloud API, and store secrets in a managed secret store.

---

## 9. Scaling / production roadmap

If this grew to Jumbotail scale (many stores, high volume):

1. **Database:** SQLite → **Postgres** (managed), with per-store tenancy and indexes.
2. **Decompose the monolith** into services where it pays off:
   - a **Vision/OCR service** (the heavy, independently-scalable AI step),
   - an **Inventory service** (source of truth for stock),
   - a **Notification/WhatsApp service**.
   Connect them with a queue (e.g. SQS/Kafka) so a spike in photos doesn't block the UI.
3. **WhatsApp:** Twilio sandbox → **Meta WhatsApp Cloud API** with verified templates and interactive buttons (tap "Confirm" instead of typing).
4. **Async processing:** push images onto a queue; process and notify, so the webhook returns instantly.
5. **Catalogue intelligence:** per-vendor catalogues, learned aliases from past corrections, confidence-based auto-confirm for high-trust lines.
6. **Auth & multi-store:** accounts, roles, audit log; deploy on a host (Vercel/AWS) instead of localhost + tunnel.
7. **Observability:** logging, metrics, error tracking, and AI-quality monitoring (extraction accuracy over time).

---

## 10. Repository map

```
src/
  app/
    page.js                       Dashboard (server component)
    api/
      extract/                    web upload → pipeline
      whatsapp/                   Twilio webhook (photo + CONFIRM/CANCEL)
      deliveries/[id]/            GET, DELETE, confirm, reopen
      products/ chat/ insights/   catalogue, AI assistant, AI insights
    components/                   ProductTable, DeliveriesPanel, DeliveryFlow,
                                  DeliveryModal, Modal, ChatPanel
  lib/
    gemini.js  match.js  processNote.js  deliveries.js  inventory.js  prisma.js
prisma/
  schema.prisma  seed.mjs  migrations/
tests/
  match.test.mjs  parse.test.mjs
```
