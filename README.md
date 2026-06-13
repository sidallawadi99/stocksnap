# 📦 StockSnap — AI Inventory Updates from Handwritten Vendor Notes

StockSnap lets a kirana (neighbourhood grocery) store keep its inventory in sync with the **daily ad-hoc vendors** — the milk man, the bread man — who still hand over **rough, handwritten delivery slips** ("Toned Milk – 2 crate", "Bread – 10").

The owner snaps a photo of that slip (uploaded on the web, or sent on **WhatsApp**). AI reads the note, matches each line to the catalogue, converts crates → packets, the owner **reviews & confirms**, and stock updates.

> Built as an assignment for Jumbotail. It closes the gap between a formal inventory system and the messy, paper-based reality of daily perishable deliveries.

---

## ✨ Features

- 📸 **Photo intake** — upload **one or more** notes on the web, or **send one on WhatsApp** and reply `CONFIRM` in chat.
- 🤖 **AI reading** (Google Gemini vision) → structured `{ item, quantity, unit }`; handles **handwriting, Hindi/Hinglish, shorthand** (pkt/peti/crate); photos auto-rotated + downscaled.
- 🗂️ **Catalogue matching** (alias-aware) with **unit conversion** (2 crates → 60 packets), **"did you mean…" suggestions**, and **add-as-new-product** for unmatched items.
- ✅ **Human-in-the-loop** — nothing changes stock until the owner confirms; confirmed deliveries are **reversible** (edit/delete undoes stock).
- 📊 **Dashboard** — live stock split into daily-vendor vs formal; **expiring-today**, **(+N) added-today**, and **low-stock** signals; sortable/filterable/collapsible tables; an editable delivery log.
- 💬 **AI assistant** — chat (English/Hindi/Hinglish) + 🎤 voice, grounded in live inventory; an **Insights** tab.
- 🔐 **Multi-tenant** — 5 store logins (isolated inventories) + an **admin** with per-store activity & **AI-accuracy** analytics, and drill-down into any store.
- 🛡️ **Hardening** — auth + ownership checks, rate limiting, input validation, reversible stock ledger.

---

## 🔑 Demo logins

| Role | Username | Password |
|------|----------|----------|
| Store owners | `store1` … `store5` | `1234` |
| Admin | `admin` | `admin` |

> Plain passwords are **prototype-only**; production would hash them + use proper sessions.

---

## 🚀 Run it locally

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ and npm
- A **free** Gemini API key → https://aistudio.google.com/apikey

### Steps
```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables (copy the template, then add your key)
cp .env.example .env.local
cp .env.example .env          # Prisma reads .env
#   → open both files and set GEMINI_API_KEY=<your key>
#   (Twilio keys are optional — only for the WhatsApp feature)

# 3. Create the database + sample data (5 stores, catalogues, deliveries)
npx prisma migrate dev
npm run seed

# 4. Start the app
npm run dev
```
Open **http://localhost:3000** and sign in with a demo login above.

### Run the tests
```bash
npm test      # 36 unit tests (matching, parsing, stock apply/reverse, rate limiter)
```

---

## 📲 WhatsApp (optional)

The WhatsApp flow needs a public URL for Twilio's webhook to reach your local app:

1. Add your **Twilio** Account SID + Auth Token to `.env.local` (free WhatsApp sandbox at [twilio.com](https://www.twilio.com/whatsapp)).
2. Expose localhost: `cloudflared tunnel --url http://localhost:3000` (install via `brew install cloudflared`).
3. In the Twilio WhatsApp **sandbox settings**, set *"When a message comes in"* to `<tunnel-url>/api/whatsapp` (POST).
4. Join the sandbox from your phone, then send a photo of a note → reply `CONFIRM`.

WhatsApp deliveries are routed to `store1` in this prototype (production would map each sender to their store).

---

## 🧰 Tech stack

| Layer | Choice |
|-------|--------|
| Web framework | **Next.js** (App Router, JavaScript) + **Tailwind CSS** |
| Database | **SQLite** + **Prisma** ORM |
| AI (vision + text) | **Google Gemini 2.5 Flash** |
| Image handling | **sharp** (auto-rotate + downscale) |
| WhatsApp | **Twilio** sandbox + **cloudflared** tunnel (dev) |
| Tests | Node's built-in test runner |

---

## 🗂️ Project structure

```
src/
  middleware.js (root)            Auth gate + role routing
  app/
    page.js                       Owner dashboard (store-scoped)
    login/                        Login page
    admin/                        Admin analytics + per-store drill-down
    api/
      login, logout               Session
      extract                     Web upload → AI pipeline
      whatsapp                    Twilio webhook (photo + CONFIRM/CANCEL)
      deliveries/[id]/...         confirm, reopen, delete (ownership-checked)
      products, chat, insights    catalogue (+create), AI assistant, AI insights
    components/                   ProductTable, DeliveriesPanel, DeliveryFlow,
                                  DeliveryModal, Modal, ChatPanel
  lib/
    gemini, match, processNote, deliveries, inventory, auth, rateLimit, prisma
prisma/   schema.prisma · seed.mjs · migrations/
tests/    match · parse · deliveries · rateLimit
```

---

## 🛣️ Roadmap & design

See **[HLD.md](./HLD.md)** for the full high-level design — architecture, data model, decisions & trade-offs, edge cases, and the scaling path (Postgres, S3, queues, microservices, Meta WhatsApp API).

_Author: Sidhant Allawadi_
