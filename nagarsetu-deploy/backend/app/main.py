"""NagarSetu API (FastAPI). Thin wrapper around store.Store. Run: uvicorn app.main:app"""
import asyncio
import json
import os
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import ai
from .store import ApiError, Store, parse_id

DB_PATH = os.getenv('NAGARSETU_DB', 'data/nagarsetu.db')
FRONTEND = Path(os.getenv('FRONTEND_DIR', Path(__file__).resolve().parents[2]))
store = Store(DB_PATH, os.getenv('SECRET_KEY') or None)
_new = store.seed(os.getenv('ADMIN_PASSWORD'), os.getenv('STAFF_PASSWORD'))
if _new:
    print('NagarSetu: accounts created. Save these passwords now, they are not shown again:')
    for _k, _v in _new.items():
        print(f'  {_k}: {_v}')


def dispatch():
    """Send queued escalation messages to NOTIFY_WEBHOOK_URL (Slack, WhatsApp/SMS gateway, n8n, etc)."""
    url = os.getenv('NOTIFY_WEBHOOK_URL')
    if not url:
        return
    for o in store.pending_outbox():
        req = urllib.request.Request(url, data=json.dumps({'text': o['msg'], 'ticket': o['seq'], 'level': o['level']}).encode(),
                                     headers={'Content-Type': 'application/json'})
        if os.getenv('NOTIFY_WEBHOOK_TOKEN'):
            req.add_header('Authorization', 'Bearer ' + os.environ['NOTIFY_WEBHOOK_TOKEN'])
        try:
            urllib.request.urlopen(req, timeout=5).read()
            store.mark_outbox(o['id'], True)
        except Exception as e:
            print('notify failed:', e)
            store.mark_outbox(o['id'], False)


@asynccontextmanager
async def lifespan(_app):
    async def loop():
        while True:
            await asyncio.sleep(30)
            try:
                await asyncio.to_thread(store.run_escalations)
                await asyncio.to_thread(dispatch)
            except Exception as e:  # keep the worker alive
                print('escalation worker error:', e)
    task = asyncio.create_task(loop())
    yield
    task.cancel()


app = FastAPI(title='NagarSetu API', lifespan=lifespan)
if os.getenv('CORS_ORIGINS'):
    app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in os.environ['CORS_ORIGINS'].split(',')],
                       allow_methods=['*'], allow_headers=['*'])


@app.middleware('http')
async def headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    resp.headers['Permissions-Policy'] = 'geolocation=(self)'
    return resp


@app.exception_handler(ApiError)
async def api_error(_r, e: ApiError):
    return JSONResponse({'detail': e.detail}, status_code=e.status)


def current(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith('bearer '):
        raise ApiError(401, 'Sign in first.')
    return store.verify(authorization[7:])


class Register(BaseModel):
    name: str
    mobile: str
    password: str


class Login(BaseModel):
    role: str
    identifier: str
    password: str


class Pin(BaseModel):
    lat: float
    lng: float


class TicketIn(BaseModel):
    key: str
    cat: str
    desc: str
    land: str = ''
    pin: Pin | None = None
    photos: list[str] = []
    consent: bool = False


class StatusIn(BaseModel):
    to: str
    pub: str | None = None


class NoteIn(BaseModel):
    text: str


class AssignIn(BaseModel):
    staff: str


class ReopenIn(BaseModel):
    reason: str = ''


class CfgIn(BaseModel):
    team: str
    sla_hours: float


@app.get('/api/health')
def health():
    return {'ok': True, 'audit_chain_ok': store.verify_audit(), 'notify_pending': len(store.pending_outbox(1000)), 'ai_assign': ai.enabled()}


@app.post('/api/auth/register')
def register(b: Register):
    return store.register(b.name, b.mobile, b.password)


@app.post('/api/auth/login')
def login(b: Login):
    return store.login(b.role, b.identifier, b.password)


@app.get('/api/me')
def me(user=Depends(current)):
    return {'user': user}


@app.get('/api/sync')
def sync(user=Depends(current)):
    return store.sync(user)


@app.get('/api/queue')
def queue(user=Depends(current)):
    if user['role'] not in ('staff', 'admin'):
        raise ApiError(403, 'resident cannot call queue')
    return store.sync(user)['tickets']


def ai_assign(ticket_id):
    """Runs after the response is sent. Any failure leaves the normal least-busy assignment in place."""
    try:
        seq = parse_id(ticket_id)
        c = store.ai_candidates(seq)
        res = ai.pick(c['ticket'], c['staff']) if c else None
        if res:
            store.ai_apply(seq, c['current'], res[0], res[1])
    except Exception:
        pass


@app.post('/api/tickets')
def create(b: TicketIn, bg: BackgroundTasks, user=Depends(current)):
    t = store.create_ticket(user, b.model_dump())
    if ai.enabled():
        bg.add_task(ai_assign, t['id'])
    return t


@app.get('/api/tickets/track/{ticket}')
def track(ticket: str, request: Request):
    store.limit('track:' + (request.client.host if request.client else '?'), 120, 60)
    return store.track(ticket)


@app.get('/api/tickets/{ticket}/photos')
def photos(ticket: str, user=Depends(current)):
    return store.photos(user, ticket)


@app.post('/api/tickets/{ticket}/follow')
def follow(ticket: str, user=Depends(current)):
    return store.follow(user, ticket)


@app.patch('/api/tickets/{ticket}/status')
def status(ticket: str, b: StatusIn, user=Depends(current)):
    return store.change_status(user, ticket, b.to, b.pub)


@app.post('/api/tickets/{ticket}/notes')
def note(ticket: str, b: NoteIn, user=Depends(current)):
    return store.add_note(user, ticket, b.text)


@app.post('/api/tickets/{ticket}/reopen')
def reopen(ticket: str, b: ReopenIn, user=Depends(current)):
    return store.reopen(user, ticket, b.reason)


@app.get('/api/analytics')
def analytics():
    return store.analytics()


@app.get('/api/audit/head')
def audit_head():
    return store.audit_head()


@app.patch('/api/tickets/{ticket}/assign')
def assign(ticket: str, b: AssignIn, user=Depends(current)):
    return store.reassign(user, ticket, b.staff)


@app.put('/api/config/{cat}')
def config(cat: str, b: CfgIn, user=Depends(current)):
    return store.set_config(user, cat, b.team, b.sla_hours)


# ---- front end (only these paths are served, never the backend folder) ----
@app.get('/config.js')
def config_js():
    key = os.getenv('GOOGLE_MAPS_API_KEY', '').replace('"', '')
    return PlainTextResponse('window.NS_CONFIG={USE_API:true,API_BASE_URL:"",GOOGLE_MAPS_API_KEY:"%s"};' % key,
                             media_type='application/javascript')


@app.get('/favicon.svg')
def favicon():
    return FileResponse(FRONTEND / 'favicon.svg')


@app.get('/')
def index():
    return FileResponse(FRONTEND / 'index.html')


app.mount('/css', StaticFiles(directory=FRONTEND / 'css'), name='css')
app.mount('/js', StaticFiles(directory=FRONTEND / 'js'), name='js')
