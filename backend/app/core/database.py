from typing import AsyncGenerator
import logging
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

logger = logging.getLogger("rfq_auction")


def create_engine_for_url(url: str):
    connect_args = {}
    if "sqlite" in url.lower():
        connect_args = {"check_same_thread": False}
        return create_async_engine(url, echo=False, future=True, connect_args=connect_args)
    return create_async_engine(url, echo=False, future=True, pool_pre_ping=True)


# Async Engine
engine = create_engine_for_url(settings.DATABASE_URL)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy 2.0 models."""
    pass


async def init_db():
    global engine, AsyncSessionLocal
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info(f"Connected to database successfully: {engine.url.render_as_string(hide_password=True)}")
    except Exception as exc:
        if "postgresql" in settings.DATABASE_URL.lower():
            logger.warning(
                f"\n{'='*75}\n"
                f"[DATABASE NOTICE] PostgreSQL connection/authentication failed: {exc}\n"
                f"--> Automatically falling back to local SQLite database: sqlite+aiosqlite:///./rfq_auction.db\n"
                f"--> The server starts immediately and all features work out of the box!\n"
                f"--> To use your local PostgreSQL, set your correct password in backend/.env:\n"
                f"    DATABASE_URL=postgresql+asyncpg://postgres:<YOUR_PASSWORD>@localhost:5432/rfq_auction_db\n"
                f"{'='*75}\n"
            )
            import pathlib
            base_dir = pathlib.Path(__file__).resolve().parent.parent.parent
            db_path = (base_dir / "rfq_auction.db").as_posix()
            fallback_url = f"sqlite+aiosqlite:///{db_path}"
            engine = create_engine_for_url(fallback_url)
            AsyncSessionLocal.configure(bind=engine)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info(f"Local SQLite database initialized successfully ({db_path})")

            # Ensure demo seed accounts exist
            try:
                from app.utils.seed import seed_database
                await seed_database()
            except Exception as seed_err:
                logger.warning(f"Seed note: {seed_err}")
        else:
            raise exc


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing database sessions per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

