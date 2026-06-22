# StockSnap — Vision & Roadmap

**Vision:** turn a handwritten-note capture tool into the **inventory operating system for kirana stores** — and, for Jumbotail, a **data + reorder wedge** into the B2B marketplace.

> The arc: *note-capture tool → full inventory OS for kiranas → demand & procurement funnel for Jumbotail.*

**Guiding principles**
- **Human-in-the-loop** — AI removes the typing; the owner stays in control.
- **WhatsApp-first** — meet kirana owners where they already are.
- **Gets smarter with use** — every correction makes the next read better.
- **Decisions, not just records** — every number should drive an action.

---

## Where it is today (foundations ✅)
Photo (web or WhatsApp) → AI reads handwriting → catalogue match + unit conversion → human confirms → stock updates. Multi-tenant (5 stores + admin), reversible batch ledger, expiry/low-stock signals, an AI assistant (chat + voice + insights), a behavioural **AI-accuracy metric**, tests, and rate limiting. *(See `HLD.md`.)*

---

## Roadmap

### 🟢 Now → Next  (deepen the core)
| # | Initiative | Why it matters |
|---|---|---|
| 1 | **Self-improving matching** — corrections become learned aliases; later, fine-tune on them | The moat: accuracy trends up with use |
| 2 | **Close the sales loop (POS)** — stock decrements on sale, not just on receipt | Unlocks true real-time inventory, real FEFO expiry, and demand data |
| 3 | **Demand forecasting + 1-tap reorder** | Becomes a decision tool, not a ledger |
| 8 | **Real WhatsApp (Meta Cloud API)** — tap-to-confirm buttons, richer agent | WhatsApp as the primary interface |

### 🟡 Later  (production-grade + expand)
| # | Initiative | Why it matters |
|---|---|---|
| 4 | **Reconciliation, waste & shrinkage detection** | Hard ₹ ROI the owner feels |
| 5 | **Model strategy** — self-hosted/fine-tuned vision model, OCR fallback, regional scripts | Lower cost, wider coverage, offline-capable |
| 6 | **Multi-modal ingestion** — invoices, barcodes, voice; catalogue bootstrap by scanning shelves | Handles every input; removes setup friction |
| 7 | **Production architecture** — Postgres, S3, queue + workers, autoscaling, observability, fuller test pyramid | Survives Jumbotail-scale volume |
| 9 | **Phone-OTP auth + offline-first PWA** | Table stakes for flaky-connectivity adoption |

### ⭐ North Star  (the strategic play)
| # | Initiative | Why it matters |
|---|---|---|
| 10 | **The Jumbotail wedge** — low stock → one-tap reorder *from Jumbotail*; daily-vendor + sales data feeds Jumbotail's demand planning & procurement | StockSnap becomes a **customer-acquisition + data funnel** for Jumbotail's core business |

---

## First three to chase
1. **#2 Close the sales loop** — unlocks the most downstream value.
2. **#1 Self-improving AI** — the durable competitive moat.
3. **#10 Jumbotail integration** — the strategic story that wins the room.

_Author: Sidhant Allawadi_
