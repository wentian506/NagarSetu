"""Tests for reopen, outbox, analytics and audit head. Run from backend/: python -m unittest discover -s tests -p "test_*.py" -v"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.store import ApiError, Store  # noqa: E402
from test_store import Clock, PIN  # noqa: E402


class ExtraTests(unittest.TestCase):
    def setUp(self):
        self.c = Clock()
        self.s = Store(':memory:', 'k', self.c)
        self.s.seed('adminpass1', 'staffpass1')
        self.res = self.s.register('Asha', '9876543210', 'longpassword')['user']
        self.other = self.s.register('Ravi', '9876543211', 'longpassword')['user']
        p = {'key': 'a', 'cat': 'waste', 'desc': 'bins overflowing', 'land': 'Sector 22', 'pin': PIN, 'consent': True}
        self.t = self.s.create_ticket(self.res, p)['id']
        sid = self.s.sync(self.s.login('admin', 'admin', 'adminpass1')['user'])['tickets'][0]['staff']
        self.staff = self.s.login('staff', sid, 'staffpass1')['user']

    def resolve(self):
        self.s.change_status(self.staff, self.t, 'in_progress')
        self.s.change_status(self.staff, self.t, 'resolved', 'Done')

    def test_reopen_restarts_clock(self):
        self.resolve()
        self.c.t += 3600
        r = self.s.reopen(self.res, self.t, 'still there')
        self.assertEqual(r['status'], 'assigned')
        self.assertIn('Reopened by the resident: still there', r['ev'][-1]['pub'])

    def test_reopen_rules(self):
        with self.assertRaises(ApiError):
            self.s.reopen(self.res, self.t)  # not resolved yet
        self.resolve()
        with self.assertRaises(ApiError):
            self.s.reopen(self.other, self.t)  # someone else's ticket
        with self.assertRaises(ApiError):
            self.s.reopen(self.staff, self.t)  # staff cannot reopen

    def test_outbox_and_analytics(self):
        self.c.t += 24 * 3600 * 2
        self.s.run_escalations()
        out = self.s.pending_outbox()
        self.assertEqual(len(out), 3)
        self.s.mark_outbox(out[0]['id'], True)
        self.assertEqual(len(self.s.pending_outbox()), 2)
        a = self.s.analytics()
        self.assertEqual((a['total'], a['overdue'], a['escalated']), (1, 1, 1))

    def test_audit_head(self):
        h = self.s.audit_head()
        self.assertTrue(h['chain_ok'] and h['entries'] > 0 and len(h['head']) == 64)


if __name__ == '__main__':
    unittest.main()
