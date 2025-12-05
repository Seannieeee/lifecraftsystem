import { supabase } from './supabase';

export interface DrillWithUserStatus {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration: string;
  participants: string;
  points: number;
  date?: string;
  time?: string;
  location?: string;
  capacity?: number;
  userDrill?: {
    id: string;
    status: string;
    score?: number | null;
    completion_time?: string | null;
  } | null;
}

export interface UserDrillStats {
  drillsCompleted: number;
  averageScore: number;
  scheduled: number;
}

export interface PerformanceRecord {
  id: string;
  user_id: string;
  drill_id: string;
  status: string;
  score: number | null;
  completion_time: string | null;
  completed_at: string | null;
  started_at: string | null;
  drills?: {
    title: string;
  } | null;
}

/**
 * Check if user has completed at least one module
 */
export async function hasCompletedModule(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_modules')
      .select('id')
      .eq('user_id', userId)
      .eq('completed', true)
      .limit(1);

    if (error) throw error;
    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('Error checking module completion:', error);
    return false;
  }
}

/**
 * Get all drills with user's status
 */
export async function getDrillsWithUserStatus(userId: string): Promise<DrillWithUserStatus[]> {
  try {
    // Get all drills
    const { data: drills, error: drillsError } = await supabase
      .from('drills')
      .select('*')
      .order('created_at', { ascending: false });

    if (drillsError) throw drillsError;

    // Get user's drill records
    const { data: userDrills, error: userDrillsError } = await supabase
      .from('user_drills')
      .select('*')
      .eq('user_id', userId);

    if (userDrillsError) throw userDrillsError;

    // Combine the data
    return (drills || []).map(drill => {
      // Find the best completed drill for this user
      const userDrillRecords = (userDrills || []).filter(ud => ud.drill_id === drill.id);
      const completedDrills = userDrillRecords.filter(ud => ud.status === 'completed');
      
      let bestUserDrill = null;
      if (completedDrills.length > 0) {
        // Find the one with the highest score
        bestUserDrill = completedDrills.reduce((best, current) => {
          if (!best) return current;
          return (current.score || 0) > (best.score || 0) ? current : best;
        }, completedDrills[0]);
      } else {
        // If no completed drills, check for in-progress, pending, or approved
        bestUserDrill = userDrillRecords[0] || null;
      }

      return {
        ...drill,
        userDrill: bestUserDrill ? {
          id: bestUserDrill.id,
          status: bestUserDrill.status,
          score: bestUserDrill.score,
          completion_time: bestUserDrill.completion_time
        } : null
      };
    });
  } catch (error) {
    console.error('Error getting drills with user status:', error);
    throw error;
  }
}

/**
 * Start a virtual drill
 */
