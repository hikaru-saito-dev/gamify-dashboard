import mongoose, { Schema, Document } from 'mongoose';

export interface IDailyObjectiveProgress {
  objectiveId: string;
  messageCount: number;
  successMessageCount: number;
  xpReward: number;
  order: number;
  completed: boolean;
  claimed: boolean;
}

export interface IDailyQuestProgress extends Document {
  companyId: string;
  userId: string;
  dateKey: string;
  currentMessages: number;
  currentSuccessMessages: number;
  Objectives: IDailyObjectiveProgress[];
  Completed: boolean;
  QuestSeen: boolean;
  NotificationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailyObjectiveSchema = new Schema<IDailyObjectiveProgress>({
  objectiveId: { type: String, required: true },
  xpReward: { type: Number, required: true },
  order: { type: Number, required: true },
  completed: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  messageCount: { type: Number, required: true },
  successMessageCount: { type: Number, required: true },
});

const DailyQuestProgressSchema = new Schema<IDailyQuestProgress>({
  companyId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  dateKey: { type: String, required: true },
  currentMessages: { type: Number, default: 0 },
  currentSuccessMessages: { type: Number, default: 0 },
  Objectives: [DailyObjectiveSchema],
  Completed: { type: Boolean, default: false },
  QuestSeen: { type: Boolean, default: true },
  NotificationCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

DailyQuestProgressSchema.index({ companyId: 1, userId: 1, dateKey: 1 }, { unique: true });

export const DailyQuestProgress = (mongoose.models && (mongoose.models.DailyQuestProgress as mongoose.Model<IDailyQuestProgress>)) || mongoose.model<IDailyQuestProgress>('DailyQuestProgress', DailyQuestProgressSchema);


