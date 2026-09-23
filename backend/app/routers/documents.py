import os
from datetime import datetime
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from fastapi.responses import FileResponse

from pydantic import BaseModel, ConfigDict

from sqlalchemy import select

from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_user,
    require_roles,
)

from app.database import get_db

from app.models.document import ProjectDocument
from app.models.project import Project
from app.models.user import User


router = APIRouter(
    prefix="/api/v1/projects",
    tags=["Project Documents"],
    dependencies=[Depends(get_current_user)],
)

STORAGE_DIR = Path(
    os.environ.get(
        "DOCUMENT_STORAGE_PATH",
        "/app/uploads",
    )
)

MAX_FILE_BYTES = 10 * 1024 * 1024
CHUNK_BYTES = 1024 * 1024

DocumentType = Literal[
    "PROPOSAL",
    "LAND_RECORD",
    "SURVEY_MAP",
    "CONSENT",
    "OTHER",
]


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    document_type: str
    original_filename: str
    content_type: str
    size_bytes: int
    notes: str | None
    uploaded_by_username: str
    uploaded_at: datetime


def require_project(
    db: Session,
    project_id: int,
) -> None:
    if db.get(Project, project_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Project not found.",
        )


def checked_filename(filename: str | None) -> tuple[str, str]:
    if not filename:
        raise HTTPException(
            status_code=422,
            detail="A filename is required.",
        )

    # Treat both Windows and Unix separators as path separators.
    name = filename.replace("\\", "/").split("/")[-1].strip()

    if (
        not name
        or len(name) > 180
        or any(ord(character) < 32 for character in name)
    ):
        raise HTTPException(
            status_code=422,
            detail="Invalid document filename.",
        )

    extension = Path(name).suffix.lower()

    if extension not in {".pdf", ".png", ".jpg", ".jpeg"}:
        raise HTTPException(
            status_code=422,
            detail="Only PDF, PNG, and JPEG documents are supported.",
        )

    return name, extension


def verified_content_type(
    extension: str,
    prefix: bytes,
) -> str:
    if extension == ".pdf" and prefix.startswith(b"%PDF-"):
        return "application/pdf"

    if (
        extension == ".png"
        and prefix.startswith(b"\x89PNG\r\n\x1a\n")
    ):
        return "image/png"

    if (
        extension in {".jpg", ".jpeg"}
        and prefix.startswith(b"\xff\xd8\xff")
    ):
        return "image/jpeg"

    raise HTTPException(
        status_code=422,
        detail="The file content does not match its extension.",
    )


@router.get(
    "/{project_id}/documents",
    response_model=list[DocumentResponse],
)
def list_documents(
    project_id: int,
    db: Session = Depends(get_db),
):
    require_project(db, project_id)

    return db.execute(
        select(ProjectDocument)
        .where(ProjectDocument.project_id == project_id)
        .order_by(ProjectDocument.id.desc())
    ).scalars().all()


@router.post(
    "/{project_id}/documents",
    response_model=DocumentResponse,
    status_code=201,
)
async def upload_document(
    project_id: int,
    document_type: DocumentType = Form(...),
    notes: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("PROJECT_OFFICER")),
):
    require_project(db, project_id)

    if len(notes) > 500:
        raise HTTPException(
            status_code=422,
            detail="Notes must contain no more than 500 characters.",
        )

    original_name, extension = checked_filename(file.filename)

    STORAGE_DIR.mkdir(
        parents=True,
        exist_ok=True,
        mode=0o700,
    )

    identifier = uuid4().hex
    stored_name = f"{identifier}{extension}"
    temporary_path = STORAGE_DIR / f"{identifier}.uploading"
    final_path = STORAGE_DIR / stored_name

    total_bytes = 0
    prefix = b""

    try:
        with temporary_path.open("xb") as destination:
            while True:
                chunk = await file.read(CHUNK_BYTES)

                if not chunk:
                    break

                total_bytes += len(chunk)

                if total_bytes > MAX_FILE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="The maximum file size is 10 MB.",
                    )

                if len(prefix) < 8:
                    prefix = (prefix + chunk)[:8]

                destination.write(chunk)

        if total_bytes == 0:
            raise HTTPException(
                status_code=422,
                detail="Empty files cannot be uploaded.",
            )

        content_type = verified_content_type(
            extension,
            prefix,
        )

        temporary_path.replace(final_path)

        document = ProjectDocument(
            project_id=project_id,
            document_type=document_type,
            original_filename=original_name,
            stored_filename=stored_name,
            content_type=content_type,
            size_bytes=total_bytes,
            notes=notes.strip() or None,
            uploaded_by_username=actor.username,
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return document

    except Exception:
        db.rollback()
        temporary_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()


@router.get(
    "/{project_id}/documents/{document_id}/download",
)
def download_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db),
):
    require_project(db, project_id)

    document = db.execute(
        select(ProjectDocument).where(
            ProjectDocument.id == document_id,
            ProjectDocument.project_id == project_id,
        )
    ).scalar_one_or_none()

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    path = STORAGE_DIR / document.stored_filename

    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="The stored document is unavailable.",
        )

    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=document.original_filename,
        content_disposition_type="attachment",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )