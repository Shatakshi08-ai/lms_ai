import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'STUDENT', 'MEMBER'];
export const PATRON_ROLES = ['STUDENT', 'MEMBER'];
export const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN'];
export const USER_STATUS = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];
export const PUBLIC_REGISTER_ROLES = ['STUDENT', 'MEMBER'];

export function isPatron(userOrRole) {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return PATRON_ROLES.includes(role);
}

export function isStaff(userOrRole) {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return STAFF_ROLES.includes(role);
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'STUDENT', index: true },
    readerId: { type: String, unique: true, sparse: true, index: true },
    department: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    maxBorrowLimit: { type: Number, default: 5, min: 1, max: 10 },
    activeFineBalance: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: USER_STATUS, default: 'ACTIVE', index: true },
    avatar: { type: String, default: '' },
    preferences: {
      genres: { type: [String], default: [] },
      languages: { type: [String], default: ['English'] },
      readingGoal: { type: String, default: 'casual' },
    },
    preferencesOnboarded: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: Date.now },
    refreshTokenHash: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ name: 'text', email: 'text', readerId: 'text', department: 'text' });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  const stored = this.password || '';
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compare(candidate, stored);
  }
  if (stored && candidate === stored) {
    this.password = candidate;
    await this.save();
    return true;
  }
  return false;
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.refreshTokenHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
