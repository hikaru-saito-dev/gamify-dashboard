import mongoose, { Schema, Document } from 'mongoose';

export interface IWeeklyObjectiveProgress {
  objectiveId: string;
  messageCount: number;
  successMessageCount: number;
  xpReward: number;
  order: number;
  completed: boolean;
  claimed: boolean;
}

export interface IWeeklyQuestProgress extends Document {
  companyId: string;
  userId: string;
  weekKey: string;
  currentMessages: number;
  currentSuccessMessages: number;
  Objectives: IWeeklyObjectiveProgress[];
  Completed: boolean;
  QuestSeen: boolean;
  NotificationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WeeklyObjectiveSchema = new Schema<IWeeklyObjectiveProgress>({
  objectiveId: { type: String, required: true },
  xpReward: { type: Number, required: true },
  order: { type: Number, required: true },
  completed: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  messageCount: { type: Number, required: true },
  successMessageCount: { type: Number, required: true },
});

const WeeklyQuestProgressSchema = new Schema<IWeeklyQuestProgress>({
  companyId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  weekKey: { type: String, required: true },
  currentMessages: { type: Number, default: 0 },
  currentSuccessMessages: { type: Number, default: 0 },
  Objectives: [WeeklyObjectiveSchema],
  Completed: { type: Boolean, default: false },
  QuestSeen: { type: Boolean, default: true },
  NotificationCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

WeeklyQuestProgressSchema.index({ companyId: 1, userId: 1, weekKey: 1 }, { unique: true });

export const WeeklyQuestProgress = (mongoose.models && (mongoose.models.WeeklyQuestProgress as mongoose.Model<IWeeklyQuestProgress>)) || mongoose.model<IWeeklyQuestProgress>('WeeklyQuestProgress', WeeklyQuestProgressSchema);


