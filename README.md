# 🎟️ Gatehouse — High-Concurrency Serverless Event Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Zero Build](https://img.shields.io/badge/Build-Zero%20Build%20%2F%20Vanilla%20Web-brightgreen.svg)]()
[![Invariant](https://img.shields.io/badge/Guarantee-Zero%20Oversell-blue.svg)]()
[![PRD Version](https://img.shields.io/badge/PRD-v1.0%20Compliant-purple.svg)](prd_render/PRD_SPECIFICATION.md)
[![Status](https://img.shields.io/badge/Status-Production%20Ready%20MVP-success.svg)]()

> **Transactional ticket safeguards, queue-buffered auto-scaling, and fraud-resilient digital ticketing.**

**Gatehouse** is a high-concurrency event ticketing platform prototype engineered directly from the accompanying **17-page Product Requirements Document (PRD)**. It models high-demand on-sale moments where 100,000+ concurrent fans attempt to purchase scarce inventory, enforcing a **strict zero-oversell invariant** and protecting the user experience against bot automation and network failures.

Built with **pure vanilla HTML5, modern CSS3, and ES6+ JavaScript** — no build step, no npm dependencies, and 100% GitHub Pages ready.

---

## 🏗️ Architecture & State Machine

```
   [ Fan / Client ]
          │
          ▼
   [ Edge API Gateway ] ──── Rate Limiting & WebAuthn Session Verification
          │
          ▼
 [ Virtual Waiting Room ] ── Cryptographic Signed Admission Tokens (#8F9D)
          │                  (Adaptive Rate Metering: 30–600 fans/min)
          ▼
[ Seat Selection & Lease ] ─ 5-Minute Authoritative Lease (TTL Expiry Watchdog)
          │                  (Rows A–B VIP Balcony £95 | Rows C–F Lower Bowl £65)
          ▼
[ Idempotent Checkout ] ─── Deduplication Keys (IDEM-...) Preventing Double Charges
          │
          ▼
[ Transactional Outbox ] ── Immutable Domain Events (OrderPurchased, PaymentAuthorized)
          │
          ▼
[ Fraud-Resilient Ticket ] ─ Digitally Signed 15s Dynamic Rotating QR Credential
```

---

## ✨ Key Features & PRD Implementation

### 1. Fan Purchase Journey
- **Event Discovery & Full Catalog:** Explore featured on-sales (*The Midnight Stations — Afterlight World Tour*) or open the full catalog modal with real-time status pills (`LIVE SALE`, `PRE-SALE`, `WAITLIST`).
- **Fair Virtual Waiting Room:** Position tracker (`#12,482`), live progress animation, and cryptographic admission tokens. Includes a demo bypass (`Demo: admit me now →`) for rapid testing.
- **Interactive Tiered Seat Map:** 72-seat interactive venue map with distinct tier pricing and guardrails:
  - **VIP Balcony:** £95.00 (Rows A–B)
  - **Lower Bowl:** £65.00 (Rows C–F)
  - **Verified Fan Allocation Limit:** Maximum 2 tickets per fan.
- **5-Minute Reservation Lease (TTL):** Bounded holds with active countdown timer (`05:00`). Upon expiration, the checkout form safely locks down and returns seats to available inventory.
- **Idempotent Payment Simulation:** Unique deduplication tokens (`IDEM-94D3F-...`) guarantee that retries never double-capture payment intents.

### 2. Fraud-Resilient Digital Credentials (US-09, FR-TX-05)
- **Dynamic Rotating QR Code:** High-contrast digital ticket with a **15-second rotating cryptographic HMAC token** (`GATEHOUSE-V2-SIG-...`) and visual countdown bar to defeat screenshots and scalper reselling.
- **Verified Ticket Transfer:** Transfer digital credentials to another verified fan's email address with audit event emission.
- **Instant Refund & Inventory Release:** Request a refund which immediately releases the reserved seat back into the available pool for other fans.

### 3. SRE, Support & Operations Tooling (FR-OP-01 to FR-OP-05)
- **Distributed Trace Explorer:** Search correlation IDs (`ORD-94D3F`, `PAY-8AE2`, `RSV-882A`, or dynamically created orders) to inspect saga latency across spans (`Edge Gateway` → `Queue Controller` → `Inventory Aggregate` → `PSP Adapter` → `Transactional Outbox` → `Credential Worker`) and view raw JSON event payloads.
- **Admission Policy Controller:** Real-time queue tuning:
  - **Fairness Algorithms:** *Verified Arrival (FCFS)*, *Randomized Waiting Room (Lottery)*, and *Verified Fan Entitlement (Hybrid)*.
  - **Admission Rate:** Configurable from 30 to 600 admissions/minute.
  - **Anti-Starvation SLO Watchdog:** Alerts operators if cohort wait-time disparity exceeds 15%.
- **Event Creation Console:** Define and publish new on-sales with venue, schedule, and authoritative tier allocations.
- **Verified Fan Profile Dialog:** Inspect fan identity (`DK`), Level 3 verification tier, household quota limits (2/2 remaining), and device risk scoring.

---

## 📁 Repository Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml        # Automated GitHub Pages CI/CD workflow
├── .gitignore                # Comprehensive Git ignore rules (OS, IDE, temporary files)
├── LICENSE                   # Open-source MIT License
├── README.md                 # Project documentation and architectural overview
├── index.html                # Single-page application shell with accessible modals & views
├── app.js                    # Client application logic, state machine & distributed tracer
├── styles.css                # Dark-mode design system (#07151f / #c6f64d), responsive layout
├── prd_render/
│   └── PRD_SPECIFICATION.md  # Complete 17-page PRD specification rendered in Markdown
└── High_Concurrency_Serverless_Event_Platform_PRD.pdf  # Original PRD document
```

---

## 🚀 Getting Started

Because Gatehouse is built with vanilla web technologies, **no build step, compilation, or package installation is required**.

### Option 1: Run with Python (Recommended)
```bash
python -m http.server 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

### Option 2: Run with Node.js
```bash
npx serve .
```
Open the local URL displayed in your terminal (typically `http://localhost:3000`).

### Option 3: Direct Browser Launch
Simply double-click `index.html` or run:
```powershell
Start-Process .\index.html
```

---

## 🌐 Deploy to GitHub Pages

This repository includes a pre-configured GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

1. Push this repository to GitHub.
2. Go to **Settings** > **Pages** in your GitHub repository.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. Your site will automatically deploy and be accessible at:  
   `https://<your-username>.github.io/<repository-name>/`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
