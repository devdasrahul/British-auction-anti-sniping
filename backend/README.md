# British Auction RFQ System — Backend (Python / FastAPI)

This is the high-performance Python backend for the British Auction RFQ system built with **FastAPI**, **SQLAlchemy 2.0 (async)**, **PostgreSQL (asyncpg)**, and **Pydantic v2**.

---

## 🏛️ Architecture Overview

```
Frontend (React 18 + Vite)
      │
      │ REST API (Bearer JWT: BUYER / SUPPLIER)
      ▼
FastAPI Application (Uvicorn / ASGI)
  ├── Security & Auth Guards (python-jose, passlib)
  ├── API Routers (Auth, RFQs, Bids)
  ├── Services
  │    ├── auction_engine.py      <-- British Auction Extension Engine
  │    ├── ranking_service.py     <-- Atomic Dense Re-ranking
  │    └── scheduler_service.py  <-- Background Lifecycle Worker (APScheduler)
  └── SQLAlchemy 2.0 Async Session
       └── PostgreSQL 14+
```

---

## 📁 Directory Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI application entrypoint & lifespan
│   ├── core/
│   │   ├── config.py            # Settings with pydantic-settings
│   │   ├── database.py          # Async engine & session factory
│   │   └── security.py          # Password hashing (bcrypt) & JWT management
│   ├── models/                  # SQLAlchemy 2.0 declarative models
│   │   ├── user.py              # User & UserRole (BUYER, SUPPLIER)
│   │   ├── rfq.py               # RFQ, RFQStatus, check constraints
│   │   ├── auction_config.py    # 1:1 British Auction config (X, Y, trigger_type)
│   │   ├── bid.py               # Bids, quotes, line charges, stored total
│   │   └── activity_log.py      # Audit trail for extensions and bids
│   ├── schemas/                 # Pydantic v2 schemas
│   │   ├── user.py
│   │   ├── rfq.py               # Validators (forced_close > bid_close)
│   │   ├── auction_config.py
│   │   ├── bid.py
│   │   └── activity_log.py
│   ├── api/
│   │   ├── deps.py              # Dependency injection (get_db, require_role)
│   │   └── v1/
│   │       ├── auth.py          # Register, Login (JWT)
│   │       └── rfqs.py          # RFQ CRUD, bidding & extensions
│   ├── services/
│   │   ├── auction_engine.py    # British Auction extension logic & caps
│   │   ├── ranking_service.py   # Dense L1..Ln reverse auction ranking
│   │   └── scheduler_service.py # Background state transitions
│   ├── crud/                    # Database operations & transaction wrappers
│   │   ├── user.py
│   │   ├── rfq.py
│   │   └── bid.py
│   └── utils/
│       └── seed.py              # Database seeder (Buyer, Suppliers, Demo RFQ)
├── alembic/                     # Database migrations
├── tests/                       # Pytest test suite
│   └── test_auction_engine.py   # Unit tests for extension conditions
├── pyproject.toml
├── requirements.txt
├── .env.example
└── README.md
```

---

## ⚡ Extension Engine Logic (`app/services/auction_engine.py`)

When a bid is submitted:
1. **Trigger Window Check**: Evaluates if `now >= bid_close_time - X minutes`.
2. **Trigger Types**:
   - `BID_RECEIVED`: unconditionally extends.
   - `ANY_RANK_CHANGE`: extends if any active bid ranking shifts.
   - `L1_RANK_CHANGE`: extends only if the cheapest bidder (L1) changes.
3. **Rolling Calculation**: `new_close_time = min(bid_close_time + Y minutes, forced_close_time)`.
4. **Hard Deadline Cap**: Extension halts if `new_close_time <= current_close`.
5. **Audit Logging**: Inserts `TIME_EXTENDED` event in `auction_activity_log`.

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- PostgreSQL 14+

### 2. Environment Setup
```bash
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
```

### 3. Run Migrations & Seed
```bash
alembic upgrade head
python -m app.utils.seed
```

### 4. Run Unit Tests
```bash
pytest
```

### 5. Start Server
```bash
uvicorn app.main:app --reload --port 5000
```
- Swagger UI (Interactive API Docs): `http://localhost:5000/docs`
- ReDoc API Reference: `http://localhost:5000/redoc`

