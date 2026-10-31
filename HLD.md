# High-Level Design (HLD): British Auction RFQ System

## 1. Problem & Executive Summary
In logistics freight procurement, buyers issue **Requests for Quotation (RFQs)** inviting transport carriers to quote. In conventional sealed-bid procurement, **bid sniping** (submitting bids in the final seconds) deprives genuine carriers of the opportunity to respond and prevents fair market price discovery.

The **British Auction mechanism** in this system provides:
* **Dynamic Auto-Extension**: If competitive bids arrive during the **Trigger Window ($X$ minutes)** before close, the auction extends by **$Y$ minutes**.
* **Hard Cutoff Cap**: Extensions can **never exceed the Forced Close deadline**, preventing indefinite delays.
* **Transparent Reverse Bidding**: Real-time rank leaderboard ($L_1, L_2, L_3\dots$) where the lowest price wins.

---

## 2. System Architecture Diagram

```mermaid
flowchart TB
    subgraph ClientLayer["Frontend Client (React 18 + Vite + TailwindCSS)"]
        UI_List["Auction Listing Page\n(/)"]
        UI_Create["RFQ Creation Form\n(/rfq/create)"]
        UI_Detail["Auction Room & Leaderboard\n(/rfq/:id)"]
        UI_Charts["Interactive Analytics\n(BidTrend & CostBreakdown)"]
    end

    subgraph APILayer["Backend Server (FastAPI + Uvicorn)"]
        AuthRoute["Auth Router (/api/auth)"]
        RFQRoute["RFQ Router (/api/rfqs)"]
        BidRoute["Bid Router (/api/rfqs/:id/bids)"]
        AuthMW["JWT Security & Role Guard\n(BUYER / SUPPLIER)"]
        Scheduler["Background Lifecycle Scheduler\n(APScheduler: UPCOMING ➔ ACTIVE ➔ CLOSED)"]
    end

    subgraph EngineLayer["Core Business Logic Engine"]
        RankSvc["Ranking Engine\n(Atomic Dense Re-ranking ASC: L1, L2, L3)"]
        ExtEngine["British Auction Extension Engine\n(Trigger Window X, Duration Y, Forced Close Cap)"]
        AuditLogger["Activity Audit Logger\n(Real-time Event Logging)"]
    end

    subgraph DBLayer["Database (PostgreSQL / SQLite fallback via SQLAlchemy 2.0 Async)"]
        UsersTable[("users")]
        RFQsTable[("rfqs")]
        ConfigsTable[("auction_configs")]
        BidsTable[("bids")]
        SuppliersTable[("rfq_suppliers")]
        LogsTable[("auction_activity_log")]
    end

    UI_List & UI_Create & UI_Detail & UI_Charts -->|HTTP REST + Bearer JWT| AuthMW
    AuthMW --> AuthRoute & RFQRoute & BidRoute
    BidRoute --> RankSvc
    RankSvc --> ExtEngine
    ExtEngine --> AuditLogger
    ExtEngine -->|Async Session Transaction| DBLayer
    RFQRoute --> DBLayer
    AuthRoute --> DBLayer
    Scheduler -->|Auto-close Expired / Forced Close| DBLayer
```

---

## 3. Core Component Breakdown

| Layer / Component | Technology | Primary Responsibilities |
| :--- | :--- | :--- |
| **Frontend SPA** | React 18, Vite, Tailwind CSS | Buyer RFQ creation, carrier quoting modal, live L1/L2 leaderboard, countdown timers, price trend charts. |
| **API Gateway & Auth** | FastAPI, Python-Jose (JWT) | Role-Based Access Control (`BUYER` vs `SUPPLIER`), schema validation, CORS security. |
| **Extension Engine** | Python 3.12, SQLAlchemy Async | Atomic evaluation of trigger conditions ($X$), duration ($+Y$), and forced close cap enforcement. |
| **Ranking Service** | Python 3.12 | Computes lowest total price ($L_1$), handles ties by earliest submission timestamp. |
| **Lifecycle Scheduler** | APScheduler | Evaluates auction deadlines every 15 seconds, transitions `UPCOMING` $\rightarrow$ `ACTIVE` $\rightarrow$ `CLOSED`. |
| **Data Persistence** | PostgreSQL 14+ / SQLite fallback | ACID transactions, foreign key cascades, check constraints, indexed lookup by status and close time. |

---

## 4. British Auction Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Carrier as Supplier (Carrier)
    participant API as FastAPI Backend
    participant Auth as Role Guard (JWT)
    participant Rank as Ranking Service
    participant Engine as Extension Engine
    participant DB as Relational Database

    Carrier->>API: POST /api/rfqs/{id}/bids (freight, origin, dest)
    API->>Auth: Validate JWT & Verify SUPPLIER role
    Auth-->>API: Authorized (Supplier Verified)

    API->>Rank: Compute Total Price & Dense Rank (ASC)
    Rank->>DB: Fetch active quotes for RFQ
    DB-->>Rank: Quotes list
    Rank-->>API: Assigned Rank (e.g. L1)

    API->>Engine: Evaluate Extension Rules
    Note over Engine: Is now within Trigger Window [close - X, close]?
    
    alt Outside Trigger Window
        Engine-->>API: No extension (Quote recorded, rank updated)
    else Inside Trigger Window (Trigger Condition Met)
        Note over Engine: proposed = bid_close_time + Y minutes
        Note over Engine: new_close = MIN(proposed, forced_close_time)
        Engine->>DB: UPDATE rfq SET bid_close_time = new_close
        Engine->>DB: INSERT INTO auction_activity_log (TIME_EXTENDED)
        Engine-->>API: Auction Extended to new_close
    end

    API->>DB: Commit Transaction (Atomically Save Bid + Logs)
    DB-->>API: Committed
    API-->>Carrier: 201 Created (Bid Details, Current Rank, New Close Time)
```

---

## 5. Anti-Sniping Guarantees & Edge Cases

1. **Anti-Sniping Protection**:
   - Submissions inside the final **X minutes** automatically extend the clock by **Y minutes**, allowing all participants time to re-evaluate their quotes.
2. **Hard Deadline Cap**:
   - `bid_close_time = min(proposed_time, forced_close_time)`
   - If an extension would push the close time beyond the hard cap, it is clipped exactly to `forced_close_time`.
3. **Database Concurrency**:
   - Bid submission, re-ranking, and extension evaluation run within a single database transaction, preventing race conditions.

