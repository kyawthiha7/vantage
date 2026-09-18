from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from vantage.db import get_session
from vantage.models import Finding

router = APIRouter()


class FindingCreate(BaseModel):
    title: str
    severity: str
    host: str = ""
    port: str | None = None
    description: str = ""
    evidence: str = ""
    mission_id: int | None = None


class FindingUpdate(BaseModel):
    status: str | None = None
    description: str | None = None
    evidence: str | None = None


@router.get("/findings")
def list_findings(session: Session = Depends(get_session)) -> list[dict]:
    findings = session.exec(select(Finding).order_by(Finding.created_at.desc())).all()  # type: ignore[arg-type]
    return [f.model_dump() for f in findings]


@router.post("/findings", status_code=201)
def create_finding(
    body: FindingCreate,
    session: Session = Depends(get_session),
) -> dict:
    f = Finding(**body.model_dump())
    session.add(f)
    session.commit()
    session.refresh(f)
    return f.model_dump()


@router.patch("/findings/{finding_id}")
def update_finding(
    finding_id: int,
    body: FindingUpdate,
    session: Session = Depends(get_session),
) -> dict:
    f = session.get(Finding, finding_id)
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    session.add(f)
    session.commit()
    session.refresh(f)
    return f.model_dump()


@router.delete("/findings/{finding_id}", status_code=204)
def delete_finding(finding_id: int, session: Session = Depends(get_session)) -> None:
    f = session.get(Finding, finding_id)
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    session.delete(f)
    session.commit()
