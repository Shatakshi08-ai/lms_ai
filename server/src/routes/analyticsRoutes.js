import { Router } from 'express';
import * as a from '../controllers/analyticsController.js';
import { protect, adminOnly, staffOnly } from '../middleware/auth.js';

const r = Router();
r.use(protect);
r.get('/dashboard', staffOnly, a.dashboard);
r.get('/me', a.patronHome);
r.get('/settings', a.getSettingsCtrl);
r.patch('/settings', adminOnly, a.updateSettings);
r.get('/audit', staffOnly, a.auditLogs);
r.get('/notifications', a.notifications);
r.patch('/notifications/read-all', a.markAllNotificationsRead);
r.patch('/notifications/:id/read', a.markNotificationRead);
r.get('/bottlenecks', adminOnly, a.inventoryBottlenecks);
export default r;
