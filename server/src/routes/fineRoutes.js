import { Router } from 'express';
import * as f from '../controllers/fineController.js';
import { protect, staffOnly } from '../middleware/auth.js';

const r = Router();
r.use(protect);
r.get('/', f.listFines);
r.get('/:id', f.getFine);
r.post('/:id/pay', staffOnly, f.pay);
r.post('/:id/waive', staffOnly, f.waive);
export default r;
