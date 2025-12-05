import { supabase } from './supabase';

export interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  duration: string | null;
  steps: number;
  type: string | null;
  content?: string | null;
  video_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TutorialProgress {
  id: string;
  user_id: string;
  tutorial_id: string;
  completed: boolean;
  completion_date?: string;
  created_at: string;
}

/**
 * Fetch all first aid tutorials
 */
export async function fetchAllTutorials(): Promise<Tutorial[]> {
  try {
    const { data, error } = await supabase
      .from('first_aid_tutorials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tutorials:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching tutorials:', error);
    return [];
  }
}

/**
 * Fetch a single tutorial by ID with full content
 */
export async function fetchTutorialById(tutorialId: string): Promise<Tutorial | null> {
  try {
    const { data, error } = await supabase
      .from('first_aid_tutorials')
      .select('*')
      .eq('id', tutorialId)
      .single();

    if (error) {
      console.error('Error fetching tutorial:', error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching tutorial:', error);
    return null;
  }
}

/**
 * Search tutorials by title or description
 */
export async function searchTutorials(query: string): Promise<Tutorial[]> {
  try {
    const { data, error } = await supabase
      .from('first_aid_tutorials')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching tutorials:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error searching tutorials:', error);
    return [];
  }
}

/**
 * Filter tutorials by category
 */
export async function fetchTutorialsByCategory(category: string): Promise<Tutorial[]> {
  try {
    const { data, error } = await supabase
      .from('first_aid_tutorials')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tutorials by category:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching tutorials by category:', error);
    return [];
  }
}

/**
 * Get all unique categories
 */
export async function fetchCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('first_aid_tutorials')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
    
    const uniqueCategories = [...new Set(data.map(item => item.category))];
    return uniqueCategories.filter(Boolean) as string[];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

/**
 * Mark tutorial as completed for a user
 */
export async function markTutorialComplete(userId: string, tutorialId: string): Promise<boolean> {
  try {
    // First, check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    const { error } = await supabase
      .from('user_tutorial_progress')
      .upsert({
        user_id: userId,
        tutorial_id: tutorialId,
        completed: true,
        completion_date: new Date().toISOString()
      }, {
        onConflict: 'user_id,tutorial_id'
      });

    if (error) {
      console.error('Error marking tutorial complete:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('Error marking tutorial complete:', error);
    return false;
  }
}

/**
 * Get user's tutorial progress
 */
export async function getUserTutorialProgress(userId: string): Promise<TutorialProgress[]> {
  try {
    // First, check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('user_tutorial_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user progress:', error);
      // Don't throw, just return empty array
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching user progress:', error);
    return [];
  }
}

/**
 * Check if user has completed a specific tutorial
 */
export async function hasCompletedTutorial(userId: string, tutorialId: string): Promise<boolean> {
  try {
    // First, check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    const { data, error } = await supabase
      .from('user_tutorial_progress')
      .select('completed')
      .eq('user_id', userId)
      .eq('tutorial_id', tutorialId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid error on no results

    if (error) {
      console.error('Error checking tutorial completion:', error);
      return false;
    }
    return data?.completed || false;
  } catch (error) {
    console.error('Error checking tutorial completion:', error);
    return false;
  }
}

/**
 * Get tutorial completion statistics for a user
 */
export async function getTutorialStats(userId: string) {
  try {
    // First, check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        completionRate: 0
      };
    }

    const [allTutorials, userProgress] = await Promise.all([
      fetchAllTutorials(),
      getUserTutorialProgress(userId)
    ]);

    const completedCount = userProgress.filter(p => p.completed).length;
    const totalCount = allTutorials.length;
    const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return {
      total: totalCount,
      completed: completedCount,
      inProgress: totalCount - completedCount,
      completionRate: Math.round(completionRate)
    };
  } catch (error) {
    console.error('Error fetching tutorial stats:', error);
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      completionRate: 0
    };
  }
}

/**
 * Get recommended tutorials based on user's progress and difficulty
 */
export async function getRecommendedTutorials(userId: string): Promise<Tutorial[]> {
  try {
    const [allTutorials, userProgress] = await Promise.all([
      fetchAllTutorials(),
      getUserTutorialProgress(userId)
    ]);

    const completedIds = new Set(
      userProgress.filter(p => p.completed).map(p => p.tutorial_id)
    );

    // Filter out completed tutorials and prioritize essential difficulty
    const recommended = allTutorials
      .filter(t => !completedIds.has(t.id))
      .sort((a, b) => {
        // Prioritize Essential difficulty
        if (a.difficulty === 'Essential' && b.difficulty !== 'Essential') return -1;
        if (a.difficulty !== 'Essential' && b.difficulty === 'Essential') return 1;
        return 0;
      })
      .slice(0, 6); // Return top 6 recommendations

    return recommended;
  } catch (error) {
    console.error('Error getting recommended tutorials:', error);
    return [];
  }
}

/**
 * ADMIN FUNCTIONS
 */

/**
 * Create a new tutorial (Admin only)
 */
export async function createTutorial(tutorialData: Omit<Tutorial, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('first_aid_tutorials')
      .insert({
        title: tutorialData.title,
        description: tutorialData.description,
        category: tutorialData.category,
        difficulty: tutorialData.difficulty,
        duration: tutorialData.duration,
        steps: tutorialData.steps,
        type: tutorialData.type,
        content: tutorialData.content,
        video_url: tutorialData.video_url
      });

    if (error) {
      console.error('Error creating tutorial:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('Error creating tutorial:', error);
    return false;
  }
}

/**
 * Update an existing tutorial (Admin only)
 */
export async function updateTutorial(tutorialId: string, tutorialData: Partial<Tutorial>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('first_aid_tutorials')
      .update({
        title: tutorialData.title,
        description: tutorialData.description,
        category: tutorialData.category,
        difficulty: tutorialData.difficulty,
        duration: tutorialData.duration,
        steps: tutorialData.steps,
        type: tutorialData.type,
        content: tutorialData.content,
        video_url: tutorialData.video_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', tutorialId);

    if (error) {
      console.error('Error updating tutorial:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('Error updating tutorial:', error);
    return false;
  }
}

/**
 * Delete a tutorial (Admin only)
 */
export async function deleteTutorial(tutorialId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('first_aid_tutorials')
      .delete()
      .eq('id', tutorialId);

    if (error) {
      console.error('Error deleting tutorial:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('Error deleting tutorial:', error);
    return false;
  }
}
/**
 * Get all users who completed a specific tutorial (Admin only)
 */
export async function getCompletedUsersByTutorial(tutorialId: string): Promise<any[]> {
  try {
    console.log('Fetching completed users for tutorial:', tutorialId);
    
    // Step 1: Get all completed progress records
    const { data: progressData, error: progressError } = await supabase
      .from('user_tutorial_progress')
      .select('*')
      .eq('tutorial_id', tutorialId)
      .eq('completed', true)
      .order('completion_date', { ascending: false });

    if (progressError) {
      console.error('Progress error:', progressError);
      return [];
    }

    if (!progressData || progressData.length === 0) {
      console.log('No completed users found');
      return [];
    }

    console.log('Found progress records:', progressData.length);

    // Step 2: Get user IDs
    const userIds = progressData.map(p => p.user_id);

    // Step 3: Fetch profiles separately
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (profilesError) {
      console.error('Profiles error:', profilesError);
      return [];
    }

    console.log('Found profiles:', profilesData?.length || 0);

    // Step 4: Combine the data manually
    const result = progressData.map(progress => {
      const profile = profilesData?.find(p => p.id === progress.user_id);
      return {
        ...progress,
        profiles: profile || null
      };
    });

    console.log('Final result:', result.length);
    return result;
  } catch (error) {
    console.error('Unexpected error:', error);
    return [];
  }
}

/**
 * Update certificate URL for a user's completed tutorial
 */
export async function updateCertificateUrl(
  userId: string, 
  tutorialId: string, 
  certificateUrl: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_tutorial_progress')
      .update({ certificate_url: certificateUrl })
      .eq('user_id', userId)
      .eq('tutorial_id', tutorialId);

    if (error) {
      console.error('Error updating certificate URL:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('Error updating certificate URL:', error);
    return false;
  }
}