from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.rfqs import router as rfqs_router

api_v1_router = APIRouter()
api_v1_router.include_router(auth_router)
api_v1_router.include_router(rfqs_router)