export async function startVirtualDrill(userId: string, drillId: string) {
  try {
    // Check if user has completed at least one module
    const hasCompleted = await hasCompletedModule(userId);
    if (!hasCompleted) {
      throw new Error('You must complete at least one module before accessing drills.');
    }

    // Check if a user_drill record already exists for this user and drill
    const { data: existingDrill, error: fetchError } = await supabase
      .from('user_drills')
      .select('*')
      .eq('user_id', userId)
      .eq('drill_id', drillId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    // If a record exists, update it to in_progress
    if (existingDrill) {
      const { data, error: updateError } = await supabase
        .from('user_drills')
        .update({
          status: 'in_progress'
        })
        .eq('id', existingDrill.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return data;
    }

    // Otherwise, create a new record
    const { data, error } = await supabase
      .from('user_drills')
      .insert({
        user_id: userId,
        drill_id: drillId,
        status: 'in_progress'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error starting virtual drill:', error);
    throw error;
  }
}

/**
 * Complete a virtual drill
 * @param isRetry - If true, won't award points
 */
export async function completeVirtualDrill(
  userId: string,
  drillId: string,
  score: number,
  completionTime: string,
  isRetry: boolean = false
) {
  try {
    // Check if user has completed at least one module
    const hasCompleted = await hasCompletedModule(userId);
    if (!hasCompleted) {
      throw new Error('You must complete at least one module before accessing drills.');
    }

    // Get the in-progress user_drill record
    const { data: userDrills, error: fetchError } = await supabase
      .from('user_drills')
      .select('*')
      .eq('user_id', userId)
      .eq('drill_id', drillId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!userDrills || userDrills.length === 0) {
      throw new Error('No in-progress drill found');
    }

    const userDrill = userDrills[0];
    const previousScore = typeof userDrill.score === 'number' ? userDrill.score : 0;
    
    // Only update score if new score is better than previous score
    const shouldUpdateScore = score > previousScore;
    const finalScore = shouldUpdateScore ? score : previousScore;
    
    // Always update completion time if it's faster, or if there's no previous time
    const shouldUpdateTime = !userDrill.completion_time || completionTime < userDrill.completion_time;
    const finalTime = shouldUpdateTime ? completionTime : userDrill.completion_time;

    // Update the user_drill record
    const { error: updateError } = await supabase
      .from('user_drills')
      .update({
        status: 'completed',
        score: finalScore,
        completion_time: finalTime,
        completed_at: new Date().toISOString()
      })
      .eq('id', userDrill.id);

    if (updateError) throw updateError;

    // Only award points if it's not a retry AND the score improved
    if (!isRetry && shouldUpdateScore) {
      console.log('=== AWARDING POINTS ===');
      console.log('Is retry:', isRetry);
      console.log('Should update score:', shouldUpdateScore);
      console.log('New score:', score);
      console.log('Previous score:', previousScore);
      
      // Get drill points
      const { data: drill, error: drillError } = await supabase
        .from('drills')
        .select('points')
        .eq('id', drillId)
        .single();

      if (drillError) throw drillError;

      console.log('Drill points from DB:', drill.points);

      // Calculate points based on score
      const pointsEarned = Math.round((drill.points || 0) * (score / 100));
      console.log('Points earned calculation:', `${drill.points} * (${score} / 100) = ${pointsEarned}`);

      // Update user points
      const { data: profile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', userId)
        .single();

      if (profileFetchError) throw profileFetchError;

      console.log('Current user points:', profile.points);
      console.log('New user points:', (profile.points || 0) + pointsEarned);

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ points: (profile.points || 0) + pointsEarned })
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('Error updating profile points:', profileUpdateError);
        throw profileUpdateError;
      }

      console.log('Points awarded successfully!');

      // Try to log activity (optional - won't fail if permissions are missing)
      try {
        await supabase
          .from('activity_log')
          .insert({
            user_id: userId,
            action: 'Completed drill',
            item: `${drillId}`,
            points: pointsEarned
          });
        console.log('Activity logged successfully');
      } catch (logError) {
        console.warn('Activity log failed (non-critical):', logError);
      }
      
      console.log('======================');
    } else {
      console.log('=== NOT AWARDING POINTS ===');
      console.log('Is retry:', isRetry);
      console.log('Should update score:', shouldUpdateScore);
      console.log('New score:', score);
      console.log('Previous score:', previousScore);
      console.log('===========================');
    }
  } catch (error) {
    console.error('Error completing virtual drill:', error);
    throw error;
  }
}

/**
 * Register for a physical drill
 */
export async function registerForPhysicalDrill(userId: string, drillId: string) {
  try {
    // Check if user has completed at least one module
    const hasCompleted = await hasCompletedModule(userId);
    if (!hasCompleted) {
      throw new Error('You must complete at least one module before registering for drills.');
    }

    // Check if a registration already exists
    const { data: existingReg, error: checkError } = await supabase
      .from('user_drills')
      .select('id, status')
      .eq('user_id', userId)
      .eq('drill_id', drillId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing registration:', checkError);
      throw new Error('Failed to check registration status. Please try again.');
    }

    if (existingReg) {
      if (existingReg.status === 'pending') {
        throw new Error('You have already registered for this drill and your registration is pending approval.');
      } else if (existingReg.status === 'approved') {
        throw new Error('You have already been approved for this drill.');
      } else if (existingReg.status === 'completed') {
        throw new Error('You have already completed this drill.');
      } else if (existingReg.status === 'declined') {
        throw new Error('Your previous registration for this drill was declined. Please contact an administrator.');
      } else {
        throw new Error('You have already registered for this drill.');
      }
    }

    // Check if drill exists
    const { data: drill, error: drillError } = await supabase
      .from('drills')
      .select('id, title, type')
      .eq('id', drillId)
      .single();

    if (drillError || !drill) {
      console.error('Error fetching drill:', drillError);
      throw new Error('Drill not found.');
    }

    if (drill.type !== 'Physical') {
      throw new Error('This registration is only for physical drills.');
    }
    
    const { data, error } = await supabase
      .from('user_drills')
      .insert({
        user_id: userId,
        drill_id: drillId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating registration:', error);
      
      // Handle specific error codes
      if (error.code === '23505') {
        throw new Error('You have already registered for this drill.');
      }
      
      if (error.code === '42501') {
        throw new Error('Permission denied. Please make sure you are logged in.');
      }

      if (error.code === '23514') {
        throw new Error('Invalid registration status. Please contact support.');
      }
      
      throw new Error(`Failed to register: ${error.message || 'Unknown error'}`);
    }

    // Try to log activity (optional - won't fail if permissions are missing)
    try {
      await supabase
        .from('activity_log')
        .insert({
          user_id: userId,
          action: 'Registered for drill',
          item: drillId,
          points: 0
        });
    } catch (logError) {
      console.warn('Activity log failed (non-critical):', logError);
    }

    return data;
  } catch (error: any) {
    console.error('Error registering for physical drill:', error);
    throw error;
  }
}

/**
 * Get user drill statistics
 */
export async function getUserDrillStats(userId: string): Promise<UserDrillStats> {
  try {
    const { data: userDrills, error } = await supabase
      .from('user_drills')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    // Count unique completed drills
    const completedDrills = userDrills?.filter(ud => ud.status === 'completed') || [];
    const uniqueCompletedDrills = new Set(completedDrills.map(ud => ud.drill_id));
    
    // Calculate average score from best scores per drill
    const bestScoresByDrill = completedDrills.reduce<Record<string, number>>((acc, drill) => {
      const drillId = drill.drill_id;
      const score = typeof drill.score === 'number' ? drill.score : 0;
      const currentBest = acc[drillId];
      
      if (currentBest === undefined || score > currentBest) {
        acc[drillId] = score;
      }
      return acc;
    }, {});
    
    const scores = Object.values(bestScoresByDrill);
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;

    const scheduled = userDrills?.filter(ud => ud.status === 'pending' || ud.status === 'approved').length || 0;

    return {
      drillsCompleted: uniqueCompletedDrills.size,
      averageScore,
      scheduled
    };
  } catch (error) {
    console.error('Error getting user drill stats:', error);
    throw error;
  }
}

/**
 * Get user performance history
 */
export async function getUserPerformanceHistory(userId: string): Promise<PerformanceRecord[]> {
  try {
    const { data, error } = await supabase
      .from('user_drills')
      .select(`
        *,
        drills (
          title
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PerformanceRecord[];
  } catch (error) {
    console.error('Error getting user performance history:', error);
    throw error;
  }
}

/**
 * Get all drill registrations for admin (physical drills only)
 */
export async function getAllDrillRegistrations() {
  try {
    const { data, error } = await supabase
      .from('user_drills')
      .select(`
        id,
        user_id,
        drill_id,
        status,
        created_at,
        completed_at,
        profiles!user_drills_user_id_fkey (
          full_name,
          email
        ),
        drills!user_drills_drill_id_fkey (
          title,
          date,
          time,
          location,
          type
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching drill registrations:', error);
      throw new Error('Failed to load registrations. Please try again later.');
    }

    // Filter only physical drill registrations
    const physicalDrillRegistrations = (data || []).filter(
      (reg: any) => {
        return reg.drills?.type === 'Physical' && 
               (reg.status === 'pending' || reg.status === 'approved' || reg.status === 'declined' || reg.status === 'completed');
      }
    );

    return physicalDrillRegistrations;
  } catch (error) {
    console.error('Error in getAllDrillRegistrations:', error);
    return [];
  }
}

/**
 * Update drill registration status (admin only)
 */
export async function updateDrillRegistrationStatus(
  registrationId: string,
  status: 'approved' | 'declined'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_drills')
      .update({ status })
      .eq('id', registrationId);

    if (error) {
      console.error('Error updating drill registration status:', error);
      throw new Error('Failed to update registration. Please try again later.');
    }
  } catch (error) {
    console.error('Error in updateDrillRegistrationStatus:', error);
    throw error;
  }
}

/**
 * Mark physical drill as completed (admin only)
 */
export async function markPhysicalDrillComplete(
  registrationId: string,
  userId: string,
  drillId: string
): Promise<void> {
  try {
    // Update the user_drill record to completed
    const { error: updateError } = await supabase
      .from('user_drills')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('Error marking drill as complete:', updateError);
      throw new Error('Failed to mark drill as complete. Please try again later.');
    }

    // Try to log activity (optional - won't fail if permissions are missing)
    try {
      await supabase
        .from('activity_log')
        .insert({
          user_id: userId,
          action: 'Completed physical drill',
          item: drillId,
          points: 0
        });
      console.log('Activity logged successfully');
    } catch (logError) {
      // Silently fail on activity log errors (permission issues are common)
      console.warn('Activity log failed (non-critical):', logError);
    }
  } catch (error) {
    console.error('Error in markPhysicalDrillComplete:', error);
    throw error;
  }
}

/**
 * Create new drill (admin only)
 */
export async function createDrill(drillData: {
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration: string;
  participants: string;
  points: number;
  location?: string;
  date?: string;
  time?: string;
  instructor?: string;
}, pages?: any[]): Promise<void> {
  try {
    console.log('Creating drill with data:', drillData);
    
    const { data: drill, error } = await supabase
      .from('drills')
      .insert(drillData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating drill:', error);
      throw new Error(`Failed to create drill: ${error.message}`);
    }
    
    console.log('Drill created successfully:', drill);

    // If there are pages and this is a virtual drill, save them
    if (pages && pages.length > 0 && drill && drillData.type === 'Virtual') {
      console.log('Saving drill content pages:', pages);
      
      const drillContent = pages.map((page, index) => ({
        drill_id: drill.id,
        step_number: index + 1,
        step_title: page.title,
        step_description: page.content,
        step_type: page.type,
        content: {
          question: page.question || null,
          options: page.options || null,
          correctAnswer: typeof page.correctAnswer === 'number' ? page.correctAnswer : null,
          explanation: page.explanation || null
        },
        points: typeof page.points === 'number' ? page.points : 0
      }));

      console.log('Formatted drill content:', drillContent);

      const { error: contentError } = await supabase
        .from('drill_content')
        .insert(drillContent);

      if (contentError) {
        console.error('Error saving drill content:', contentError);
        // Don't throw error, drill is already created
      } else {
        console.log('Drill content saved successfully');
      }
    }
  } catch (error) {
    console.error('Error in createDrill:', error);
    throw error;
  }
}

/**
 * Update drill (admin only)
 */
export async function updateDrill(drillId: string, drillData: Partial<{
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration: string;
  participants: string;
  points: number;
  location?: string;
  date?: string;
  time?: string;
  instructor?: string;
}>, pages?: any[]): Promise<void> {
  try {
    console.log('Updating drill with data:', drillData);
    
    const { error } = await supabase
      .from('drills')
      .update(drillData)
      .eq('id', drillId);

    if (error) {
      console.error('Supabase error updating drill:', error);
      throw new Error(`Failed to update drill: ${error.message}`);
    }
    
    console.log('Drill updated successfully');

    // If there are pages and this is a virtual drill, update them
    if (pages && drillData.type === 'Virtual') {
      console.log('Updating drill content pages:', pages);
      
      // Delete existing content
      await supabase
        .from('drill_content')
        .delete()
        .eq('drill_id', drillId);

      // Insert new content
      if (pages.length > 0) {
        const drillContent = pages.map((page, index) => ({
          drill_id: drillId,
          step_number: index + 1,
          step_title: page.title,
          step_description: page.content,
          step_type: page.type,
          content: {
            question: page.question || null,
            options: page.options || null,
            correctAnswer: typeof page.correctAnswer === 'number' ? page.correctAnswer : null,
            explanation: page.explanation || null
          },
          points: typeof page.points === 'number' ? page.points : 0
        }));

        console.log('Formatted drill content:', drillContent);

        const { error: contentError } = await supabase
          .from('drill_content')
          .insert(drillContent);

        if (contentError) {
          console.error('Error saving drill content:', contentError);
        } else {
          console.log('Drill content updated successfully');
        }
      }
    }
  } catch (error) {
    console.error('Error in updateDrill:', error);
    throw error;
  }
}

/**
 * Delete drill (admin only)
 */
export async function deleteDrill(drillId: string): Promise<void> {
  try {
    // First delete all user drill records for this drill
    const { error: deleteUserDrillsError } = await supabase
      .from('user_drills')
      .delete()
      .eq('drill_id', drillId);

    if (deleteUserDrillsError) {
      console.error('Error deleting user drill records:', deleteUserDrillsError);
      throw new Error('Failed to delete drill registrations.');
    }

    // Delete all drill attempts
    const { error: deleteAttemptsError } = await supabase
      .from('drill_attempts')
      .delete()
      .eq('user_drill_id', drillId);

    if (deleteAttemptsError) {
      console.warn('Error deleting drill attempts:', deleteAttemptsError);
      // Continue anyway
    }

    // Delete all drill content
    const { error: deleteContentError } = await supabase
      .from('drill_content')
      .delete()
      .eq('drill_id', drillId);

    if (deleteContentError) {
      console.warn('Error deleting drill content:', deleteContentError);
      // Continue anyway
    }

    // Then delete the drill itself
    const { error } = await supabase
      .from('drills')
      .delete()
      .eq('id', drillId);

    if (error) {
      console.error('Error deleting drill:', error);
      throw new Error('Failed to delete drill. Please try again later.');
    }
  } catch (error) {
    console.error('Error in deleteDrill:', error);
    throw error;
  }
}

/**
 * Get drill content pages
 */
export async function getDrillContent(drillId: string) {
  try {
    const { data, error } = await supabase
      .from('drill_content')
      .select('*')
      .eq('drill_id', drillId)
      .order('step_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting drill content:', error);
    return [];
  }
}