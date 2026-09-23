from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, engine
from app.models.project import Project
from app.models.document import ProjectDocument
from app.models.user import User
from app.models.workflow import ProjectWorkflowEvent
from app.models.parcel import Parcel
from app.models.possession import ParcelProgressEvent
from app.models.rr import RRHousehold
from app.models.compensation import CompensationEstimate
from app.models.acquisition import AcquisitionNotification, NotificationParcel, AcquisitionAward
from app.models.operations import CompensationPayment, ProjectMilestone, RRProgressEvent
from app.routers.projects import router as projects_router
from app.routers.auth import router as auth_router
from app.routers.workflow import router as workflow_router


@asynccontextmanager
async def lifespan(app: FastAPI):

    with engine.begin() as connection:
        connection.execute(
            text("CREATE EXTENSION IF NOT EXISTS postgis")
        )

    Base.metadata.create_all(bind=engine)

    # SQLAlchemy create_all does not add columns to an existing database.
    # Keep the supplied prototype upgradeable without deleting its volume.
    migration = Path(__file__).resolve().parents[1] / "migrations" / "002_operational_scope.sql"
    with engine.begin() as connection:
        for statement in migration.read_text(encoding="utf-8").split(";"):
            if statement.strip():
                connection.exec_driver_sql(statement)

    yield

    engine.dispose()


app = FastAPI(
    title="NLAM DSS API",
    description=(
        "National Land Acquisition and Management "
        "Decision Support System"
    ),
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


from app.routers.parcels import router as parcels_router

app.include_router(projects_router)
app.include_router(auth_router)
app.include_router(workflow_router)
from app.routers.documents import router as documents_router

from app.routers.compensation import router as compensation_router

from app.routers.rr import router as rr_router

from app.routers.possession import router as possession_router

from app.routers.mis import router as mis_router
from app.routers.acquisition import router as acquisition_router
from app.routers.operations import router as operations_router
from app.routers.admin import router as admin_router
from app.routers.integrations import router as integrations_router

app.include_router(parcels_router)
app.include_router(mis_router)
app.include_router(possession_router)
app.include_router(rr_router)
app.include_router(compensation_router)
app.include_router(documents_router)
app.include_router(acquisition_router)
app.include_router(operations_router)
app.include_router(admin_router)
app.include_router(integrations_router)


@app.get("/")
def root():

    return {
        "application": "NLAM DSS",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
def health():

    with engine.connect() as connection:

        connection.execute(text("SELECT 1"))

        postgis_version = connection.execute(
            text("SELECT PostGIS_Version()")
        ).scalar_one()

    return {
        "status": "healthy",
        "database": "connected",
        "postgis": postgis_version,
    }
