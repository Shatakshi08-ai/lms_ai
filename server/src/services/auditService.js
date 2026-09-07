import { AuditLog } from '../models/AuditLog.js';

export async function writeAudit({
  actorId,
  actorRole,
  action,
  entity,
  entityId,
  bookId,
  bookTitle,
  catalogId,
  status = 'SUCCESS',
  changes,
  req,
}) {
  try {
    const role = actorRole || req?.user?.role || '';
    await AuditLog.create({
      actorId,
      actorRole: role,
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      bookId: bookId || undefined,
      bookTitle: bookTitle || '',
      catalogId: catalogId || '',
      status,
      changes: changes || {},
      ipAddress: req?.ip || '',
      timestamp: new Date(),
    });
  } catch {
    // audit failure must never block business ops
  }
}

export const auditLog = writeAudit;
