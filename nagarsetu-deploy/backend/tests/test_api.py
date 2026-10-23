"""HTTP tests for the FastAPI layer. Needs: pip install -r requirements.txt, then run pytest from backend/.
These were written alongside the service-layer tests but have not been run in the authoring sandbox
(FastAPI was not installable there). Run them before you deploy."""
import os
import sys

os.environ['NAGARSETU_DB'] = ':memory:'
os.environ['SECRET_KEY'] = 'test'
os.environ['ADMIN_PASSWORD'] = 'adminpass1'
os.environ['STAFF_PASSWORD'] = 'staffpass1'
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

c = TestClient(app)
PIN = {'lat': 30.7333, 'lng': 76.768}


def auth(r):
    return {'Authorization': 'Bearer ' + r.json()['token']}


def test_full_flow():
    r = c.post('/api/auth/register', json={'name': 'Asha', 'mobile': '9876543210', 'password': 'longpassword'})
    assert r.status_code == 200
    res = auth(r)
    t = c.post('/api/tickets', headers=res, json={'key': 'a', 'cat': 'waste', 'desc': 'bins overflowing',
                                                 'land': 'Sector 22 Market', 'pin': PIN, 'consent': True})
    assert t.status_code == 200 and t.json()['id'] == 'ticket001'
    assert c.get('/api/queue', headers=res).status_code == 403
    assert c.get('/api/tickets/track/ticket001').json()['status'] == 'assigned'
    assert c.get('/api/tickets/track/ticket999').status_code == 404
    assert c.get('/api/sync').status_code == 401
    adm = auth(c.post('/api/auth/login', json={'role': 'admin', 'identifier': 'admin', 'password': 'adminpass1'}))
    sid = c.get('/api/sync', headers=adm).json()['tickets'][0]['staff']
    st = auth(c.post('/api/auth/login', json={'role': 'staff', 'identifier': sid, 'password': 'staffpass1'}))
    r = c.patch('/api/tickets/ticket001/status', headers=st, json={'to': 'in_progress', 'pub': 'On it'})
    assert r.status_code == 200 and r.json()['status'] == 'in_progress'
    assert c.patch('/api/tickets/ticket001/status', headers=adm, json={'to': 'resolved'}).status_code == 403
    assert c.get('/api/health').json()['audit_chain_ok'] is True
    assert c.get('/config.js').text.startswith('window.NS_CONFIG')


def test_new_endpoints():
    assert c.get('/api/analytics').status_code == 200
    h = c.get('/api/audit/head').json()
    assert h['chain_ok'] is True
    assert c.post('/api/tickets/ticket001/reopen', json={'reason': 'x'}).status_code == 401


def test_photos():
    import base64
    jpeg = 'data:image/jpeg;base64,' + base64.b64encode(b'\xff\xd8\xff\xe0' + b'0' * 50).decode()
    r = c.post('/api/auth/register', json={'name': 'Ravi', 'mobile': '9876500001', 'password': 'longpassword'})
    res = auth(r)
    body = {'key': 'ph1', 'cat': 'road', 'desc': 'pothole near the market', 'land': 'Sector 17 Plaza',
            'pin': PIN, 'consent': True, 'photos': [jpeg, jpeg]}
    t = c.post('/api/tickets', headers=res, json=body)
    assert t.status_code == 200
    tid = t.json()['id']
    assert 'photos' not in c.get('/api/tickets/track/' + tid).json()
    assert c.get('/api/tickets/%s/photos' % tid, headers=res).status_code == 403
    adm = auth(c.post('/api/auth/login', json={'role': 'admin', 'identifier': 'admin', 'password': 'adminpass1'}))
    assert len(c.get('/api/tickets/%s/photos' % tid, headers=adm).json()['photos']) == 2
    bad = dict(body, key='ph2', photos=['data:image/png;base64,AAAA'])
    assert c.post('/api/tickets', headers=res, json=bad).status_code == 422
    many = dict(body, key='ph3', photos=[jpeg] * 4)
    assert c.post('/api/tickets', headers=res, json=many).status_code == 422
