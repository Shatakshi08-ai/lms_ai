import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'library' },
    dailyFineRate: { type: Number, default: 5, min: 0 },
    gracePeriodDays: { type: Number, default: 2, min: 0 },
    maxFineCap: { type: Number, default: 500, min: 0 },
    loanPeriodDays: { type: Number, default: 14, min: 1 },
    maxRenewals: { type: Number, default: 2, min: 0 },
    holdExpiryHours: { type: Number, default: 48, min: 1 },
    unpaidFineIssueBlock: { type: Number, default: 50, min: 0 },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    libraryName: { type: String, default: 'QuestLearn' },
    ai: {
      provider: { type: String, default: 'mock' },
      studentCopilotEnabled: { type: Boolean, default: true },
      adminNlQueryEnabled: { type: Boolean, default: true },
      recommendationsEnabled: { type: Boolean, default: true },
      systemPrompt: { type: String, default: '' },
    },
  },
  { timestamps: true },
);

export const Settings = mongoose.model('Settings', settingsSchema);

export async function getSettings() {
  let doc = await Settings.findOne({ key: 'library' });
  if (!doc) doc = await Settings.create({ key: 'library' });
  return doc;
}
