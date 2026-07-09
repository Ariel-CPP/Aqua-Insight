from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from datetime import datetime
import os

# --- Setup Database (SQLite) ---
DB_DIR = os.path.dirname(os.path.abspath(__file__))
SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(DB_DIR, 'aquainsight.db')}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ProjectData(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    data_payload = Column(Text) # JSON string of the project data

Base.metadata.create_all(bind=engine)

# --- FastAPI App ---
app = FastAPI(title="Aqua Insight Backend API", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change to specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Aqua Insight API Server is running."}

@app.post("/api/sync")
def sync_project(payload: dict, db: Session = Depends(get_db)):
    """Save project state from frontend to DB."""
    import json
    new_project = ProjectData(
        project_name=payload.get("appName", "Unknown Project"),
        data_payload=json.dumps(payload)
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return {"status": "success", "project_id": new_project.id}

@app.get("/api/sync/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Retrieve project state by ID."""
    import json
    project = db.query(ProjectData).filter(ProjectData.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project_id": project.id, "data": json.loads(project.data_payload)}
