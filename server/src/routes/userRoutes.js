import { Router } from 'express';
import * as users from '../controllers/userController.js';
import { protect, adminOnly, staffOnly, superAdminOnly } from '../middleware/auth.js';

const r = Router();
r.use(protect);
r.get('/', staffOnly, users.listUsers);
r.post('/', adminOnly, users.createUser);
r.get('/:id', staffOnly, users.getUser);
r.patch('/:id', adminOnly, users.updateUser);
r.patch('/:id/role', superAdminOnly, users.updateUser);
export default r;
