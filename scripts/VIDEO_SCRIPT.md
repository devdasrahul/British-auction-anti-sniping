# Full Video Script: British Auction RFQ System
**Target Duration:** 7 to 8 minutes  
**Format:** YouTube Portfolio Project Walkthrough / Interview Presentation  
**Pacing:** ~135 words per minute, clear, conversational, confident.

---

### [0:00 – 0:35] 1. Introduction

**[camera on me]**  
"Hi everyone! Welcome back. Today, I’m excited to walk you through a project I recently engineered from the ground up: the **British Auction RFQ System**.

**[show screen: Live Auction Dashboard with active countdown timer]**  
At its core, this is a full-stack B2B logistics platform where enterprise buyers post freight shipping contracts, and global carriers compete in real time to offer the lowest rate. 

What makes this project truly special is its **intelligent, anti-sniping extension engine**—a dynamic auction mechanism that ensures fair price discovery and eliminates last-second bot bidding. 

Let’s break down the problem, the architecture, and how I built it."

---

### [0:35 – 1:25] 2. Problem Statement

**[camera on me]**  
"Let’s start with why this system is needed in the real world.

In commercial logistics, when a manufacturing company needs to move cargo—say, 50 shipping containers from Mumbai to Rotterdam—they publish a Request for Quotation, or RFQ. 

Traditionally, buyers run these as timed auctions with a fixed deadline. For instance, the auction closes at 5:00:00 PM sharp.

**[pause]**  
Here’s the fatal flaw: **Bid Sniping**.

Opportunistic bidders or automated bots intentionally wait until 4:59:58 PM—two seconds before the cutoff—to place a quote that's just five dollars cheaper. 

The honest carriers don’t have time to see the quote, verify their operational capacity, or place a counter-offer. 

The result? The buyer loses out on deeper cost savings, and carriers feel cheated by an unfair, gameable system. Fixed deadlines simply do not work for high-value procurement."

---

### [1:25 – 2:20] 3. What is a British Auction in This Project?

**[show screen: Graphic diagram explaining Reverse Auction + British Mechanics]**  
"That’s where the **British Auction** mechanism comes in. 

First, this is a **Reverse Auction**. Unlike consumer auctions like eBay where bids go *up* and the highest bidder wins, here carriers bid *down* to win the business. The lowest price wins, which we designate as **Rank L1**.

Second, it is an **Open Auction**. All invited suppliers can see their live rank—L1, L2, L3—and the current lowest price in real time.

**[camera on me]**  
And third—the differentiator—is the **Dynamic Time Extension with a Forced Close Cap**:
- If someone submits a competitive quote right near the deadline, the clock automatically adds extra minutes.
- This gives everyone a fair opportunity to counter.
- But to prevent an endless bidding war that drags on forever, the buyer specifies a **Forced Close Time**—a hard deadline that the auction can never exceed under any circumstances."

---

### [2:20 – 3:20] 4. Key Features

**[show screen: Quick montage of UI screens: RFQ creation, live bidding room, quote breakdown]**  
"Here are the core features built into the system:

1. **Buyer RFQ Creation:** Buyers create freight RFQs specifying routes, pickup dates, and auction parameters with strict server-side timestamp validation.
2. **Reverse Bidding:** Suppliers break down their quotes into freight charges, origin handling, and destination charges. Re-bids are strictly validated—suppliers can only submit if their new total is lower than their previous active quote.
3. **Live Ranking:** Real-time leaderboard with atomic dense ranking: L1, L2, L3, with tie-breaking based on submission timestamps.
4. **Intelligent Extension Engine:** Automatically evaluates competitive triggers and extends the rolling deadline.
5. **Immutable Audit Trail:** An append-only activity log that records every bid and time extension with detailed reasons.
6. **One-Click Awarding:** Once closed, buyers can award the freight contract directly to the winning carrier."

---

### [3:20 – 5:00] 5. How the Extension Engine Works (The Most Important Part)

**[camera on me]**  
"Now let's examine the heart of the project: the **Extension Engine**. 

**[show screen: Extension Engine Decision Flowchart]**  
Every time a supplier submits a quote, the backend evaluates the extension engine inside an atomic database transaction. Here is the step-by-step logic:

**Step 1: Check British Auction Mode**  
First, it verifies if British Auction mode is enabled for this RFQ. If false, it stops.

**Step 2: Check the Trigger Window (X minutes)**  
The buyer defines a trigger window, denoted as $X$ minutes—for example, 10 minutes. If the auction closes at 5:00 PM, the trigger window opens at 4:50 PM. 
If a carrier submits a quote at 4:30 PM, the bid is recorded, ranks are updated, but the clock does *not* extend. The engine only wakes up inside that final 10-minute window.

**[pause]**

**Step 3: Evaluate the Trigger Type**  
Inside the trigger window, the engine evaluates one of three configurable business rules:
- **Trigger Type 1: BID_RECEIVED** — Any valid bid placed in the window immediately triggers an extension.
- **Trigger Type 2: ANY_RANK_CHANGE** — Extends only if the new bid shifts *any* position on the leaderboard—for example, if a supplier moves from L4 up to L2.
- **Trigger Type 3: L1_RANK_CHANGE** — The strictest mode. It extends *only* if the new bid overtakes the lowest bidder and claims first place (L1).

**[show screen: Math Formula: new_close = min(bid_close + Y, forced_close)]**

