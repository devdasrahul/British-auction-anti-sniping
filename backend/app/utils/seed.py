import asyncio
import uuid
from datetime import datetime, timedelta, date, timezone
from decimal import Decimal
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.rfq import RFQ, RFQStatus, RFQSupplier, InviteStatus
from app.models.auction_config import AuctionConfig, TriggerType
from app.models.bid import Bid
from app.models.activity_log import AuctionActivityLog, ActivityEventType
from app.services.ranking_service import recompute_ranks


async def seed_database():
    print("[INFO] Initializing schema and seeding database...")
    await init_db()

    async with AsyncSessionLocal() as session:
        # 1. Create or fetch Buyer
        stmt_buyer = select(User).where(User.email == "buyer@gocomet.com")
        res_buyer = await session.execute(stmt_buyer)
        buyer = res_buyer.scalar_one_or_none()

        if not buyer:
            buyer = User(
                name="Alice Shipper (Buyer)",
                email="buyer@gocomet.com",
                role=UserRole.BUYER,
                password_hash=get_password_hash("password123"),
            )
            session.add(buyer)
            await session.flush()
            print("  [+] Created Buyer: buyer@gocomet.com")

        # 2. Create or fetch Suppliers
        suppliers_data = [
            ("FedEx Logistics", "supplier1@gocomet.com"),
            ("DHL Express", "supplier2@gocomet.com"),
            ("Blue Dart Cargo", "supplier3@gocomet.com"),
        ]
        suppliers = []
        for name, email in suppliers_data:
            stmt = select(User).where(User.email == email)
            res = await session.execute(stmt)
            sup = res.scalar_one_or_none()
            if not sup:
                sup = User(
                    name=name,
                    email=email,
                    role=UserRole.SUPPLIER,
                    password_hash=get_password_hash("password123"),
                )
                session.add(sup)
                await session.flush()
                print(f"  [+] Created Supplier: {email}")
            suppliers.append(sup)

        # 3. Create Demo Active British Auction RFQ
        ref_id = "RFQ-DEMO-PY-001"
        stmt_rfq = select(RFQ).where(RFQ.reference_id == ref_id)
        res_rfq = await session.execute(stmt_rfq)
        existing_rfq = res_rfq.scalar_one_or_none()

        if not existing_rfq:
            now = datetime.now(timezone.utc)
            start_time = now - timedelta(hours=1)
            close_time = now + timedelta(minutes=25)     # Active, expiring in 25 min
            forced_time = now + timedelta(hours=2)      # Hard cap in 2 hours

            demo_rfq = RFQ(
                name="Mumbai to Delhi Ocean Freight - Q4",
                reference_id=ref_id,
                created_by=buyer.id,
                bid_start_time=start_time,
                bid_close_time=close_time,
                forced_close_time=forced_time,
                pickup_service_date=date.today() + timedelta(days=7),
                is_british_auction=True,
                status=RFQStatus.ACTIVE,
            )
            session.add(demo_rfq)
            await session.flush()

            # Auction Config (10 min trigger window X, 5 min extension Y)
            config = AuctionConfig(
                rfq_id=demo_rfq.id,
                trigger_window_minutes=10,
                extension_duration_minutes=5,
                trigger_type=TriggerType.L1_RANK_CHANGE,
            )
            session.add(config)

            # Invite all 3 suppliers
            for s in suppliers:
                session.add(
                    RFQSupplier(
                        rfq_id=demo_rfq.id,
                        supplier_id=s.id,
                        invite_status=InviteStatus.ACCEPTED,
                    )
                )

            # Initial seed bid from Supplier 2
            initial_bid = Bid(
                rfq_id=demo_rfq.id,
                supplier_id=suppliers[1].id,
                carrier_name="DHL Express",
                freight_charges=Decimal("45000.00"),
                origin_charges=Decimal("2000.00"),
                destination_charges=Decimal("3000.00"),
                total_charges=Decimal("50000.00"),
                transit_time="3-4 days",
                quote_validity=date.today() + timedelta(days=30),
                is_active=True,
                rank=1,
            )
            session.add(initial_bid)
            await session.flush()

            log = AuctionActivityLog(
                rfq_id=demo_rfq.id,
                event_type=ActivityEventType.BID_SUBMITTED,
                description=f"Initial quote of Rs. 50,000 placed by DHL Express (Rank: L1)",
                triggered_by_bid_id=initial_bid.id,
            )
            session.add(log)

            print(f"  [+] Created Demo British Auction RFQ: {ref_id}")

        await session.commit()
        print("\n[SUCCESS] Database successfully seeded!")
        print("  Test Credentials:")
        print("    Buyer:     buyer@gocomet.com     / password123")
        print("    Supplier1: supplier1@gocomet.com / password123")
        print("    Supplier2: supplier2@gocomet.com / password123")
        print("    Supplier3: supplier3@gocomet.com / password123\n")


if __name__ == "__main__":
    asyncio.run(seed_database())

