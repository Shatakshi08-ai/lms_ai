import { Router } from 'express';
import * as c from '../controllers/circulationController.js';
import { protect, staffOnly } from '../middleware/auth.js';

const r = Router();
r.use(protect);
r.get('/loans/me', c.myLoans);
r.get('/loans', c.listLoans);
r.get('/today', staffOnly, c.todayStats);
r.post('/issue', staffOnly, c.issue);
r.post('/return', staffOnly, c.returnCopy);
r.post('/renew/:id', c.renew);
r.post('/reservations', c.reserve);
r.get('/reservations', c.listReservations);
r.post('/reservations/:id/cancel', c.cancelReservation);
export default r;
