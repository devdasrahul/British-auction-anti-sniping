import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.core.database import engine, Base, init_db
from app.api import api_v1_router
from app.api.v1.rfqs import router as direct_rfqs_router
from app.api.v1.auth import router as direct_auth_router
from app.services.scheduler_service import update_auction_statuses

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rfq_auction")

# Background scheduler for auction lifecycle
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database schema (with auto-fallback to SQLite if Postgres auth fails)
    logger.info("Initializing database schema...")
    await init_db()

    # Start auction lifecycle scheduler (polling every 15 seconds)
    scheduler.add_job(
        update_auction_statuses,
        "interval",
        seconds=15,
        id="auction_status_updater",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("⏰ Background auction lifecycle scheduler started (runs every 15s)")

    yield

    # Shutdown
    logger.info("Shutting down background scheduler...")
    scheduler.shutdown()
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="British Auction in an RFQ System - Pure Python FastAPI Backend",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes under /api
app.include_router(api_v1_router, prefix=settings.API_V1_STR)

# Also mount /rfqs and /auth directly so endpoints like POST /rfqs work without /api prefix
app.include_router(direct_rfqs_router)
app.include_router(direct_auth_router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "project": settings.PROJECT_NAME}


# Serve built React SPA when available
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
