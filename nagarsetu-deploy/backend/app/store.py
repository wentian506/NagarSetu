"""NagarSetu service layer.

All business rules live here and use only the Python standard library plus PyJWT, so they can be
unit-tested without a web server. main.py is a thin FastAPI wrapper around this class.
Times are stored as Unix seconds (UTC) and shown to users in India Standard Time by the front end.
"""
import base64
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone

import jwt

BOUNDS = (30.66, 30.80, 76.68, 76.86)  # south, north, west, east: Chandigarh demo area
IST = timezone(timedelta(hours=5, minutes=30))
LBL = {'received': 'Received', 'triaged': 'Triaged', 'assigned': 'Assigned', 'in_progress': 'In progress',
       'needs_info': 'Needs more information', 'resolved': 'Resolved'}
NEXT = {'received': ['triaged'], 'triaged': ['assigned'], 'assigned': ['in_progress', 'needs_info'],
        'in_progress': ['resolved', 'needs_info'], 'needs_info': ['in_progress'], 'resolved': []}
ESC = [(1.0, 'Reminder sent to the assigned staff member'), (1.25, 'Supervisor notified'),
       (1.5, 'Department head notified')]
# Prototype mapping. A department must verify these before real use.
DEFAULT_CFG = {'waste': ('Uncollected waste', 'Sanitation team', 24),
               'light': ('Broken streetlight', 'Electrical team', 48),
               'road': ('Pothole or road damage', 'Roads team', 72)}
DEFAULT_STAFF = [('san01', 'Ravi (Sanitation)', 'waste'), ('san02', 'Meena (Sanitation)', 'waste'),
                 ('ele01', 'Anil (Electrical)', 'light'), ('ele02', 'Kiran (Electrical)', 'light'),
                 ('rod01', 'Harpreet (Roads)', 'road'), ('rod02', 'Simran (Roads)', 'road')]

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL, cat TEXT,
  mobile TEXT UNIQUE, pw_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS config(cat TEXT PRIMARY KEY, name TEXT NOT NULL, team TEXT NOT NULL, sla_hours REAL NOT NULL);
