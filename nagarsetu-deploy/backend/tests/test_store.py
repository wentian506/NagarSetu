"""Rule tests for the service layer. Run from backend/: python -m unittest discover -s tests -p test_store.py -v"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.store import ApiError, Store  # noqa: E402

PIN = {'lat': 30.7333, 'lng': 76.7680}


class Clock:
    def __init__(self):
        self.t = 1_800_000_000.0

    def __call__(self):
        return self.t


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.s = Store(':memory:', 'test-secret', self.clock)
        self.creds = self.s.seed('adminpass1', 'staffpass1')
        self.res = self.s.register('Asha', '9876543210', 'longpassword')['user']
        self.admin = self.s.login('admin', 'admin', 'adminpass1')['user']

    def ticket(self, key='k1', cat='waste', **kw):
        p = {'key': key, 'cat': cat, 'desc': 'bins overflowing', 'land': 'Sector 22 Market', 'pin': PIN, 'consent': True}
        p.update(kw)
        return self.s.create_ticket(self.res, p)

    def staff(self, sid):
        return self.s.login('staff', sid, 'staffpass1')['user']

    def fails(self, status, fn, *a, **k):
        with self.assertRaises(ApiError) as c:
            fn(*a, **k)
        self.assertEqual(c.exception.status, status)

    # sign-in
    def test_passwords_hashed_and_wrong_password_rejected(self):
        self.fails(401, self.s.login, 'staff', 'san01', 'wrong')
        self.fails(401, self.s.login, 'admin', 'admin', 'nope')
        self.assertNotIn('longpassword', str(self.s.db.execute('SELECT pw_hash FROM users').fetchall()[0][0]))

    def test_register_rules(self):
        self.fails(409, self.s.register, 'Asha', '9876543210', 'longpassword')
        self.fails(422, self.s.register, 'B', '123', 'longpassword')
        self.fails(422, self.s.register, 'Bob', '9876500000', 'short')

    def test_login_rate_limit(self):
        for _ in range(10):
            self.fails(401, self.s.login, 'staff', 'san01', 'bad')
        self.fails(429, self.s.login, 'staff', 'san01', 'bad')
        self.clock.t += 301
        self.assertEqual(self.staff('san01')['id'], 'san01')

    def test_token_roundtrip_and_expiry(self):
        t = self.s.login('resident', '9876543210', 'longpassword')['token']
        self.assertEqual(self.s.verify(t)['id'], 'r9876543210')
        self.clock.t += 13 * 3600
        self.fails(401, self.s.verify, t)
        self.fails(401, self.s.verify, 'garbage')

    # ticket creation
    def test_ticket_numbering_assignment_and_events(self):
        t = self.ticket()
        self.assertEqual(t['id'], 'ticket001')
        self.assertEqual(t['status'], 'assigned')
        self.assertEqual([e['s'] for e in t['ev']], ['received', 'triaged', 'assigned'])
        self.assertEqual(self.ticket('k2')['id'], 'ticket002')

    def test_assignment_matches_category_and_balances_load(self):
        a = self.s.sync(self.admin)
        t1, t2, t3 = self.ticket('a'), self.ticket('b'), self.ticket('c')
        rows = {x['id']: x['staff'] for x in self.s.sync(self.admin)['tickets']}
        self.assertTrue(all(rows[i].startswith('san') for i in rows))
        self.assertNotEqual(rows['ticket001'], rows['ticket002'])
        self.assertEqual(rows['ticket003'], rows['ticket001'])
        road = self.ticket('d', cat='road')
        self.assertTrue(self.s.sync(self.admin)['tickets'][-1]['staff'].startswith('rod'))
        self.assertEqual(len(a['tickets']), 0)

    def test_idempotent_create(self):
        a, b = self.ticket('same'), self.ticket('same')
        self.assertEqual(a['id'], b['id'])
        self.assertEqual(len(self.s.sync(self.admin)['tickets']), 1)

    def test_validation(self):
        self.fails(422, self.ticket, 'x', consent=False)
        self.fails(422, self.ticket, 'x', desc='no')
        self.fails(422, self.ticket, 'x', cat='bogus')
        self.fails(422, self.ticket, 'x', pin={'lat': 28.6, 'lng': 77.2})
        self.fails(422, self.ticket, 'x', pin=None, land='')
        self.fails(403, self.s.create_ticket, self.admin, {'key': 'q', 'cat': 'waste', 'desc': 'abcdef', 'pin': PIN, 'consent': True})

    # access control
    def test_staff_only_see_and_change_own_tickets(self):
        t = self.ticket()
        owner = t and self.s.sync(self.admin)['tickets'][0]['staff']
        other = 'san02' if owner == 'san01' else 'san01'
        self.assertEqual(len(self.s.sync(self.staff(owner))['tickets']), 1)
        self.assertEqual(len(self.s.sync(self.staff(other))['tickets']), 0)
        self.fails(403, self.s.change_status, self.staff(other), 'ticket001', 'in_progress')
        self.fails(403, self.s.add_note, self.staff(other), 'ticket001', 'hi')
        self.fails(403, self.s.change_status, self.admin, 'ticket001', 'in_progress')
        self.fails(403, self.s.change_status, self.res, 'ticket001', 'in_progress')

    def test_resident_sees_only_own_and_no_internal_data(self):
        self.ticket()
        other = self.s.register('Ravi', '9000000001', 'longpassword')['user']
        self.assertEqual(self.s.sync(other)['tickets'], [])
        mine = self.s.sync(self.res)['tickets'][0]
        self.assertEqual(mine['staff'], '')
        self.assertTrue(all(e['a'] in ('system', 'staff') for e in mine['ev']))
        pub = self.s.sync(other)['public'][0]
        self.assertNotIn('desc', pub)
        self.assertNotIn('land', pub)

    def test_public_track_hides_private_fields(self):
        self.ticket()
        j = self.s.track('Ticket 1')
        self.assertEqual((j['desc'], j['land'], j['pin'], j['staff']), ('', '', None, ''))
        self.fails(404, self.s.track, 'ticket099')
        self.fails(404, self.s.track, 'nonsense')

    def test_lifecycle_and_notes(self):
        self.ticket()
        sid = self.s.sync(self.admin)['tickets'][0]['staff']
        st = self.staff(sid)
        self.fails(409, self.s.change_status, st, 'ticket001', 'resolved')
        self.s.change_status(st, 'ticket001', 'in_progress', 'Crew on the way')
        self.s.add_note(st, 'ticket001', 'gate locked')
        r = self.s.change_status(st, 'ticket001', 'resolved')
        self.assertEqual(r['status'], 'resolved')
        self.assertIsNotNone(r['tr'])
        self.fails(409, self.s.change_status, st, 'ticket001', 'in_progress')
        self.assertEqual(len(self.s.sync(self.res)['tickets'][0]['notes']), 0)
        self.assertEqual(len(self.s.sync(st)['tickets'][0]['notes']), 1)

    def test_reassign_rules(self):
        self.ticket()
        cur = self.s.sync(self.admin)['tickets'][0]['staff']
        new = 'san02' if cur == 'san01' else 'san01'
        self.assertEqual(self.s.reassign(self.admin, 'ticket001', new)['staff'], new)
        self.fails(422, self.s.reassign, self.admin, 'ticket001', 'rod01')
        self.fails(403, self.s.reassign, self.staff(new), 'ticket001', cur)

    def test_config_admin_only_and_applies_to_new_tickets(self):
        old = self.ticket('a')
        self.fails(403, self.s.set_config, self.res, 'waste', 'X', 10)
        self.fails(422, self.s.set_config, self.admin, 'waste', '', 10)
        self.fails(422, self.s.set_config, self.admin, 'waste', 'Team', 0)
        self.s.set_config(self.admin, 'waste', 'Waste cell', 12)
        new = self.ticket('b')
        self.assertEqual((old['sla'], new['sla'], new['team']), (24, 12, 'Waste cell'))

    # deadline engine on a real-time clock
    def test_escalation_ladder_and_never_closes(self):
        self.ticket()
        self.assertEqual(self.s.run_escalations(), 0)
        self.clock.t += 23 * 3600
        self.assertEqual(self.s.run_escalations(), 0)
        self.clock.t += 2 * 3600 - 1800        # 24.5 h
        self.assertEqual(self.s.run_escalations(), 1)
        self.clock.t += 6 * 3600               # 30.5 h = 127%
        self.assertEqual(self.s.run_escalations(), 1)
        self.clock.t += 7 * 3600               # 37.5 h = 156%
        self.assertEqual(self.s.run_escalations(), 1)
        self.assertEqual(self.s.run_escalations(), 0)
        t = self.s.sync(self.admin)['tickets'][0]
        self.assertEqual((t['esc'], t['status']), (3, 'assigned'))

    def test_resolved_tickets_do_not_escalate(self):
        self.ticket()
        sid = self.s.sync(self.admin)['tickets'][0]['staff']
        st = self.staff(sid)
        self.s.change_status(st, 'ticket001', 'in_progress')
        self.s.change_status(st, 'ticket001', 'resolved')
        self.clock.t += 100 * 3600
        self.assertEqual(self.s.run_escalations(), 0)

    def test_audit_chain_detects_tampering(self):
        self.ticket()
        self.assertTrue(self.s.verify_audit())
        with self.s.db:
            self.s.db.execute("UPDATE audit SET msg='edited' WHERE id=2")
        self.assertFalse(self.s.verify_audit())

    def test_sync_audit_only_for_admin(self):
        self.ticket()
        self.assertIn('audit', self.s.sync(self.admin))
        self.assertNotIn('audit', self.s.sync(self.res))
        self.assertNotIn('staff', self.s.sync(self.res))


if __name__ == '__main__':
    unittest.main()
