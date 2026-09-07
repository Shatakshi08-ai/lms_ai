import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String, default: '', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, default: '' },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', index: true },
    bookTitle: { type: String, default: '', index: true },
    catalogId: { type: String, default: '', index: true },
    status: { type: String, default: 'SUCCESS', index: true },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ bookId: 1, timestamp: -1 });
auditLogSchema.index({ actorRole: 1, timestamp: -1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
