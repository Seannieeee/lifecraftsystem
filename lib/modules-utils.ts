import { supabase } from './supabase';

/**
 * Start a module - creates a user_modules entry
 */
export async function startModule(userId: string, moduleId: string): Promise<void> {
  try {
    if (!userId || !moduleId) {
      throw new Error('User ID and Module ID are required');
    }

    // Check if record already exists
    const { data: existing } = await supabase
      .from('user_modules')
      .select('id')
      .eq('user_id', userId)
      .eq('module_id', moduleId)
      .maybeSingle();

    // Only insert if doesn't exist
    if (!existing) {
      await supabase
        .from('user_modules')
        .insert({
          user_id: userId,
          module_id: moduleId,
          completed: false,
          score: null,
          last_lesson_index: 0,
          completed_at: null
        });

      // Log activity
      const { data: module } = await supabase
        .from('modules')
        .select('title')
        .eq('id', moduleId)
        .single();

      if (module) {
        await supabase
          .from('activity_log')
          .insert({
            user_id: userId,
            action: 'Started Module',
            item: module.title,
            points: 0
          });
      }
    }
  } catch (error) {
    console.error('Error starting module:', error);
    throw error;
  }
}

/**
 * Complete a module - updates user_modules and awards points
 */
export async function completeModule(
  userId: string,
  moduleId: string,
  score: number = 100
): Promise<void> {
  try {
    if (!userId || !moduleId) {
      throw new Error('User ID and Module ID are required');
    }

    // Get module information
    const { data: module, error: moduleError } = await supabase
      .from('modules')
      .select('title, points')
      .eq('id', moduleId)
      .single();

    if (moduleError) throw moduleError;
    if (!module) throw new Error('Module not found');

    // Check if already completed
    const { data: existingProgress } = await supabase
      .from('user_modules')
      .select('completed, id')
      .eq('user_id', userId)
      .eq('module_id', moduleId)
      .maybeSingle();

    const alreadyCompleted = existingProgress?.completed;

    // Update or insert user_modules
    if (existingProgress) {
      await supabase
        .from('user_modules')
        .update({
          completed: true,
          score: score,
          completed_at: new Date().toISOString()
        })
        .eq('id', existingProgress.id);
    } else {
      await supabase
        .from('user_modules')
        .insert({
          user_id: userId,
          module_id: moduleId,
          completed: true,
          score: score,
          last_lesson_index: 0,
          completed_at: new Date().toISOString()
        });
    }

    // Only award points if not previously completed and score >= 50
    if (!alreadyCompleted && score >= 50) {
      // Get current points
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Update points
      const newPoints = (profile.points || 0) + module.points;
      await supabase
        .from('profiles')
        .update({ 
          points: newPoints,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Update rank based on new points
      await updateUserRank(userId, newPoints);

      // Log activity (check if not already logged)
      const { data: existingLog } = await supabase
        .from('activity_log')
        .select('id')
        .eq('user_id', userId)
        .eq('action', 'Completed Module')
        .eq('item', module.title)
        .maybeSingle();

      if (!existingLog) {
        await supabase
          .from('activity_log')
          .insert({
            user_id: userId,
            action: 'Completed Module',
            item: module.title,
            points: module.points
          });
      }

      // Check for badge achievements
      await checkAndAwardBadges(userId);
    }
  } catch (error) {
    console.error('Error completing module:', error);
    throw error;
  }
}

/**
 * Update user rank based on points
 */
async function updateUserRank(userId: string, points: number): Promise<void> {
  try {
    let newRank = 'Beginner';
    
    if (points >= 5000) newRank = 'Master Coordinator';
    else if (points >= 2000) newRank = 'Disaster Specialist';
    else if (points >= 1000) newRank = 'Emergency Responder';
    else if (points >= 500) newRank = 'Responder';

    await supabase
      .from('profiles')
      .update({ rank: newRank })
      .eq('id', userId);
  } catch (error) {
    console.error('Error updating rank:', error);
  }
}

/**
 * Check and award badges based on achievements
 */
async function checkAndAwardBadges(userId: string): Promise<void> {
  try {
    if (!userId) return;

    // Get completed modules count
    const { data: completedModules, error: modulesError } = await supabase
      .from('user_modules')
      .select('module_id')
      .eq('user_id', userId)
      .eq('completed', true);

    if (modulesError) throw modulesError;

    const completedCount = completedModules?.length || 0;

    // Get user points
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const points = profile.points || 0;

    // Award badges based on milestones
    const badges: { badge: string; threshold: number; type: 'modules' | 'points' }[] = [
      { badge: 'First Steps', threshold: 1, type: 'modules' },
      { badge: 'Learning Enthusiast', threshold: 3, type: 'modules' },
      { badge: 'Knowledge Seeker', threshold: 5, type: 'modules' },
      { badge: 'Expert Learner', threshold: 8, type: 'modules' },
      { badge: 'Rising Star', threshold: 500, type: 'points' },
      { badge: 'Dedicated Responder', threshold: 1000, type: 'points' },
      { badge: 'Elite Specialist', threshold: 2000, type: 'points' }
    ];

    for (const { badge, threshold, type } of badges) {
      const value = type === 'modules' ? completedCount : points;
      
      if (value >= threshold) {
        // Check if badge already awarded
        const { data: existingBadge } = await supabase
          .from('activity_log')
          .select('id')
          .eq('user_id', userId)
          .eq('action', 'Earned Badge')
          .eq('item', badge)
          .maybeSingle();

        if (!existingBadge) {
          // Award badge
          await supabase
            .from('activity_log')
            .insert({
              user_id: userId,
              action: 'Earned Badge',
              item: badge,
              points: 50
            });

          // Add bonus points for badge
          await supabase
            .from('profiles')
            .update({ 
              points: points + 50,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
        }
      }
    }
  } catch (error) {
    console.error('Error checking badges:', error);
  }
}

/**
 * Get user's module progress with proper calculation
 */
export async function getUserModuleProgress(userId: string, moduleId: string) {
  try {
    if (!userId || !moduleId) {
      return null;
    }

    // Get all lessons for this module
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id')
      .eq('module_id', moduleId);

    if (lessonsError) {
      console.error('Error fetching lessons for module:', moduleId, lessonsError);
      return null;
    }

    const totalLessons = lessons?.length || 0;

    if (totalLessons === 0) {
      return {
        progress: 0,
        completed_lessons: 0,
        total_lessons: 0,
        average_score: 0,
        completed: false,
        final_score: null
      };
    }

    // Get completed lessons with attempts > 0
    const { data: completedLessons, error: progressError } = await supabase
      .from('user_lesson_progress')
      .select('lesson_id, quiz_score, attempts')
      .eq('user_id', userId)
      .in('lesson_id', lessons?.map(l => l.id) || []);

    if (progressError) {
      console.error('Error fetching lesson progress for user:', userId, 'module:', moduleId, progressError);
    }

    // Only count lessons with at least 1 attempt
    const lessonsWithAttempts = completedLessons?.filter(l => l.attempts > 0) || [];
    const completedCount = lessonsWithAttempts.length;
    const progressPercentage = Math.round((completedCount / totalLessons) * 100);

    // Calculate average score from lessons with attempts
    let averageScore = 0;
    if (lessonsWithAttempts.length > 0) {
      const totalScore = lessonsWithAttempts.reduce((sum, lesson) => sum + (lesson.quiz_score || 0), 0);
      averageScore = Math.round(totalScore / lessonsWithAttempts.length);
    }

    // Get module completion status
    const { data: moduleData, error: moduleError } = await supabase
      .from('user_modules')
      .select('completed, score')
      .eq('user_id', userId)
      .eq('module_id', moduleId)
      .maybeSingle();

    if (moduleError) {
      console.error('Error fetching module completion for user:', userId, 'module:', moduleId, moduleError);
    }

    return {
      progress: progressPercentage,
      completed_lessons: completedCount,
      total_lessons: totalLessons,
      average_score: averageScore,
      completed: moduleData?.completed || false,
      final_score: moduleData?.score || null
    };
  } catch (error) {
    console.error('Error in getUserModuleProgress:', error);
    return null;
  }
}

/**
 * Get all users who completed a specific module with their scores
 * This is the key function for admin view
 */
export async function getModuleCompletedUsers(moduleId: string) {
  try {
    if (!moduleId) {
      return [];
    }

    // Query user_modules with a join to profiles
    // Note: Supabase returns the joined table as an object, not an array
    const { data, error } = await supabase
      .from('user_modules')
      .select(`
        user_id,
        score,
        completed_at,
        profiles (
          full_name,
          email
        )
      `)
      .eq('module_id', moduleId)
      .eq('completed', true)
      .order('score', { ascending: false });

    if (error) {
      console.error('Error fetching completed users for module:', moduleId, error);
      return [];
    }

    // Transform the data - profiles is an object (not array) in the response
    return (data || []).map((item: any) => ({
      user_id: item.user_id,
      score: item.score || 0,
      completed_at: item.completed_at,
      full_name: item.profiles?.full_name || 'Unknown User',
      email: item.profiles?.email || 'No email'
    }));
  } catch (error) {
    console.error('Error in getModuleCompletedUsers:', error);
    return [];
  }
}

/**
 * Get all user's completed modules
 */
export async function getUserCompletedModules(userId: string) {
  try {
    if (!userId) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_modules')
      .select(`
        *,
        modules (*)
      `)
      .eq('user_id', userId)
      .eq('completed', true)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Error getting completed modules:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting completed modules:', error);
    return [];
  }
}

/**
 * Reset module progress (for testing)
 */
export async function resetModuleProgress(userId: string, moduleId: string): Promise<void> {
  try {
    if (!userId || !moduleId) {
      throw new Error('User ID and Module ID are required');
    }

    await supabase
      .from('user_modules')
      .delete()
      .eq('user_id', userId)
      .eq('module_id', moduleId);
  } catch (error) {
    console.error('Error resetting module progress:', error);
    throw error;
  }
}

/**
 * Update module (admin only)
 */
export async function updateModule(moduleId: string, moduleData: Partial<{
  title: string;
  description: string;
  category: string;
  difficulty: string;
  duration: string;
  points: number;
  lessons: number;
  locked: boolean;
}>): Promise<void> {
  try {
    console.log('Updating module', moduleId, 'with data:', moduleData);
    
    const { error } = await supabase
      .from('modules')
      .update(moduleData)
      .eq('id', moduleId);

    if (error) {
      console.error('Supabase error updating module:', error);
      throw new Error(`Failed to update module: ${error.message}`);
    }
    
    console.log('Module updated successfully');
  } catch (error) {
    console.error('Error in updateModule:', error);
    throw error;
  }
}

/**
 * Delete module (admin only)
 */
export async function deleteModule(moduleId: string): Promise<void> {
  try {
    console.log('Deleting module:', moduleId);
    
    // Get all lessons for this module first
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('module_id', moduleId);

    const lessonIds = lessons?.map(l => l.id) || [];

    // Delete all user lesson progress for this module's lessons
    if (lessonIds.length > 0) {
      const { error: deleteProgressError } = await supabase
        .from('user_lesson_progress')
        .delete()
        .in('lesson_id', lessonIds);

      if (deleteProgressError) {
        console.warn('Error deleting lesson progress:', deleteProgressError);
        // Continue anyway
      }
    }

    // Delete all user module progress
    const { error: deleteUserModulesError } = await supabase
      .from('user_modules')
      .delete()
      .eq('module_id', moduleId);

    if (deleteUserModulesError) {
      console.error('Error deleting user modules:', deleteUserModulesError);
      throw new Error(`Failed to delete user progress: ${deleteUserModulesError.message}`);
    }

    // Delete all lessons for this module
    const { error: deleteLessonsError } = await supabase
      .from('lessons')
      .delete()
      .eq('module_id', moduleId);

    if (deleteLessonsError) {
      console.error('Error deleting lessons:', deleteLessonsError);
      throw new Error(`Failed to delete lessons: ${deleteLessonsError.message}`);
    }

    // Then delete the module itself
    const { error } = await supabase
      .from('modules')
      .delete()
      .eq('id', moduleId);

    if (error) {
      console.error('Supabase error deleting module:', error);
      throw new Error(`Failed to delete module: ${error.message}`);
    }
    
    console.log('Module deleted successfully');
  } catch (error) {
    console.error('Error in deleteModule:', error);
    throw error;
  }
}