CREATE TABLE IF NOT EXISTS tickets(seq INTEGER PRIMARY KEY AUTOINCREMENT, cat TEXT NOT NULL, descr TEXT NOT NULL,
  land TEXT NOT NULL, lat REAL, lng REAL, owner TEXT NOT NULL, team TEXT NOT NULL, staff TEXT NOT NULL,
  sla_hours REAL NOT NULL, t0 REAL NOT NULL, status TEXT NOT NULL, esc INTEGER NOT NULL DEFAULT 0,
  fol INTEGER NOT NULL DEFAULT 0, tr REAL, idem TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS tk_owner ON tickets(owner);
CREATE INDEX IF NOT EXISTS tk_staff ON tickets(staff);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, seq INTEGER NOT NULL, t REAL NOT NULL,
  status TEXT NOT NULL, pub TEXT NOT NULL, actor_id TEXT NOT NULL, actor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS photos(id INTEGER PRIMARY KEY AUTOINCREMENT, seq INTEGER NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ph_seq ON photos(seq);
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT, seq INTEGER NOT NULL, t REAL NOT NULL,
  actor TEXT NOT NULL, text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, t REAL NOT NULL, seq INTEGER NOT NULL,
  level INTEGER NOT NULL, msg TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, tries INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, t REAL NOT NULL, actor TEXT NOT NULL,
  msg TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL);
"""


JPEG = 'data:image/jpeg;base64,'


class ApiError(Exception):
    def __init__(self, status, detail):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def hash_pw(pw, salt=None):
    salt = salt or os.urandom(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return salt.hex() + ':' + h.hex()


def check_pw(pw, stored):
    salt, h = stored.split(':')
    c = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=2 ** 14, r=8, p=1, dklen=32).hex()
    return hmac.compare_digest(c, h)


def parse_id(s):
    m = re.search(r'\d+', str(s))
    if not m:
        raise ApiError(404, 'Ticket not found')
    return int(m.group())


def tid(seq):
    return 'ticket%03d' % seq


class Store:
    def __init__(self, path, secret=None, clock=time.time):
        self.clock = clock
        self.lock = threading.RLock()
        if path != ':memory:':
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.secret = secret or self._meta_secret()
        self.hits = {}

    def _meta_secret(self):
        r = self.db.execute("SELECT value FROM meta WHERE key='secret'").fetchone()
        if r:
            return r['value']
        s = secrets.token_hex(32)
        with self.db:
            self.db.execute("INSERT INTO meta VALUES('secret',?)", (s,))
        return s

    # ---------- setup ----------
    def seed(self, admin_password=None, staff_password=None):
        """Create config, staff and admin accounts if missing. Returns credentials created now."""
        made = {}
        with self.lock, self.db:
            for cat, (n, team, sla) in DEFAULT_CFG.items():
                self.db.execute('INSERT OR IGNORE INTO config VALUES(?,?,?,?)', (cat, n, team, sla))
            if not self.db.execute("SELECT 1 FROM users WHERE id='admin'").fetchone():
                pw = admin_password or secrets.token_urlsafe(9)
                self.db.execute("INSERT INTO users(id,role,name,pw_hash) VALUES('admin','admin','Department admin',?)",
                                (hash_pw(pw),))
                made['admin'] = pw
            for sid, name, cat in DEFAULT_STAFF:
                if not self.db.execute('SELECT 1 FROM users WHERE id=?', (sid,)).fetchone():
                    pw = staff_password or secrets.token_urlsafe(9)
                    self.db.execute('INSERT INTO users(id,role,name,cat,pw_hash) VALUES(?,?,?,?,?)',
                                    (sid, 'staff', name, cat, hash_pw(pw)))
                    made[sid] = pw
        return made

    # ---------- helpers ----------
    def limit(self, key, n, window):
        now = self.clock()
        q = [t for t in self.hits.get(key, []) if now - t < window]
        if len(q) >= n:
            self.hits[key] = q
            raise ApiError(429, 'Too many attempts. Try again later.')
        q.append(now)
        self.hits[key] = q

    def _audit(self, actor, msg):
        p = self.db.execute('SELECT hash FROM audit ORDER BY id DESC LIMIT 1').fetchone()
        prev = p['hash'] if p else ''
        t = self.clock()
        h = hashlib.sha256(f'{prev}|{t!r}|{actor}|{msg}'.encode()).hexdigest()
        self.db.execute('INSERT INTO audit(t,actor,msg,prev,hash) VALUES(?,?,?,?,?)', (t, actor, msg, prev, h))

    def verify_audit(self):
        prev = ''
        for r in self.db.execute('SELECT * FROM audit ORDER BY id'):
            h = hashlib.sha256(f"{prev}|{r['t']!r}|{r['actor']}|{r['msg']}".encode()).hexdigest()
            if r['prev'] != prev or r['hash'] != h:
                return False
            prev = r['hash']
        return True

    def _event(self, seq, status, pub, actor_id, actor):
        self.db.execute('INSERT INTO events(seq,t,status,pub,actor_id,actor) VALUES(?,?,?,?,?,?)',
                        (seq, self.clock(), status, pub, actor_id, actor))

    @staticmethod
    def pub_user(u):
        return {'role': u['role'], 'id': u['id'], 'name': u['name'], 'cat': u['cat']}

    def token(self, u):
        return jwt.encode({'sub': u['id'], 'role': u['role'], 'exp': int(self.clock() + 12 * 3600)},
                          self.secret, algorithm='HS256')

    def verify(self, token):
        try:
            d = jwt.decode(token, self.secret, algorithms=['HS256'], options={'verify_exp': False})
        except jwt.PyJWTError:
            raise ApiError(401, 'Sign in again.')
        if d.get('exp', 0) < self.clock():
            raise ApiError(401, 'Your session ended. Sign in again.')
        u = self.db.execute('SELECT * FROM users WHERE id=? AND active=1', (d['sub'],)).fetchone()
        if not u:
            raise ApiError(401, 'Sign in again.')
        return self.pub_user(u)

    # ---------- accounts ----------
    def register(self, name, mobile, password):
        name, mobile = (name or '').strip(), (mobile or '').strip()
        if len(name) < 2 or len(name) > 80:
            raise ApiError(422, 'Enter your name.')
        if not re.fullmatch(r'\d{10}', mobile):
            raise ApiError(422, 'Enter a 10-digit mobile number.')
        if len(password or '') < 8:
            raise ApiError(422, 'Use a password of at least 8 characters.')
        self.limit('register', 30, 3600)
        with self.lock, self.db:
            if self.db.execute('SELECT 1 FROM users WHERE mobile=?', (mobile,)).fetchone():
                raise ApiError(409, 'An account with this mobile number already exists. Sign in instead.')
            self.db.execute('INSERT INTO users(id,role,name,mobile,pw_hash) VALUES(?,?,?,?,?)',
                            ('r' + mobile, 'resident', name, mobile, hash_pw(password)))
            self._audit('system', 'resident account created')
        return self.login('resident', mobile, password)

    def login(self, role, identifier, password):
        if role not in ('resident', 'staff', 'admin'):
            raise ApiError(422, 'Unknown sign-in type.')
        ident = (identifier or '').strip()
        self.limit(f'login:{role}:{ident.lower()}', 10, 300)
        uid = 'r' + ident if role == 'resident' else ident.lower()
        u = self.db.execute('SELECT * FROM users WHERE id=? AND role=? AND active=1', (uid, role)).fetchone()
        if not u or not check_pw(password or '', u['pw_hash']):
            raise ApiError(401, 'Sign-in details are not right.')
        with self.lock, self.db:
            self._audit(u['id'], 'signed in')
        return {'token': self.token(u), 'user': self.pub_user(u)}

    # ---------- tickets ----------
    def _row(self, seq):
        r = self.db.execute('SELECT * FROM tickets WHERE seq=?', (seq,)).fetchone()
        if not r:
            raise ApiError(404, 'Ticket not found')
        return r

    def ticket_json(self, r, role):
        internal = role in ('staff', 'admin')
        ev = [{'t': e['t'] / 3600, 's': e['status'], 'pub': e['pub'],
               'a': e['actor'] if internal else ('system' if e['actor_id'] == 'system' else 'staff')}
              for e in self.db.execute('SELECT * FROM events WHERE seq=? ORDER BY id', (r['seq'],))]
        out = {'id': tid(r['seq']), 'cat': r['cat'], 'desc': r['descr'], 'land': r['land'],
               'pin': {'lat': r['lat'], 'lng': r['lng']} if r['lat'] is not None else None,
               'team': r['team'], 'staff': r['staff'] if internal else '', 'sla': r['sla_hours'],
               't0': r['t0'] / 3600, 'status': r['status'], 'ev': ev, 'notes': [], 'esc': r['esc'],
               'fol': r['fol'], 'tr': r['tr'] / 3600 if r['tr'] else None}
        if internal:
            out['np'] = self.db.execute('SELECT COUNT(*) FROM photos WHERE seq=?', (r['seq'],)).fetchone()[0]
            out['notes'] = [{'t': n['t'] / 3600, 'a': n['actor'], 'x': n['text']}
                            for n in self.db.execute('SELECT * FROM notes WHERE seq=? ORDER BY id', (r['seq'],))]
        return out

    AI_ACTOR = 'AI assistant (Gemini)'

    def ai_candidates(self, seq):
        """Ticket + team staff with their workload, or None if the AI should not act on this ticket."""
        with self.lock:
            r = self._row(seq)
            if r['status'] != 'assigned' or self.db.execute(
                    'SELECT 1 FROM notes WHERE seq=? AND actor=?', (seq, self.AI_ACTOR)).fetchone():
                return None
            now = self.clock()
            staff = [{'id': u['id'], 'name': u['name'],
                      'open': self.db.execute("SELECT COUNT(*) FROM tickets WHERE staff=? AND status!='resolved'",
                                              (u['id'],)).fetchone()[0],
                      'overdue': self.db.execute(
                          "SELECT COUNT(*) FROM tickets WHERE staff=? AND status!='resolved' AND ?>t0+sla_hours*3600",
                          (u['id'], now)).fetchone()[0]}
                     for u in self.db.execute("SELECT id,name FROM users WHERE role='staff' AND cat=? AND active=1 ORDER BY id",
                                              (r['cat'],))]
            return {'ticket': {'cat': r['cat'], 'desc': r['descr'], 'land': r['land']}, 'staff': staff, 'current': r['staff']}

    def ai_apply(self, seq, current, staff_id, reason):
        """Apply the AI's choice only if the ticket is untouched and the staff member is valid for this team."""
        with self.lock, self.db:
            r = self._row(seq)
            u = self.db.execute("SELECT * FROM users WHERE id=? AND role='staff' AND cat=? AND active=1",
                                (staff_id, r['cat'])).fetchone()
            if not u or r['staff'] != current or r['status'] != 'assigned':
                return False
            if staff_id != current:
                self.db.execute('UPDATE tickets SET staff=? WHERE seq=?', (staff_id, seq))
            self.db.execute('INSERT INTO notes(seq,t,actor,text) VALUES(?,?,?,?)',
                            (seq, self.clock(), self.AI_ACTOR, f"Assigned to {u['name']}. {reason}".strip()))
            self._audit(self.AI_ACTOR, f"{tid(seq)} assigned to {u['name']} ({'kept' if staff_id == current else 'changed'} from rule pick)")
            return True

    def photos(self, user, ticket):
        seq = parse_id(ticket)
        r = self._row(seq)
        if not (user['role'] == 'admin' or (user['role'] == 'staff' and r['staff'] == user['id'])):
            raise ApiError(403, 'Only the assigned staff member or an admin can view photos.')
        return {'photos': [x['data'] for x in self.db.execute('SELECT data FROM photos WHERE seq=? ORDER BY id', (seq,))]}

    def create_ticket(self, user, p):
        if user['role'] != 'resident':
            raise ApiError(403, 'Only residents can report issues.')
        self.limit('create:' + user['id'], 20, 3600)
        cat, desc, land = p.get('cat'), (p.get('desc') or '').strip(), (p.get('land') or '').strip()
        key = (p.get('key') or '').strip()
        pin = p.get('pin')
        if not key:
            raise ApiError(422, 'Missing request key.')
        if not p.get('consent'):
            raise ApiError(422, 'Consent is required.')
        if not (5 <= len(desc) <= 1000) or len(land) > 200:
            raise ApiError(422, 'Add a few words of detail (5 to 1000 characters).')
        photos = p.get('photos') or []
        if not isinstance(photos, list) or len(photos) > 3:
            raise ApiError(422, 'You can add up to 3 photos.')
        for x in photos:
            if not isinstance(x, str) or not x.startswith(JPEG) or len(x) > 500_000:
                raise ApiError(422, 'Photos must be JPEG images under 500 KB each.')
            try:
                if not base64.b64decode(x[len(JPEG):], validate=True).startswith(b'\xff\xd8'):
                    raise ValueError
            except ValueError:
                raise ApiError(422, 'One of the photos is not a valid JPEG image.')
        if not pin and not land:
            raise ApiError(422, 'Add a live location, a map pin or a landmark.')
        lat = lng = None
        if pin:
            lat, lng = float(pin['lat']), float(pin['lng'])
            if not (BOUNDS[0] <= lat <= BOUNDS[1] and BOUNDS[2] <= lng <= BOUNDS[3]):
                raise ApiError(422, 'Location is outside the Chandigarh demo area.')
        idem = user['id'] + ':' + key[:80]
        with self.lock, self.db:
            again = self.db.execute('SELECT * FROM tickets WHERE idem=?', (idem,)).fetchone()
            if again:
                return self.ticket_json(again, 'resident')
            c = self.db.execute('SELECT * FROM config WHERE cat=?', (cat,)).fetchone()
            if not c:
                raise ApiError(422, 'Unknown category.')
            staff = self.db.execute(
                """SELECT u.id,u.name,(SELECT COUNT(*) FROM tickets t WHERE t.staff=u.id AND t.status!='resolved') AS load
                   FROM users u WHERE u.role='staff' AND u.cat=? AND u.active=1 ORDER BY load,u.id""", (cat,)).fetchone()
            if not staff:
                raise ApiError(503, 'No staff are set up for this category yet.')
            now = self.clock()
            cur = self.db.execute(
                """INSERT INTO tickets(cat,descr,land,lat,lng,owner,team,staff,sla_hours,t0,status,idem)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                (cat, desc, land, lat, lng, user['id'], c['team'], staff['id'], c['sla_hours'], now, 'assigned', idem))
            seq = cur.lastrowid
            for x in photos:
                self.db.execute('INSERT INTO photos(seq,data) VALUES(?,?)', (seq, x))
            self._event(seq, 'received', 'Report confirmed by the resident and added to the department console.', 'system', 'system')
            self._event(seq, 'triaged', f"Category checked against department rules. Routed to {c['team']}.", 'system', 'system')
            self._event(seq, 'assigned', f"Assigned to a {c['team']} staff member.", 'system', 'system')
            self._audit('system', f"{tid(seq)} created, routed to {c['team']}, assigned to {staff['name']}, deadline {c['sla_hours']:g} h")
            return self.ticket_json(self._row(seq), 'resident')

    def change_status(self, user, ticket, to, pub=None):
        if user['role'] != 'staff':
            raise ApiError(403, 'Only the assigned staff member can change a ticket status.')
        seq = parse_id(ticket)
        with self.lock, self.db:
            r = self._row(seq)
            if r['staff'] != user['id']:
                raise ApiError(403, 'This ticket is assigned to another staff member.')
            if to not in NEXT.get(r['status'], []):
                raise ApiError(409, f"Invalid transition {r['status']} to {to}.")
            text = (pub or '').strip()[:300] or ('Status: ' + LBL[to])
            self.db.execute('UPDATE tickets SET status=?, tr=? WHERE seq=?',
                            (to, self.clock() if to == 'resolved' else None, seq))
            self._event(seq, to, text, user['id'], user['name'])
            self._audit(user['name'], f'{tid(seq)} to {LBL[to]}')
            return self.ticket_json(self._row(seq), 'staff')

    def add_note(self, user, ticket, text):
        if user['role'] != 'staff':
            raise ApiError(403, 'Only staff can add internal notes.')
        seq = parse_id(ticket)
        text = (text or '').strip()[:500]
        if not text:
            raise ApiError(422, 'Write a note first.')
        with self.lock, self.db:
            if self._row(seq)['staff'] != user['id']:
                raise ApiError(403, 'This ticket is assigned to another staff member.')
            self.db.execute('INSERT INTO notes(seq,t,actor,text) VALUES(?,?,?,?)', (seq, self.clock(), user['name'], text))
            self._audit(user['name'], f'{tid(seq)} internal note added')
            return self.ticket_json(self._row(seq), 'staff')

    def reassign(self, user, ticket, staff_id):
        if user['role'] != 'admin':
            raise ApiError(403, 'Only the department admin can reassign tickets.')
        seq = parse_id(ticket)
        with self.lock, self.db:
            r = self._row(seq)
            s = self.db.execute("SELECT * FROM users WHERE id=? AND role='staff' AND active=1", (staff_id,)).fetchone()
            if not s or s['cat'] != r['cat']:
                raise ApiError(422, 'Choose a staff member from the same team.')
            if r['status'] == 'resolved':
                raise ApiError(409, 'Ticket is resolved.')
            self.db.execute('UPDATE tickets SET staff=? WHERE seq=?', (s['id'], seq))
            self._event(seq, r['status'], f"Ticket reassigned within {r['team']}.", user['id'], user['name'])
            self._audit(user['name'], f"{tid(seq)} reassigned to {s['name']}")
            return self.ticket_json(self._row(seq), 'admin')

    def set_config(self, user, cat, team, sla_hours):
        if user['role'] != 'admin':
            raise ApiError(403, 'Only the department admin can change routing rules.')
        team = (team or '').strip()
        if not team or len(team) > 80 or not (0 < float(sla_hours) <= 24 * 90):
            raise ApiError(422, 'Enter a team name and a deadline between 1 hour and 90 days.')
        with self.lock, self.db:
            if not self.db.execute('SELECT 1 FROM config WHERE cat=?', (cat,)).fetchone():
                raise ApiError(404, 'Unknown category.')
            self.db.execute('UPDATE config SET team=?, sla_hours=? WHERE cat=?', (team, float(sla_hours), cat))
            self._audit(user['name'], f'routing for {cat} set to {team}, {float(sla_hours):g} h')
        return self.config()

    def follow(self, user, ticket):
        seq = parse_id(ticket)
        with self.lock, self.db:
            self._row(seq)
            self.db.execute('UPDATE tickets SET fol=fol+1 WHERE seq=?', (seq,))
            self._audit(user['id'], f'{tid(seq)} followed')
        return {'ok': True}

    def track(self, ticket):
        r = self._row(parse_id(ticket))
        j = self.ticket_json(r, 'public')
        return {'id': j['id'], 'cat': j['cat'], 'status': j['status'], 'sla': j['sla'], 't0': j['t0'],
                'ev': [{'t': e['t'], 's': e['s'], 'pub': e['pub'], 'a': ''} for e in j['ev']],
                'esc': j['esc'], 'tr': j['tr'], 'notes': [], 'fol': 0, 'desc': '', 'land': '', 'pin': None,
                'team': j['team'], 'staff': ''}

    def config(self):
        return {r['cat']: {'n': r['name'], 'team': r['team'], 'sla': r['sla_hours']}
                for r in self.db.execute('SELECT * FROM config')}

    def sync(self, user):
        role = user['role']
        if role == 'resident':
            rows = self.db.execute('SELECT * FROM tickets WHERE owner=? ORDER BY seq', (user['id'],)).fetchall()
        elif role == 'staff':
            rows = self.db.execute('SELECT * FROM tickets WHERE staff=? ORDER BY seq', (user['id'],)).fetchall()
        else:
            rows = self.db.execute('SELECT * FROM tickets ORDER BY seq').fetchall()
        public = [{'id': tid(r['seq']), 'cat': r['cat'], 'status': r['status'], 't0': r['t0'] / 3600,
                   'sla': r['sla_hours'], 'pin': {'lat': r['lat'], 'lng': r['lng']} if r['lat'] is not None else None}
                  for r in self.db.execute('SELECT * FROM tickets ORDER BY seq')]
        out = {'now': int(self.clock() * 1000), 'tickets': [self.ticket_json(r, role) for r in rows],
               'public': public, 'config': self.config()}
        if role == 'admin':
            out['staff'] = [{'id': s['id'], 'name': s['name'], 'cat': s['cat']} for s in
                            self.db.execute("SELECT * FROM users WHERE role='staff' AND active=1 ORDER BY id")]
            out['audit'] = [datetime.fromtimestamp(a['t'], IST).strftime('%d %b %I:%M:%S %p IST') + f" · {a['actor']} · {a['msg']}"
                            for a in self.db.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 80')]
        return out

    # ---------- deadline engine ----------
    def run_escalations(self):
        """Escalate late tickets to people. Never closes or rejects a ticket."""
        n = 0
        with self.lock, self.db:
            now = self.clock()
            for r in self.db.execute("SELECT * FROM tickets WHERE status!='resolved'").fetchall():
                ratio = (now - r['t0']) / (r['sla_hours'] * 3600)
                lvl = r['esc']
                while lvl < 3 and ratio >= ESC[lvl][0]:
                    self._audit('system', f"{tid(r['seq'])} escalation: {ESC[lvl][1]} (ticket stays open)")
                    self._queue(r['seq'], lvl + 1, f"{tid(r['seq'])} ({r['cat']}, {r['team']}): {ESC[lvl][1]}")
                    lvl += 1
                    n += 1
                if lvl != r['esc']:
                    self.db.execute('UPDATE tickets SET esc=? WHERE seq=?', (lvl, r['seq']))
        return n

    # ---------- notifications, reopen, analytics, audit anchor ----------
    def _queue(self, seq, level, msg):
        self.db.execute('INSERT INTO outbox(t,seq,level,msg) VALUES(?,?,?,?)', (self.clock(), seq, level, msg))

    def pending_outbox(self, limit=20):
        return [dict(r) for r in self.db.execute('SELECT * FROM outbox WHERE sent=0 AND tries<5 ORDER BY id LIMIT ?', (limit,))]

    def mark_outbox(self, oid, ok):
        with self.lock, self.db:
            self.db.execute('UPDATE outbox SET sent=?, tries=tries+1 WHERE id=?', (1 if ok else 0, oid))

    def reopen(self, user, ticket, reason=''):
        """Resident says a resolved ticket is not fixed: the deadline clock restarts, staff are told."""
        if user['role'] != 'resident':
            raise ApiError(403, 'Only the resident who reported it can reopen a ticket.')
        seq = parse_id(ticket)
        with self.lock, self.db:
            r = self._row(seq)
            if r['owner'] != user['id']:
                raise ApiError(403, 'This is not your ticket.')
            if r['status'] != 'resolved':
                raise ApiError(409, 'Only resolved tickets can be reopened.')
            why = (reason or '').strip()[:300] or 'not fixed'
            self.db.execute("UPDATE tickets SET status='assigned', tr=NULL, t0=?, esc=0 WHERE seq=?", (self.clock(), seq))
            self._event(seq, 'assigned', 'Reopened by the resident: ' + why, user['id'], user['name'])
            self._audit(user['name'], f'{tid(seq)} reopened by resident')
            self._queue(seq, 0, f"{tid(seq)} reopened by the resident: {why}")
            return self.ticket_json(self._row(seq), 'resident')

    def analytics(self):
        """Aggregate numbers only, no personal data. Safe to publish."""
        now = self.clock()
        rows = self.db.execute('SELECT * FROM tickets').fetchall()
        done = [r for r in rows if r['status'] == 'resolved' and r['tr']]
        open_ = [r for r in rows if r['status'] != 'resolved']
        met = [r for r in done if r['tr'] - r['t0'] <= r['sla_hours'] * 3600]
        by = {}
        for r in rows:
            by[r['cat']] = by.get(r['cat'], 0) + 1
        return {'total': len(rows), 'open': len(open_), 'resolved': len(done),
                'overdue': sum(1 for r in open_ if now - r['t0'] > r['sla_hours'] * 3600),
                'escalated': sum(1 for r in rows if r['esc']),
                'avg_resolve_hours': round(sum(r['tr'] - r['t0'] for r in done) / len(done) / 3600, 2) if done else None,
                'deadline_met_pct': round(100 * len(met) / len(done), 1) if done else None, 'by_category': by}

    def audit_head(self):
        """Latest hash of the audit chain. Publish it somewhere outside the server to make tampering detectable."""
        r = self.db.execute('SELECT hash FROM audit ORDER BY id DESC LIMIT 1').fetchone()
        return {'head': r['hash'] if r else '', 'entries': self.db.execute('SELECT COUNT(*) c FROM audit').fetchone()['c'],
                'chain_ok': self.verify_audit()}
