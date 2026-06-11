# 📦 StockSnap — AI Inventory Updates from Handwritten Vendor Notes

StockSnap lets a kirana (neighbourhood grocery) store keep its inventory in sync with the **daily ad-hoc vendors** — the milk man, the bread man — who still hand over **rough, handwritten delivery slips** ("Toned Milk – 2 crate", "Bread – 10").

The owner snaps a photo of that slip (e.g. forwards it on WhatsApp). StockSnap uses AI vision to **read the note**, **match each line to the catalogue**, converts crates → packets, lets the owner **review & correct**, and on confirmation **updates the stock**.

> Built as an assignment for Jumbotail. The goal is to close the gap between a formal inventory system and the messy, paper-based reality of daily perishable deliveries.

---

## ✨ What it does

- 📸 **Ingest a delivery note** by photo upload (designed so a WhatsApp webhook can feed the same pipeline).
- 🤖 **Read handwriting with AI** (Google Gemini vision) into structured `{ item, quantity, unit }` data — handles English/Hindi and shorthand like `pkt`, `peti`, `crate`.
- 🗂️ **Match to the catalogue** with an alias-aware fuzzy matcher, and **convert units** (e.g. 2 crates → 60 packets).
- ✅ **Human-in-the-loop review** — the owner fixes any wrong match or quantity before anything is committed.
- 📊 **Live inventory dashboard** with stock levels and low-stock alerts.

---

## 🏗️ Architecture (high level)

```
  Handwritten note (photo)
          │   upload  (or future: WhatsApp webhook)
          ▼
  ┌───────────────────────────────────────────────┐
  │  Next.js app (UI + API routes)                 │
  │                                                │
  │   /api/extract                                 │
  │     1. Gemini vision  → reads note to JSON     │
  │     2. Matcher        → maps text → catalogue  │
  │     3. Unit resolver  → crates → base units    │
  │     → saves a PENDING delivery                 │
  │                                                │
  │   Review screen (human confirms / corrects)    │
  │                                                │
  │   /api/deliveries/[id]/confirm                 │
  │     → applies quantities to stock (atomic)     │
  └───────────────────────────────────────────────┘
          │
          ▼
   SQLite database (via Prisma)
   Product · Delivery · DeliveryLine
```

**Why this shape:** the AI only does the hard, fuzzy part (reading handwriting). Matching and unit conversion live in plain, testable code, and **nothing touches stock until a human confirms** — important for an inventory system of record.

---

## 🧰 Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Web framework | **Next.js** (App Router, JavaScript) | One project for UI + backend API routes |
| Styling | **Tailwind CSS v4** | Fast, consistent UI |
| Database | **SQLite** + **Prisma ORM** | Zero-setup, file-based; easy to run anywhere |
| AI vision | **Google Gemini** (`gemini-2.5-flash`) | Strong handwriting reading; generous free tier |

---

## 🚀 Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ and npm
- A free **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Install dependencies
```bash
npm install
```

### 2. Add your API key
Create a file named `.env.local` in the project root:
```bash
GEMINI_API_KEY=your_key_here
```
The database URL is already set in `.env` (`DATABASE_URL="file:./dev.db"`).

### 3. Set up the database (creates tables + sample catalogue)
```bash
npx prisma migrate dev    # creates the SQLite database from the schema
npm run seed              # loads 11 sample products (milk, bread, curd…)
```

### 4. Run it
```bash
npm run dev
```
Open **http://localhost:3000**.

> 💡 No printer? `scripts/make_mock_note.py` generates a realistic handwritten-style test note (`public/uploads/mock_note.png`).

---

## 🗂️ Project structure

```
src/
  app/
    page.js                         Dashboard (inventory + recent deliveries)
    upload/page.js                  Upload + review/confirm screen
    api/
      extract/route.js              Photo → AI → match → pending delivery
      deliveries/[id]/confirm/route.js   Apply confirmed lines to stock
      products/route.js             Catalogue (for dropdowns)
  lib/
    gemini.js                       Gemini vision call + JSON parsing
    match.js                        Catalogue matching + unit conversion
    prisma.js                       Database client
prisma/
  schema.prisma                     Product · Delivery · DeliveryLine
  seed.mjs                          Sample catalogue
```

---

## 🛣️ Roadmap

- **Real WhatsApp intake** via Twilio (a webhook that drops the image into the existing `/api/extract` pipeline).
- Vendor-specific catalogues and price capture.
- Confidence-based auto-confirm for high-trust lines.

---

_Author: Sidhant Allawadi_
