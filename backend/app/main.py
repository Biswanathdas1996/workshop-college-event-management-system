from functools import lru_cache
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, List
from bson import ObjectId

from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
from pydantic import BaseModel, Field

# find_dotenv walks up from CWD (backend/) and from __file__ location to find .env
_env_file = find_dotenv(usecwd=True) or str(Path(__file__).resolve().parents[2] / '.env')
load_dotenv(_env_file, override=True)

frontend_port = os.getenv('FRONTEND_PORT', '5173')
backend_port = os.getenv('BACKEND_PORT', '8000')

app = FastAPI(title='College Event Management API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f'http://localhost:{frontend_port}', f'http://127.0.0.1:{frontend_port}'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    mongodb_uri = os.getenv('MONGODB_URI')
    if not mongodb_uri:
        raise RuntimeError('MONGODB_URI is not configured.')
    return MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)


def get_db():
    client = get_mongo_client()
    return client.get_default_database()


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return {}
    doc['id'] = str(doc.pop('_id'))
    return doc


# ── Pydantic Models ────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    title: str
    description: str
    category: str
    date: str          # ISO string e.g. "2026-06-15"
    time: str          # e.g. "14:00"
    venue: str
    capacity: int
    image_url: Optional[str] = None
    organizer: str
    tags: List[str] = []
    registration_fee: float = 0.0
    status: str = 'upcoming'   # upcoming | ongoing | completed | cancelled


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    venue: Optional[str] = None
    capacity: Optional[int] = None
    image_url: Optional[str] = None
    organizer: Optional[str] = None
    tags: Optional[List[str]] = None
    registration_fee: Optional[float] = None
    status: Optional[str] = None


class RegistrationCreate(BaseModel):
    event_id: str
    student_name: str
    student_email: str
    student_id: str
    department: str
    year: str
    phone: Optional[str] = None


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get('/api/health')
def health_check() -> dict:
    backend_status = 'connected'
    database_status = 'disconnected'
    database_name = None
    try:
        client = get_mongo_client()
        client.admin.command('ping')
        db = client.get_default_database()
        database_name = db.name if db is not None else None
        database_status = 'connected'
    except (PyMongoError, RuntimeError):
        database_status = 'disconnected'
    return {
        'frontend': 'active',
        'backend': backend_status,
        'database': database_status,
        'databaseName': database_name,
        'backendPort': backend_port,
    }


# ── Events ─────────────────────────────────────────────────────────────────────

@app.get('/api/events')
def list_events(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query('date_asc'),
):
    db = get_db()
    query: dict = {}
    if category:
        query['category'] = category
    if status:
        query['status'] = status
    if search:
        query['$or'] = [
            {'title': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}},
            {'organizer': {'$regex': search, '$options': 'i'}},
        ]
    sort_map = {
        'date_asc': [('date', ASCENDING)],
        'date_desc': [('date', DESCENDING)],
        'title_asc': [('title', ASCENDING)],
    }
    sort_order = sort_map.get(sort, [('date', ASCENDING)])
    events = list(db.events.find(query).sort(sort_order))
    return [serialize_doc(e) for e in events]


@app.post('/api/events', status_code=201)
def create_event(payload: EventCreate):
    db = get_db()
    doc = payload.model_dump()
    doc['created_at'] = datetime.utcnow().isoformat()
    doc['registered_count'] = 0
    result = db.events.insert_one(doc)
    created = db.events.find_one({'_id': result.inserted_id})
    return serialize_doc(created)


@app.get('/api/events/{event_id}')
def get_event(event_id: str):
    db = get_db()
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid event id')
    event = db.events.find_one({'_id': oid})
    if not event:
        raise HTTPException(status_code=404, detail='Event not found')
    return serialize_doc(event)


@app.put('/api/events/{event_id}')
def update_event(event_id: str, payload: EventUpdate):
    db = get_db()
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid event id')
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    result = db.events.update_one({'_id': oid}, {'$set': updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Event not found')
    updated = db.events.find_one({'_id': oid})
    return serialize_doc(updated)


@app.delete('/api/events/{event_id}', status_code=204)
def delete_event(event_id: str):
    db = get_db()
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid event id')
    result = db.events.delete_one({'_id': oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Event not found')
    # Also delete registrations
    db.registrations.delete_many({'event_id': event_id})


# ── Registrations ──────────────────────────────────────────────────────────────

@app.get('/api/registrations')
def list_registrations(event_id: Optional[str] = Query(None)):
    db = get_db()
    query = {}
    if event_id:
        query['event_id'] = event_id
    regs = list(db.registrations.find(query).sort('created_at', DESCENDING))
    return [serialize_doc(r) for r in regs]


@app.post('/api/registrations', status_code=201)
def register_for_event(payload: RegistrationCreate):
    db = get_db()
    # Check duplicate
    existing = db.registrations.find_one({
        'event_id': payload.event_id,
        'student_email': payload.student_email,
    })
    if existing:
        raise HTTPException(status_code=409, detail='Already registered for this event')
    # Check capacity
    try:
        oid = ObjectId(payload.event_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid event id')
    event = db.events.find_one({'_id': oid})
    if not event:
        raise HTTPException(status_code=404, detail='Event not found')
    if event.get('registered_count', 0) >= event.get('capacity', 0):
        raise HTTPException(status_code=400, detail='Event is at full capacity')
    doc = payload.model_dump()
    doc['created_at'] = datetime.utcnow().isoformat()
    doc['status'] = 'confirmed'
    result = db.registrations.insert_one(doc)
    # Increment count
    db.events.update_one({'_id': oid}, {'$inc': {'registered_count': 1}})
    created = db.registrations.find_one({'_id': result.inserted_id})
    return serialize_doc(created)


@app.delete('/api/registrations/{reg_id}', status_code=204)
def cancel_registration(reg_id: str):
    db = get_db()
    try:
        oid = ObjectId(reg_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid registration id')
    reg = db.registrations.find_one({'_id': oid})
    if not reg:
        raise HTTPException(status_code=404, detail='Registration not found')
    db.registrations.delete_one({'_id': oid})
    # Decrement count
    try:
        event_oid = ObjectId(reg['event_id'])
        db.events.update_one({'_id': event_oid}, {'$inc': {'registered_count': -1}})
    except Exception:
        pass


# ── Stats ──────────────────────────────────────────────────────────────────────

@app.get('/api/stats')
def get_stats():
    db = get_db()
    total_events = db.events.count_documents({})
    upcoming = db.events.count_documents({'status': 'upcoming'})
    ongoing = db.events.count_documents({'status': 'ongoing'})
    completed = db.events.count_documents({'status': 'completed'})
    total_registrations = db.registrations.count_documents({})
    categories = db.events.distinct('category')
    return {
        'total_events': total_events,
        'upcoming': upcoming,
        'ongoing': ongoing,
        'completed': completed,
        'total_registrations': total_registrations,
        'categories': categories,
    }