**Step 4: Calculate Extension Duration (Y minutes)**  
If the trigger condition is met, the engine proposes adding $Y$ minutes—say, 5 minutes—to the rolling close time.

Here is the golden mathematical constraint:  
$$\text{New Close Time} = \min(\text{Current Close} + Y\text{ minutes},\; \text{Forced Close Time})$$

If adding 5 minutes would exceed the hard deadline, the engine clamps the extension right at the forced close time. And if the auction is already at the forced close time? It halts. Extensions are impossible.

**Step 5: Audit Logging**  
The rolling close time is updated in the database, and an event is written to `auction_activity_log` recording the previous time, new time, and the bid ID that caused it."

---

### [5:00 – 5:50] 6. Tech Stack

**[show screen: Architecture Stack Card: Python, FastAPI, SQLAlchemy 2.0, PostgreSQL, React, Vite]**  
"To build a system requiring strict data integrity and high concurrency, I chose:

- **Backend:** **Python** with **FastAPI**. FastAPI provides high-speed asynchronous request handling and automatically generates OpenAPI Swagger documentation.
- **ORM & Database:** **PostgreSQL 14+** paired with **SQLAlchemy 2.0** using the asynchronous `asyncpg` driver. This enables non-blocking database queries under heavy bidding traffic.
- **Data Validation:** **Pydantic v2**, enforcing business rules like `forced_close_time > bid_close_time` before requests reach database logic.
- **Authentication:** Stateless **JWT authentication** using `python-jose` and `passlib` with bcrypt, enforcing **BUYER** and **SUPPLIER** role-based access.
- **Migrations:** **Alembic** for version-controlled, reproducible schema migrations.
- **Frontend:** **React 18** with **Vite** and **TailwindCSS**, featuring responsive countdown timers and color-coded rank badges."

---

### [5:50 – 6:30] 7. System Architecture (Brief)

**[show screen: Full System Architecture Diagram]**  
"Here is how the system connects:

1. The React frontend communicates with the FastAPI backend over REST using Bearer JWT tokens.
2. Route-level dependency injection checks tokens and restricts buyer-only or supplier-only actions.
3. When a bid arrives, the database acquires a pessimistic row-level lock on the RFQ record using `SELECT ... FOR UPDATE`. This guarantees that simultaneous bids in the final seconds are processed sequentially without race conditions.
4. An APScheduler background task runs inside FastAPI’s lifespan, polling every 15 seconds to gracefully transition expired auctions to `CLOSED` or `FORCE_CLOSED`."

---

### [6:30 – 7:20] 8. Project Demo Flow

**[show screen: Split-screen UI demonstration]**  
"Now, let's watch the complete flow in action:

**[show screen: Buyer creating an RFQ]**  
1. **Creation:** Our Buyer logs in and creates an RFQ: *'Mundra to Rotterdam 40ft High Cube'*. They set the close time 5 minutes from now, a hard forced close time 20 minutes from now, and configure British Auction mode with $X = 5$ minutes, $Y = 3$ minutes, and trigger type `L1_RANK_CHANGE`.

**[show screen: Carrier 1 bidding]**  
2. **First Quote:** Carrier 1 logs in and submits a quote of ₹1,50,000. They immediately become **L1**.

**[show screen: Carrier 2 bidding with 2 minutes left]**  
3. **Competitive Bid:** With just 2 minutes remaining on the countdown timer—well inside our 5-minute trigger window—Carrier 2 submits ₹1,42,000.

**[pause]**  
**[show screen: Zoom in on the timer extending + toast notification]**  
4. **Auto-Extension:** Look at the clock! Because Carrier 2 took over L1 inside the trigger window, the engine instantly extends the auction by 3 minutes. The timer jumps forward.

**[show screen: Activity log feed]**  
5. **Audit Log:** Down in the activity log, an entry appears: *'Auction extended by 3 min. Reason: New lowest bidder (L1) achieved by Carrier 2.'*

Carrier 1 now has time to counter, the buyer gets a cheaper shipping rate, and sniping was completely prevented."

---

### [7:20 – 8:05] 9. What I Learned & Challenges Overcome

**[camera on me]**  
"Building this project pushed me across several key software engineering areas:

- **Concurrency & Race Conditions:** When multiple carriers submit quotes in the final seconds, naive updates cause race conditions and corrupted rankings. Implementing pessimistic row-level locking in SQLAlchemy ensured strict sequential consistency.
- **Timezone Drift:** When managing rolling timers and countdown clocks, timezone bugs are easy to introduce. I enforced UTC everywhere—from database timestamp columns to Pydantic validators.
- **Automated Testing:** I wrote an automated test suite with `pytest-asyncio` and `httpx` that verifies all edge cases: bids outside the window, ranking shifts, hard deadline caps, and role permissions."

---

### [8:05 – 8:40] 10. Conclusion

**[camera on me]**  
"Can this project be used as a portfolio project? **Absolutely.** It tackles a genuine enterprise problem in logistics, implements sophisticated game-theory mechanics, and demonstrates robust backend engineering principles.

The entire codebase is open-source and available on GitHub, complete with Alembic migrations, test suites, and seed data.

If you enjoyed this walkthrough or found it helpful, please give the video a thumbs up, star the GitHub repository linked below, and feel free to drop any questions in the comments. 

Thank you for watching!"

