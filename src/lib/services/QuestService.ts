import { DailyQuestProgress, IDailyQuestProgress, IDailyObjectiveProgress } from '@/models/DailyQuestProgress';
import { WeeklyQuestProgress, IWeeklyQuestProgress, IWeeklyObjectiveProgress } from '@/models/WeeklyQuestProgress';
import { QuestConfigService } from './QuestConfigService';
import { IQuestObjective } from '@/models/Quest';
import connectDB from '@/lib/mongodb';

interface QuestObjective {
  id: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  xp: number;
  order: number;
}

export class QuestService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  // Ensure quests are initialized for this company
  private async ensureQuestsInitialized(): Promise<void> {
    try {
      await connectDB();
      const questConfigService = new QuestConfigService(this.companyId);
      await questConfigService.initializeDefaultQuests();
    } catch (error) {
      console.error('Error ensuring quests are initialized:', error);
    }
  }

  // Update quest progress for a message
  async updateProgress(userId: string, isSuccessMessage: boolean = false): Promise<{
    dailyProgress?: IDailyQuestProgress;
    weeklyProgress?: IWeeklyQuestProgress;
    completedObjectives?: string[];
  }> {
    try {
      await connectDB();
      const now = new Date();
      const dateKey = this.getDateKey(now);
      const weekKey = this.getWeekKey(now);

      const completedObjectives: string[] = [];

      // Update daily progress
      const dailyProgress = await this.updateDailyProgress(userId, dateKey, isSuccessMessage);

      // Update weekly progress
      const weeklyProgress = await this.updateWeeklyProgress(userId, weekKey, isSuccessMessage);

      return {
        dailyProgress,
        weeklyProgress,
        completedObjectives,
      };
    } catch (error) {
      console.error('Error updating quest progress:', error);
      return {};
    }
  }

  // Update daily quest progress
  private async updateDailyProgress(userId: string, dateKey: string, isSuccessMessage: boolean): Promise<IDailyQuestProgress> {
    // Ensure quests are initialized and get config
    await this.ensureQuestsInitialized();
    const questConfigService = new QuestConfigService(this.companyId);
    const dailyQuests = await questConfigService.getQuestsByType('daily');
    const dailyQuest = dailyQuests[0];

    let progress = await DailyQuestProgress.findOne({ companyId: this.companyId, userId, dateKey });

    if (!progress) {
      const objectives = dailyQuest ? dailyQuest.objectives.map(obj => ({
        objectiveId: obj.id,
        messageCount: obj.messageCount,
        successMessageCount: obj.successMessageCount,
        xpReward: obj.xpReward,
        order: obj.order,
        completed: false,
        claimed: false,
      })) : [];

      progress = await DailyQuestProgress.findOneAndUpdate(
        { companyId: this.companyId, userId, dateKey },
        {
          $setOnInsert: {
            companyId: this.companyId,
            userId,
            dateKey,
            currentMessages: 0,
            currentSuccessMessages: 0,
            Objectives: objectives,
            Completed: false,
            QuestSeen: true,
            NotificationCount: 0,
          }
        },
        { upsert: true, new: true }
      );
    }

    if (!progress) {
      // As a fallback, fetch again to satisfy TS non-null
      progress = await DailyQuestProgress.findOne({ companyId: this.companyId, userId, dateKey });
      if (!progress) throw new Error('Failed to upsert daily quest progress');
    }

    // Increment totals
    if (!isSuccessMessage) progress.currentMessages += 1;
    if (isSuccessMessage) progress.currentSuccessMessages += 1;
    await this.checkObjectiveCompletionDaily(progress);
    await progress.save();
    return progress;
  }

  // Update weekly quest progress
  private async updateWeeklyProgress(userId: string, weekKey: string, isSuccessMessage: boolean): Promise<IWeeklyQuestProgress> {
    // Ensure quests are initialized and get config
    await this.ensureQuestsInitialized();
    const questConfigService = new QuestConfigService(this.companyId);
    const weeklyQuests = await questConfigService.getQuestsByType('weekly');
    const weeklyQuest = weeklyQuests[0];

    let progress = await WeeklyQuestProgress.findOne({ companyId: this.companyId, userId, weekKey });
    if (!progress) {
      const objectives = weeklyQuest ? weeklyQuest.objectives.map(obj => ({
        objectiveId: obj.id,
        messageCount: obj.messageCount,
        successMessageCount: obj.successMessageCount,
        xpReward: obj.xpReward,
        order: obj.order,
        completed: false,
        claimed: false,
      })) : [];

      progress = await WeeklyQuestProgress.findOneAndUpdate(
        { companyId: this.companyId, userId, weekKey },
        {
          $setOnInsert: {
            companyId: this.companyId,
            userId,
            weekKey,
            currentMessages: 0,
            currentSuccessMessages: 0,
            Objectives: objectives,
            Completed: false,
            QuestSeen: true,
            NotificationCount: 0,
          }
        },
        { upsert: true, new: true }
      );
    }

    if (!progress) {
      progress = await WeeklyQuestProgress.findOne({ companyId: this.companyId, userId, weekKey });
      if (!progress) throw new Error('Failed to upsert weekly quest progress');
    }

    if (!isSuccessMessage) progress.currentMessages += 1;
    if (isSuccessMessage) progress.currentSuccessMessages += 1;
    await this.checkObjectiveCompletionWeekly(progress);
    await progress.save();
    return progress;
  }

  // Check objective completion
  private async checkObjectiveCompletionDaily(progress: IDailyQuestProgress): Promise<void> {
    let questCompleted = false;
    for (const objective of progress.Objectives) {
      if (objective.completed) continue;

      let isCompleted = false;
      if (objective.messageCount > 0) {
        isCompleted = (progress.currentMessages || 0) >= objective.messageCount;
      } else if (objective.successMessageCount > 0) {
        isCompleted = (progress.currentSuccessMessages || 0) >= objective.successMessageCount;
      }

      if (isCompleted) {
        objective.completed = true;
        questCompleted = true;
      }
    }
    if (questCompleted) {
      progress.QuestSeen = false;
    }
  }

  private async checkObjectiveCompletionWeekly(progress: IWeeklyQuestProgress): Promise<void> {
    let questCompleted = false;
    for (const objective of progress.Objectives) {
      if (objective.completed) continue;

      let isCompleted = false;
      if (objective.messageCount > 0) {
        isCompleted = (progress.currentMessages || 0) >= objective.messageCount;
      } else if (objective.successMessageCount > 0) {
        isCompleted = (progress.currentSuccessMessages || 0) >= objective.successMessageCount;
      }

      if (isCompleted) {
        objective.completed = true;
        questCompleted = true;
      }
    }
    if (questCompleted) {
      progress.QuestSeen = false;
    }
  }

  // Claim a sequential objective
  async claimObjective(userId: string, objectiveId: string): Promise<{
    success: boolean;
    error?: string;
    xp: number;
  }> {
    try {
      await connectDB();
      const now = new Date();
      const dateKey = this.getDateKey(now);

      // Ensure quests are initialized for this company
      await this.ensureQuestsInitialized();
      
      // Get quest configuration
      const questConfigService = new QuestConfigService(this.companyId);
      const allQuests = await questConfigService.getAllQuests();
      
      let objective: IQuestObjective | null = null;
      let questType: 'daily' | 'weekly' | null = null;

      for (const quest of allQuests) {
        const foundObjective = quest.objectives.find(obj => obj.id === objectiveId);
        if (foundObjective) {
          objective = foundObjective;
          questType = quest.questType;
          break;
        }
      }

      if (!objective || !questType) {
        return { success: false, error: 'Objective not found', xp: 0 };
      }

      if (questType === 'daily') {
        const progress = await DailyQuestProgress.findOne({ companyId: this.companyId, userId, dateKey });
        if (!progress) return { success: false, error: 'Quest progress not found', xp: 0 };
        const objectiveProgress = progress.Objectives.find((obj: IDailyObjectiveProgress) => obj.objectiveId === objectiveId);
        if (!objectiveProgress) return { success: false, error: 'Objective progress not found', xp: 0 };
        if (!objectiveProgress.completed) return { success: false, error: 'Objective not completed yet', xp: 0 };
        if (objectiveProgress.claimed) return { success: false, error: 'Objective already claimed', xp: 0 };
        objectiveProgress.claimed = true;
        await progress.save();
        return { success: true, xp: objective.xpReward };
      } else {
        const weekKey = this.getWeekKey(now);
        const progress = await WeeklyQuestProgress.findOne({ companyId: this.companyId, userId, weekKey });
        if (!progress) return { success: false, error: 'Quest progress not found', xp: 0 };
        const objectiveProgress = progress.Objectives.find((obj: IWeeklyObjectiveProgress) => obj.objectiveId === objectiveId);
        if (!objectiveProgress) return { success: false, error: 'Objective progress not found', xp: 0 };
        if (!objectiveProgress.completed) return { success: false, error: 'Objective not completed yet', xp: 0 };
        if (objectiveProgress.claimed) return { success: false, error: 'Objective already claimed', xp: 0 };
        objectiveProgress.claimed = true;
        await progress.save();
        return { success: true, xp: objective.xpReward };
      }
    } catch (error) {
      console.error('Error claiming objective:', error);
      return { success: false, error: 'Internal server error', xp: 0 };
    }
  }

  // Get user's quest progress
  async getUserProgress(userId: string): Promise<{
    daily: {
      msgCount: number;
      successMsgCount: number;
      objectives: Array<{
        id: string;
        title: string;
        description: string;
        progress: number;
        target: number;
        completed: boolean;
        claimed: boolean;
        xp: number;
        order: number;
      }>;
      questSeen: boolean;
      notificationCount: number;
    };
    weekly: {
      msgCount: number;
      successMsgCount: number;
      objectives: Array<{
        id: string;
        title: string;
        description: string;
        progress: number;
        target: number;
        completed: boolean;
        claimed: boolean;
        xp: number;
        order: number;
      }>;
      questSeen: boolean;
      notificationCount: number;
    };
  }> {
    try {
      await connectDB();
      const now = new Date();
      const dateKey = this.getDateKey(now);
      const weekKey = this.getWeekKey(now);
      let dailyDoc = await DailyQuestProgress.findOne({ companyId: this.companyId, userId, dateKey });
      let weeklyDoc = await WeeklyQuestProgress.findOne({ companyId: this.companyId, userId, weekKey });

      // Ensure quests are initialized for this company
      await this.ensureQuestsInitialized();
      
      // Get quest configurations
      const questConfigService = new QuestConfigService(this.companyId);
      const dailyQuests = await questConfigService.getQuestsByType('daily');
      const weeklyQuests = await questConfigService.getQuestsByType('weekly');

      const dailyQuest = dailyQuests[0] || null;
      const weeklyQuest = weeklyQuests[0] || null;


      // Initialize progress if it doesn't exist
      if (!dailyDoc) {
        const dailyObjectives = dailyQuest ? dailyQuest.objectives.map(obj => ({
          objectiveId: obj.id,
          messageCount: obj.messageCount,
          successMessageCount: obj.successMessageCount,
          xpReward: obj.xpReward,
          order: obj.order,
          currentMessages: 0,
          currentSuccessMessages: 0,
          completed: false,
          claimed: false,
        })) : [];
        dailyDoc = new DailyQuestProgress({
          companyId: this.companyId,
          userId,
          dateKey,
          currentMessages: 0,
          currentSuccessMessages: 0,
          Objectives: dailyObjectives,
          Completed: false,
          QuestSeen: true,
          NotificationCount: 0,
        });
        await dailyDoc.save();
      }

      if (!weeklyDoc) {
        const weeklyObjectives = weeklyQuest ? weeklyQuest.objectives.map(obj => ({
          objectiveId: obj.id,
          messageCount: obj.messageCount,
          successMessageCount: obj.successMessageCount,
          xpReward: obj.xpReward,
          order: obj.order,
          currentMessages: 0,
          currentSuccessMessages: 0,
          completed: false,
          claimed: false,
        })) : [];
        weeklyDoc = new WeeklyQuestProgress({
          companyId: this.companyId,
          userId,
          weekKey,
          currentMessages: 0,
          currentSuccessMessages: 0,
          Objectives: weeklyObjectives,
          Completed: false,
          QuestSeen: true,
          NotificationCount: 0,
        });
        await weeklyDoc.save();
      }

      if (dailyQuest && weeklyQuest) {
        // Run migration to sync with latest quest configurations
        await this.migrateQuestProgress();

        // Check for completed objectives before building the response
        await this.checkObjectiveCompletionDaily(dailyDoc);
        await this.checkObjectiveCompletionWeekly(weeklyDoc);
        await dailyDoc.save();
        await weeklyDoc.save();

        // Build daily objectives
        const dailyObjectives = dailyQuest.objectives
          .sort((a: IQuestObjective, b: IQuestObjective) => a.order - b.order)
          .map((objective: IQuestObjective) => {
            const objectiveProgress = dailyDoc.Objectives.find((obj: IDailyObjectiveProgress) => obj.objectiveId === objective.id);
            const current = objective.messageCount > 0 ? (dailyDoc.currentMessages || 0) : (dailyDoc.currentSuccessMessages || 0);
            const target = objective.messageCount > 0 ? objective.messageCount : objective.successMessageCount;

            // Generate title and description based on objective type
            const isSuccessObjective = objective.successMessageCount > 0;
            const title = isSuccessObjective 
              ? `Send ${objective.successMessageCount} Success Message${objective.successMessageCount > 1 ? 's' : ''}`
              : `Send ${objective.messageCount} Message${objective.messageCount > 1 ? 's' : ''}`;
            const description = isSuccessObjective
              ? `Send ${objective.successMessageCount} message${objective.successMessageCount > 1 ? 's' : ''} in success channels`
              : `Send ${objective.messageCount} message${objective.messageCount > 1 ? 's' : ''} in any channel`;

            return {
              id: objective.id,
              title,
              description,
              progress: Math.min(current, target),
              target,
              completed: objectiveProgress?.completed || false,
              claimed: objectiveProgress?.claimed || false,
              xp: objective.xpReward,
              order: objective.order,
            };
          });

        // Build weekly objectives
        const weeklyObjectives = weeklyQuest.objectives
          .sort((a: IQuestObjective, b: IQuestObjective) => a.order - b.order)
          .map((objective: IQuestObjective) => {
            const objectiveProgress = weeklyDoc.Objectives.find((obj: IWeeklyObjectiveProgress) => obj.objectiveId === objective.id);
            const current = objective.messageCount > 0 ? (weeklyDoc.currentMessages || 0) : (weeklyDoc.currentSuccessMessages || 0);
            const target = objective.messageCount > 0 ? objective.messageCount : objective.successMessageCount;

            // Generate title and description based on objective type
            const isSuccessObjective = objective.successMessageCount > 0;
            const title = isSuccessObjective 
              ? `Send ${objective.successMessageCount} Success Message${objective.successMessageCount > 1 ? 's' : ''}`
              : `Send ${objective.messageCount} Message${objective.messageCount > 1 ? 's' : ''}`;
            const description = isSuccessObjective
              ? `Send ${objective.successMessageCount} message${objective.successMessageCount > 1 ? 's' : ''} in success channels`
              : `Send ${objective.messageCount} message${objective.messageCount > 1 ? 's' : ''} in any channel`;

            return {
              id: objective.id,
              title,
              description,
              progress: Math.min(current, target),
              target,
              completed: objectiveProgress?.completed || false,
              claimed: objectiveProgress?.claimed || false,
              xp: objective.xpReward,
              order: objective.order,
            };
          });

        // Calculate notification counts
        const dailyNotificationCount = dailyObjectives.filter((obj: QuestObjective) => obj.completed && !obj.claimed).length;
        const weeklyNotificationCount = weeklyObjectives.filter((obj: QuestObjective) => obj.completed && !obj.claimed).length;

        return {
          daily: {
            msgCount: dailyObjectives.reduce((sum, o) => sum + o.progress, 0),
            successMsgCount: dailyObjectives.reduce((sum, o) => sum + o.progress, 0),
            objectives: dailyObjectives,
            questSeen: dailyDoc.QuestSeen ?? false,
            notificationCount: dailyNotificationCount
          },
          weekly: {
            msgCount: weeklyObjectives.reduce((sum, o) => sum + o.progress, 0),
            successMsgCount: weeklyObjectives.reduce((sum, o) => sum + o.progress, 0),
            objectives: weeklyObjectives,
            questSeen: weeklyDoc.QuestSeen ?? false,
            notificationCount: weeklyNotificationCount
          }
        };
      }

      // Return empty progress if no quest configurations
      return {
        daily: {
          msgCount: 0,
          successMsgCount: 0,
          objectives: [],
          questSeen: false,
          notificationCount: 0
        },
        weekly: {
          msgCount: 0,
          successMsgCount: 0,
          objectives: [],
          questSeen: false,
          notificationCount: 0
        }
      };
    } catch (error) {
      console.error('Error getting user progress:', error);
      return {
        daily: {
          msgCount: 0,
          successMsgCount: 0,
          objectives: [],
          questSeen: false,
          notificationCount: 0
        },
        weekly: {
          msgCount: 0,
          successMsgCount: 0,
          objectives: [],
          questSeen: false,
          notificationCount: 0
        }
      };
    }
  }

  // Mark quests as seen
  async markQuestSeen(userId: string, questType: 'daily' | 'weekly'): Promise<boolean> {
    try {
      await connectDB();
      const now = new Date();
      const dateKey = this.getDateKey(now);
      const weekKey = this.getWeekKey(now);

      if (questType === 'daily') {
        const doc = await DailyQuestProgress.findOne({ companyId: this.companyId, userId, dateKey });
        if (!doc) return false;
        doc.QuestSeen = true;
        await doc.save();
        return true;
      } else {
        const doc = await WeeklyQuestProgress.findOne({ companyId: this.companyId, userId, weekKey });
        if (!doc) return false;
        doc.QuestSeen = true;
        await doc.save();
        return true;
      }
    } catch (error) {
      console.error('Error marking quest as seen:', error);
      return false;
    }
  }

  // Get date key (YYYY-MM-DD) in New York timezone
  private getDateKey(date: Date): string {
    // Convert to New York timezone for consistent quest dates
    const nyDate = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return nyDate.toISOString().split('T')[0];
  }

  // Get week key (YYYY-WW) in New York timezone using ISO 8601
  private getWeekKey(date: Date): string {
    // Get NY timezone date string and parse components
    const nyDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
    
    const parts = nyDateStr.split('-');
    if (parts.length !== 3) {
      throw new Error(`Invalid date format: ${nyDateStr}`);
    }
    const year = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10);
    const day = parseInt(parts[2]!, 10);
    
    // Create date object for calculations
    const d = new Date(year, month - 1, day);
    
    // ISO 8601: Week starts on Monday, week 1 contains Jan 4
    // Find the Thursday of the current week (ISO weeks are defined by their Thursday)
    const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const thursdayOffset = (4 - dayOfWeek + 7) % 7; // Days to add to get to Thursday
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + thursdayOffset);
    
    // Find January 4th of the year containing the Thursday
    const jan4 = new Date(thursday.getFullYear(), 0, 4);
    const jan4DayOfWeek = jan4.getDay();
    const jan4ThursdayOffset = (4 - jan4DayOfWeek + 7) % 7;
    const firstThursday = new Date(jan4);
    firstThursday.setDate(jan4.getDate() + jan4ThursdayOffset);
    
    // Calculate week number
    const daysDiff = Math.floor((thursday.getTime() - firstThursday.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.floor(daysDiff / 7) + 1;
    
    // Year might be different if week spans year boundary
    const weekYear = thursday.getFullYear();
    
    return `${weekYear}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  // Migrate quest progress when new objectives are added
  async migrateQuestProgress(): Promise<void> {
    try {
      await connectDB();
      
      // Get current quest configurations
      const questConfigService = new QuestConfigService(this.companyId);
      const dailyQuests = await questConfigService.getQuestsByType('daily');
      const weeklyQuests = await questConfigService.getQuestsByType('weekly');
      
      const dailyQuest = dailyQuests[0];
      const weeklyQuest = weeklyQuests[0];
      
      if (!dailyQuest && !weeklyQuest) {
        console.log('No quest configurations found for migration');
        return;
      }

      // Migrate daily collection
      const allDaily = await DailyQuestProgress.find({ companyId: this.companyId });
      console.log(`Found ${allDaily.length} daily quest progress documents to migrate`);
      for (const progress of allDaily) {
        let needsUpdate = false;
        if (dailyQuest) {
          const currentDailyIds = progress.Objectives.map((obj: IDailyObjectiveProgress) => obj.objectiveId);
          
          // Add missing daily objectives
          for (const configObj of dailyQuest.objectives) {
            if (!currentDailyIds.includes(configObj.id)) {
              // Find if there's a similar objective to inherit progress from
              let inheritedMessages = 0;
              let inheritedSuccessMessages = 0;
              
              // Inherit from document totals
              if (configObj.messageCount > 0) {
                inheritedMessages = Math.min(progress.currentMessages || 0, configObj.messageCount);
              }
              if (configObj.successMessageCount > 0) {
                inheritedSuccessMessages = Math.min(progress.currentSuccessMessages || 0, configObj.successMessageCount);
              }
              
              progress.Objectives.push({
                objectiveId: configObj.id,
                messageCount: configObj.messageCount,
                successMessageCount: configObj.successMessageCount,
                xpReward: configObj.xpReward,
                order: configObj.order,
                completed: false,
                claimed: false,
              });
              needsUpdate = true;
              console.log(`Added missing daily objective: ${configObj.id} with inherited progress: ${inheritedMessages}/${configObj.messageCount || configObj.successMessageCount}`);
            }
          }

          // Update existing daily objectives with new values if needed
          for (const progressObj of progress.Objectives) {
            const configObj = dailyQuest.objectives.find(obj => obj.id === progressObj.objectiveId);
            if (configObj) {
              // Update configuration values but preserve progress
              const oldMessageCount = progressObj.messageCount;
              const oldSuccessMessageCount = progressObj.successMessageCount;
              
              if (progressObj.messageCount !== configObj.messageCount || 
                  progressObj.successMessageCount !== configObj.successMessageCount ||
                  progressObj.xpReward !== configObj.xpReward ||
                  progressObj.order !== configObj.order) {
                
                progressObj.messageCount = configObj.messageCount;
                progressObj.successMessageCount = configObj.successMessageCount;
                progressObj.xpReward = configObj.xpReward;
                progressObj.order = configObj.order;
                
                // No per-objective progress stored; totals remain on document
                
                needsUpdate = true;
                console.log(`Updated daily objective: ${progressObj.objectiveId}`);
              }
            }
          }
        }
        if (needsUpdate) {
          await progress.save();
        }
      }

      // Migrate weekly collection
      const allWeekly = await WeeklyQuestProgress.find({ companyId: this.companyId });
      console.log(`Found ${allWeekly.length} weekly quest progress documents to migrate`);
      for (const progress of allWeekly) {
        let needsUpdate = false;
        if (weeklyQuest) {
          const currentWeeklyIds = progress.Objectives.map((obj: IWeeklyObjectiveProgress) => obj.objectiveId);
          
          // Add missing weekly objectives
          for (const configObj of weeklyQuest.objectives) {
            if (!currentWeeklyIds.includes(configObj.id)) {
              // Find if there's a similar objective to inherit progress from
              let inheritedMessages = 0;
              let inheritedSuccessMessages = 0;
              
              // Inherit from document totals
              if (configObj.messageCount > 0) {
                inheritedMessages = Math.min(progress.currentMessages || 0, configObj.messageCount);
              }
              if (configObj.successMessageCount > 0) {
                inheritedSuccessMessages = Math.min(progress.currentSuccessMessages || 0, configObj.successMessageCount);
              }
              
              progress.Objectives.push({
                objectiveId: configObj.id,
                messageCount: configObj.messageCount,
                successMessageCount: configObj.successMessageCount,
                xpReward: configObj.xpReward,
                order: configObj.order,
                completed: false,
                claimed: false,
              });
              needsUpdate = true;
              console.log(`Added missing weekly objective: ${configObj.id} with inherited progress: ${inheritedMessages}/${configObj.messageCount || configObj.successMessageCount}`);
            }
          }

          // Update existing weekly objectives with new values if needed
          for (const progressObj of progress.Objectives) {
            const configObj = weeklyQuest.objectives.find(obj => obj.id === progressObj.objectiveId);
            if (configObj) {
              // Update configuration values but preserve progress
              const oldMessageCount = progressObj.messageCount;
              const oldSuccessMessageCount = progressObj.successMessageCount;
              
              if (progressObj.messageCount !== configObj.messageCount || 
                  progressObj.successMessageCount !== configObj.successMessageCount ||
                  progressObj.xpReward !== configObj.xpReward ||
                  progressObj.order !== configObj.order) {
                
                progressObj.messageCount = configObj.messageCount;
                progressObj.successMessageCount = configObj.successMessageCount;
                progressObj.xpReward = configObj.xpReward;
                progressObj.order = configObj.order;
                
                // No per-objective progress stored; totals remain on document
                
                needsUpdate = true;
                console.log(`Updated weekly objective: ${progressObj.objectiveId}`);
              }
            }
          }
        }
        if (needsUpdate) {
          await progress.save();
          console.log(`Migrated weekly quest progress for user: ${progress.userId}`);
        }
      }
      console.log('Quest progress migration completed');
    } catch (error) {
      console.error('Error migrating quest progress:', error);
    }
  }
}