---

## 📡 API Documentation & Example Requests

### 1. Register a User
```bash
curl -X POST "http://localhost:5000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Logistics",
    "email": "buyer@acme.com",
    "role": "BUYER",
    "password": "Password123!"
  }'
```

### 2. Login & Obtain JWT Token
```bash
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "buyer@acme.com",
    "password": "Password123!"
  }'
```
Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "a1b2c3d4-...",
    "name": "Acme Logistics",
    "email": "buyer@acme.com",
    "role": "BUYER"
  }
}
```

### 3. Create an RFQ with British Auction Config (Buyer Only)
```bash
curl -X POST "http://localhost:5000/rfqs" \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JNPT to Rotterdam 40ft HC",
    "bid_start_time": "2026-10-31T09:00:00Z",
    "bid_close_time": "2026-10-31T15:00:00Z",
    "forced_close_time": "2026-10-31T17:00:00Z",
    "pickup_service_date": "2026-11-15",
    "is_british_auction": true,
    "auction_config": {
      "trigger_window_minutes": 10,
      "extension_duration_minutes": 5,
      "trigger_type": "L1_RANK_CHANGE"
    },
    "supplier_ids": [
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333"
    ]
  }'
```

### 4. List All Auctions (Shows Lowest L1 Bid & Status)
```bash
curl -X GET "http://localhost:5000/rfqs" \
  -H "Authorization: Bearer <TOKEN>"
```

### 5. Submit a Quote / Bid (Supplier Only)
*Triggers rank recalculation and evaluates the British Auction Extension Engine.*
```bash
curl -X POST "http://localhost:5000/rfqs/<RFQ_ID>/bids" \
  -H "Authorization: Bearer <SUPPLIER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "carrier_name": "Maersk Line",
    "freight_charges": 145000.00,
    "origin_charges": 12000.00,
    "destination_charges": 18000.00,
    "transit_time": "24 days",
    "quote_validity": "2026-11-30"
  }'
```
Response:
```json
{
  "bid": {
    "id": "b1b2c3d4-...",
    "carrier_name": "Maersk Line",
    "freight_charges": 145000.00,
    "origin_charges": 12000.00,
    "destination_charges": 18000.00,
    "total_charges": 175000.00,
    "transit_time": "24 days",
    "rank": 1,
    "is_active": true
  },
  "rankings": [
    { "supplier_id": "...", "carrier_name": "Maersk Line", "total_charges": 175000.00, "rank": 1 },
    { "supplier_id": "...", "carrier_name": "MSC", "total_charges": 182000.00, "rank": 2 }
  ],
  "extension": {
    "extended": true,
    "previous_close_time": "2026-10-31T15:00:00Z",
    "new_close_time": "2026-10-31T15:05:00Z",
    "extension_minutes": 5,
    "reason": "New lowest bidder (L1) achieved by Carrier Alpha in final 10 min window"
  }
}
```

### 6. Get RFQ Details (Leaderboard, Full Breakdown, Config & Audit Log)
```bash
curl -X GET "http://localhost:5000/rfqs/<RFQ_ID>" \
  -H "Authorization: Bearer <TOKEN>"
```

### 7. Award Contract to Winning Supplier (Buyer Only)
```bash
curl -X POST "http://localhost:5000/rfqs/<RFQ_ID>/award" \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "bid_id": "<WINNING_BID_ID>"
  }'
```

```
- Swagger API Docs: `http://localhost:5000/docs`
- ReDoc Docs: `http://localhost:5000/redoc`
