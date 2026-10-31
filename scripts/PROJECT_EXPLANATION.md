# British Auction RFQ System — Complete Project Guide & Interview Playbook

---

## 1. What Is This Project?

At its core, this project is a **B2B Logistics Bidding Platform** that combines two concepts:

1. **Request for Quotation (RFQ)**:  
   A business (the **Buyer**) needs to ship freight (e.g., *"Ship 20 containers from Mumbai to Rotterdam"*). Instead of calling carriers one by one, the Buyer posts an RFQ online and invites logistics carriers (the **Suppliers**) to submit their prices.

2. **British Auction (Reverse Auction with Auto-Extension)**:  
   In a normal auction (like eBay or fine art), people bid *higher*, and the highest bidder wins.  
   In a **Reverse Auction**, carriers bid *lower* to win the job. The lowest price wins.  
   What makes it a **British Auction** is its smart timer: if someone places a competitive bid right before the auction ends, **the clock automatically adds extra minutes**.

---

## 2. Why Is a British Auction Used? (The Real-World Problem)

### The Problem: Last-Second "Sniping"
Imagine an auction is scheduled to end at 5:00:00 PM.
- Honest Carrier A offers **$10,000** at 4:30 PM.
- Carrier B sits quietly and waits until **4:59:58 PM** (two seconds before the cutoff) and bids **$9,950**.
- The clock hits 5:00:00 PM. Carrier B wins.

Carrier A never had time to see the bid or offer **$9,800**. The buyer missed out on a lower price, and Carrier A feels cheated. This practice is called **bid sniping**.

### The Solution: Anti-Sniping & Fair Discovery
In a British Auction:
- When Carrier B bids in the final minutes, the system says: *"Hold on! A competitive bid just came in. Let's add 5 more minutes to the clock."*
- Now Carrier A has time to counter-offer.
- The auction continues until carriers reach their true bottom price.
- To prevent this from going on indefinitely, the Buyer sets a **Forced Close Time** (a hard deadline that can never be extended).

---

## 3. Main Features of the System

| Feature | What It Does | Why It Matters |
|---|---|---|
| **Buyer RFQ Creation** | Buyers create shipment requests with cargo dates and auction rules. | Sets the parameters and guarantees `forced_close_time > bid_close_time`. |
| **Reverse Bidding** | Suppliers enter Freight, Origin, and Destination charges. | Automatically calculates `total_charges`. In a reverse auction, re-bids must be strictly lower. |
| **Dynamic Leaderboard** | Ranks active bids: **L1** (cheapest), **L2**, **L3**, etc. | Gives carriers transparent visibility into their competitive standing. |
| **Extension Engine** | Automatically extends the deadline if competitive bids arrive in the final $X$ minutes. | Eliminates bid sniping and drives fair market prices. |
| **Forced Close Deadline** | An immutable hard cutoff that extensions can never exceed. | Guarantees business decisions are made on schedule. |
| **Audit Activity Log** | Records every bid, rank change, and time extension with reasons. | Ensures enterprise transparency and dispute resolution. |

---

## 4. How the Extension Engine Works (In Plain English)

The **Extension Engine** is the brain of this project. Whenever a supplier submits a bid, the engine follows this exact 5-step decision flow:

```
[Supplier Submits Bid]
          │
          ▼
1. Is British Auction enabled?
   ├── NO  ──> Stop. Do not extend.
   └── YES ──> Go to Step 2.
          │
          ▼
2. Is the current time inside the Trigger Window (last X minutes)?
   ├── NO (e.g., 2 hours left) ──> Stop. Record bid, but do not extend.
   └── YES (e.g., 3 minutes left in a 10-minute window) ──> Go to Step 3.
          │
          ▼
3. Does the bid satisfy the Trigger Type?
   ├── BID_RECEIVED     ──> Any bid in the window qualifies.
   ├── ANY_RANK_CHANGE  ──> Qualifies only if any position on the leaderboard changed.
   └── L1_RANK_CHANGE   ──> Qualifies only if someone took over 1st place (new lowest price).
   ├── Condition NOT met ──> Stop. No extension.
   └── Condition MET     ──> Go to Step 4.
          │
          ▼
4. Calculate the new closing time:
   New Close Time = MIN( Current Close + Y minutes, Forced Close Time )
          │
          ▼
5. Did the time actually move forward?
   ├── NO (Already at forced close limit) ──> Stop. Cannot exceed hard deadline.
   └── YES ──> Update auction clock & write "TIME_EXTENDED" event in activity log.
```

