"""Configured, read-only land-record adapter. No government endpoint is assumed."""
import os
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.core.project_access_dependency import get_accessible_project
from app.models.project import Project

router = APIRouter(prefix="/api/v1/integrations", tags=["Land record interoperability"],
                   dependencies=[Depends(get_current_user)])


def configured_url() -> str | None:
    url = os.environ.get("LAND_RECORDS_API_URL", "").strip()
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise HTTPException(503, "Configured land-record endpoint must be an HTTPS URL.")
    return url


@router.get("/land-records/status")
def status():
    return {"mode": "configured" if os.environ.get("LAND_RECORDS_API_URL", "").strip()
            else "unconfigured", "read_only": True,
            "message": "State-specific endpoint and authorization must be supplied by its owner."}


@router.get("/projects/{project_id}/land-records/lookup")
def lookup(project_id: int, village: str = Query(min_length=2, max_length=100),
           survey_number: str = Query(min_length=1, max_length=100),
           project: Project = Depends(get_accessible_project)):
    url = configured_url()
    if not url:
        raise HTTPException(503, "Land-record lookup is not configured for this installation.")
    token = os.environ.get("LAND_RECORDS_API_TOKEN", "")
    try:
        with httpx.Client(timeout=8, follow_redirects=False) as client:
            response = client.get(url, params={"state": project.state,
                "district": project.district, "village": village,
                "survey_number": survey_number},
                headers={"Authorization": f"Bearer {token}"} if token else {})
            response.raise_for_status()
            if len(response.content) > 1_000_000:
                raise HTTPException(502, "Land-record response exceeds the supported size.")
            body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Land-record service is unavailable or returned invalid JSON.") from exc
    if not isinstance(body, dict):
        raise HTTPException(502, "Land-record service returned an unexpected response.")
    # Response mapping is a contract for a project-specific adapter. Never
    # persist unauthenticated external responses into authoritative tables.
    return {"source": "configured external service", "verified": False,
            "record": {k: body.get(k) for k in ("survey_number", "village",
              "land_type", "area_ha", "record_reference") if k in body},
            "geometry": body.get("geometry") if isinstance(body.get("geometry"), dict) else None}
