import { Quest, IQuest, IQuestObjective } from '@/models/Quest';
import connectDB from '@/lib/mongodb';

export class QuestConfigService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  // Initialize default quests for a company
  async initializeDefaultQuests(): Promise<boolean> {
    try {
      await connectDB();
      
      // Check if quests already exist
      const existingQuests = await Quest.find({ companyId: this.companyId });
      if (existingQuests.length > 0) {
        return true; // Already initialized
      }

      // Default quest configurations with sequential objectives
      const defaultQuests = [
        {
          questId: 'daily_quest',
          questType: 'daily',
          title: 'Daily Quest',
          description: 'Complete daily objectives in order',
          objectives: [
            {
              id: 'daily_success1',
              messageCount: 0,
              successMessageCount: 1,
              xpReward: 10,
              order: 1,
            },
            {
              id: 'daily_send10',
              messageCount: 10,
              successMessageCount: 0,
              xpReward: 15,
              order: 2,
            },
          ],
          isActive: true,
        },
        {
          questId: 'weekly_quest',
          questType: 'weekly',
          title: 'Weekly Quest',
          description: 'Complete weekly objectives in order',
          objectives: [
            {
              id: 'weekly_send100',
              messageCount: 100,
              successMessageCount: 0,
              xpReward: 15,
              order: 1,
            },
            {
              id: 'weekly_success10',
              messageCount: 0,
              successMessageCount: 10,
              xpReward: 50,
              order: 2,
            },
          ],
          isActive: true,
        },
      ];

      // Create quests with companyId
      const questsToCreate = defaultQuests.map(quest => ({
        ...quest,
        companyId: this.companyId,
      }));

      await Quest.insertMany(questsToCreate);
      return true;
    } catch (error) {
      console.error('Error initializing default quests:', error);
      return false;
    }
  }

  // Get all quests for a company
  async getAllQuests(): Promise<IQuest[]> {
    try {
      await connectDB();
      const quests = await Quest.find({ companyId: this.companyId }).sort({ questType: 1, questId: 1 });
      // Normalize objectives ordering for consumers
      return quests.map((q: IQuest) => ({
        ...q.toObject(),
        objectives: [...q.objectives].sort((a, b) => a.order - b.order),
      })) as unknown as IQuest[];
    } catch (error) {
      console.error('Error getting all quests:', error);
      return [];
    }
  }

  // Get quest by ID
  async getQuestById(questId: string): Promise<IQuest | null> {
    try {
      await connectDB();
      return await Quest.findOne({ companyId: this.companyId, questId });
    } catch (error) {
      console.error('Error getting quest by ID:', error);
      return null;
    }
  }

  // Update quest configuration
  async updateQuest(questId: string, updates: Partial<{
    title: string;
    description: string;
    objectives: IQuestObjective[];
    isActive: boolean;
  }>): Promise<boolean> {
    try {
      await connectDB();
      // Sanitize objectives if provided
      const sanitized: Partial<IQuest> & { objectives?: IQuestObjective[] } = { ...updates } as Partial<IQuest> & { objectives?: IQuestObjective[] };
      if (updates.objectives) {
        const normalizedObjectives: IQuestObjective[] = updates.objectives
          .map((obj, idx) => {
            const msg = Math.max(0, obj.messageCount || 0);
            const suc = Math.max(0, obj.successMessageCount || 0);
            // allow only one type; if both > 0, prefer the greater and zero the other
            let messageCount = msg;
            let successMessageCount = suc;
            if (msg > 0 && suc > 0) {
              if (msg >= suc) successMessageCount = 0; else messageCount = 0;
            }
            return {
              id: obj.id || `objective_${Date.now()}_${idx}`,
              messageCount,
              successMessageCount,
              xpReward: Math.max(0, obj.xpReward || 0),
              order: obj.order && obj.order > 0 ? obj.order : idx + 1,
            } as IQuestObjective;
          })
          .sort((a, b) => a.order - b.order)
          .map((obj, i) => ({ ...obj, order: i + 1 }));
        sanitized.objectives = normalizedObjectives;
      }

      const result = await Quest.findOneAndUpdate(
        { companyId: this.companyId, questId },
        { $set: sanitized },
        { new: true }
      );
      return !!result;
    } catch (error) {
      console.error('Error updating quest:', error);
      return false;
    }
  }

  // Get quests by type
  async getQuestsByType(questType: 'daily' | 'weekly'): Promise<IQuest[]> {
    try {
      await connectDB();
      const quests = await Quest.find({ 
        companyId: this.companyId, 
        questType,
        isActive: true 
      }).sort({ questId: 1 });
      // Ensure objectives sorted by order consistently
      return quests.map((q: IQuest) => ({
        ...q.toObject(),
        objectives: [...q.objectives].sort((a, b) => a.order - b.order),
      })) as unknown as IQuest[];
    } catch (error) {
      console.error('Error getting quests by type:', error);
      return [];
    }
  }
}