---

## 5. Database Schema & Tables

The system uses **6 relational tables** in PostgreSQL:

1. **`users`**: Stores user accounts, bcrypt password hashes, and their role (`BUYER` or `SUPPLIER`).
2. **`rfqs`**: Stores shipment requests, reference IDs, pickup dates, rolling `bid_close_time`, hard `forced_close_time`, and status (`ACTIVE`, `CLOSED`, `FORCE_CLOSED`, `AWARDED`).
3. **`auction_configs`**: 1:1 table storing the British Auction parameters ($X$ trigger window, $Y$ extension duration, and trigger type).
4. **`rfq_suppliers`**: Join table tracking which suppliers are invited to bid on which RFQ.
5. **`bids`**: Stores quotes, line item charges (freight, origin, destination), auto-calculated `total_charges`, current rank ($1, 2, 3\dots$), and `is_active` flag.
6. **`auction_activity_log`**: Audit trail recording events like `RFQ_CREATED`, `BID_SUBMITTED`, and `TIME_EXTENDED` (with previous time, new time, and reason).

---

## 6. Backend Architecture (Python & FastAPI)

The backend is built with **FastAPI** following a modular, layered structure:

```
backend/
├── app/
│   ├── main.py            <-- FastAPI entrypoint, CORS & background scheduler
│   ├── core/              <-- Database connection (SQLAlchemy async) & JWT security
│   ├── models/            <-- SQLAlchemy 2.0 database tables
│   ├── schemas/           <-- Pydantic v2 validation models
│   ├── api/v1/            <-- Clean REST endpoints (/auth, /rfqs, /bids)
│   ├── services/          <-- auction_engine.py & ranking_service.py
│   ├── crud/              <-- Transactional database queries
│   └── utils/seed.py      <-- Seed script with demo accounts
├── alembic/               <-- Database migrations
└── tests/                 <-- Comprehensive pytest suite
```

---

## 7. Frontend Pages

The frontend is built with **React 18 + TailwindCSS**:

1. **Login / Register Page**: Allows logging in as a Buyer or Supplier.
2. **Auction Listing Page (Dashboard)**:
   - A table showing RFQ Name, Current Status (`ACTIVE`, `CLOSED`, etc.), Lowest Bid (**L1** price), Current Bid Close Time (with live countdown timer), and Hard Forced Close Time.
3. **RFQ Creation Page (Buyer Only)**:
   - Form to enter shipment name, dates, pickup date, and a toggle to enable British Auction mode with $X$, $Y$, and trigger type inputs.
4. **Live Auction Detail / Bidding Room**:
   - **Leaderboard**: Shows bids sorted by rank (L1, L2, L3) with green badges for the winning quote.
   - **Live Countdown Timer**: Shows seconds ticking down; dynamically jumps forward when an extension occurs.
   - **Quote Submission Modal (Supplier Only)**: Form to submit freight, origin, and destination charges.
   - **Activity Log**: Chronological live feed showing bid submissions and time extensions.
   - **Award Button (Buyer Only)**: Enables the buyer to award the contract once closed.

---

## 8. Portfolio & Interview FAQ

### Q1: Can I use this project as my personal portfolio project?
**Yes, absolutely!**  
This project demonstrates:
- Real-world business domain problems (logistics procurement, game theory, anti-sniping).
- Complex algorithmic business logic (extension rules, dense re-ranking).
- High-concurrency database handling (race condition prevention, row-level locks).

### Q2: Is it okay to put it on GitHub and showcase it in interviews?
**Yes, 100%.**  
Make sure your GitHub repository has a clean `README.md`, `.env.example`, automated tests, and instructions to run it in 2 minutes.

### Q3: What should I highlight when explaining this project to interviewers?
- **The Business Problem**: Explain bid sniping in fixed-deadline auctions.
- **The Extension Engine**: Detail the $X$ trigger window, $Y$ extension, and forced close cap.
- **Concurrency & Race Conditions**: Highlight PostgreSQL pessimistic row-level locking (`SELECT ... FOR UPDATE`).
- **Testing & Integrity**: Point to automated tests with `pytest-asyncio` and `httpx`.

