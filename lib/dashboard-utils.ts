import { supabase } from './supabase';

export interface DashboardStats {
  completedModules: number;
  totalModules: number;
  totalPoints: number;
  badges: string[];
  recentActivity: Activity[];
}

export interface Activity {
  id: string;
  action: string;
  item: string;
  points: number;
  created_at: string;
}

export interface UserCertificate {
  id: string;
  drill_id?: string;
  session_id?: string;
  drill_title?: string;
  session_title?: string;
  drill_date?: string;
  session_date?: string;
  drill_time?: string;
  session_time?: string;
  drill_location?: string;
  session_location?: string;
  instructor: string;
  organization: string;
  certificate_url?: string;
  completed_at: string;
  type?: 'drill' | 'session';
}

// Helper functions to get certificate data
export const getCertificateTitle = (cert: UserCertificate): string => {
  return cert.drill_title || cert.session_title || 'Untitled Certificate';
};

export const getCertificateDate = (cert: UserCertificate): string => {
  return cert.drill_date || cert.session_date || cert.completed_at;
};

export const getCertificateTime = (cert: UserCertificate): string => {
  return cert.drill_time || cert.session_time || 'Not specified';
};

export const getCertificateLocation = (cert: UserCertificate): string => {
  return cert.drill_location || cert.session_location || 'Not specified';
};

/**
 * Download certificate from data URI stored in database (mobile compatible)
 * Works on all devices including iOS and Android
 */
export function downloadCertificateFromDataUri(
  certificateDataUri: string,
  userName: string,
  sessionTitle: string
): void {
  try {
    // Generate filename
    const sanitizedTitle = sessionTitle.replace(/[^a-z0-9]/gi, '_');
    const sanitizedName = userName.replace(/[^a-z0-9]/gi, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `LifeCraft_Certificate_${sanitizedName}_${sanitizedTitle}_${dateStr}.pdf`;
    
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = certificateDataUri;
    link.download = filename;
    
    // For iOS Safari compatibility
    link.setAttribute('target', '_blank');
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading certificate:', error);
    throw new Error('Failed to download certificate. Please try again.');
  }
}

/**
 * Fetch REAL badges from Redis via API (NEW FUNCTION)
 */
async function fetchUserBadges(userId: string): Promise<string[]> {
  try {
    console.log(`[Dashboard Utils] Fetching badges for user: ${userId}`);
    
    const response = await fetch(
      `/api/get-badges?userId=${userId}`,
      { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      console.error('[Dashboard Utils] Failed to fetch badges from API:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    console.log(`[Dashboard Utils] Fetched ${data.badges?.length || 0} badges for user: ${userId}`);
    return data.badges || [];
  } catch (error) {
    console.error('[Dashboard Utils] Error fetching badges:', error);
    return [];
  }
}

/**
 * Fetch optimized dashboard data for a user with REAL badges
 */
export async function fetchDashboardData(userId: string): Promise<DashboardStats> {
  try {
    console.log(`[Dashboard Utils] Fetching dashboard data for user: ${userId}`);
    
    const completedCountPromise = supabase
      .from('user_modules')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true)
      .then(result => {
        if (result.error) {
          console.error('[Dashboard Utils] Error fetching completed modules:', result.error);
          return { count: 0, error: result.error };
        }
        return result;
      });

    const totalModulesCountPromise = supabase
      .from('modules')
      .select('id', { count: 'exact', head: true })
      .then(result => {
        if (result.error) {
          console.error('[Dashboard Utils] Error fetching total modules:', result.error);
          return { count: 0, error: result.error };
        }
        return result;
      });

    const activitiesPromise = supabase
      .from('activity_log')
      .select('id, action, item, points, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(result => {
        if (result.error) {
          console.error('[Dashboard Utils] Error fetching activities:', result.error);
          return { data: [], error: result.error };
        }
        return result;
      });

    const profilePromise = supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single()
      .then(result => {
        if (result.error) {
          console.error('[Dashboard Utils] Error fetching profile:', result.error);
          return { data: { points: 0 }, error: result.error };
        }
        return result;
      });

    // Fetch REAL badges from Redis/Supabase via API
    const badgesPromise = fetchUserBadges(userId);

    const [
      completedCount,
      totalModulesCount,
      activitiesResult,
      profileResult,
      badges
    ] = await Promise.all([
      completedCountPromise,
      totalModulesCountPromise,
      activitiesPromise,
      profilePromise,
      badgesPromise
    ]);

    // Extract values with error handling
    const completedModulesCount = completedCount.count || 0;
    const totalModules = totalModulesCount.count || 0;
    const points = profileResult.data?.points || 0;
    const activities = activitiesResult.data || [];

    console.log(`[Dashboard Utils] Results - Modules: ${completedModulesCount}/${totalModules}, Points: ${points}, Real Badges: ${badges.length}`);

    return {
      completedModules: completedModulesCount,
      totalModules,
      totalPoints: points,
      badges, // REAL badges from Redis/Supabase via API
      recentActivity: activities
    };
  } catch (error) {
    console.error('❌ [Dashboard Utils] Error fetching dashboard data:', error);
    return {
      completedModules: 0,
      totalModules: 0,
      totalPoints: 0,
      badges: [], // Empty array instead of calculated badges
      recentActivity: []
    };
  }
}

/**
 * Fetch user certificates from completed physical drills AND certified community sessions
 * Only returns certificates for drills/sessions that have been marked as completed
 */
export async function fetchUserCertificates(userId: string): Promise<UserCertificate[]> {
  try {
    const certificates: UserCertificate[] = [];

    // First, get drill certificates
    const { data: userDrills, error: drillsError } = await supabase
      .from('user_drills')
      .select(`
        id,
        drill_id,
        completed_at,
        certificate_url,
        drills!inner (
          id,
          title,
          type,
          date,
          time,
          location
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (drillsError) {
      console.error('Error fetching user certificates:', drillsError);
    }

    if (userDrills && userDrills.length > 0) {
      // Filter for physical drills with dates
      const physicalDrills = userDrills.filter(
        (drill: any) => drill.drills?.type === 'Physical' && drill.drills?.date
      );

      // Get instructor info separately for each drill
      const drillCertificates: UserCertificate[] = await Promise.all(
        physicalDrills.map(async (drill: any) => {
          // Try to get instructor from drills table
          const { data: drillData } = await supabase
            .from('drills')
            .select('instructor')
            .eq('id', drill.drill_id)
            .single();

          return {
            id: drill.id,
            type: 'drill' as const,
            drill_id: drill.drill_id,
            drill_title: drill.drills.title,
            drill_date: drill.drills.date,
            drill_time: drill.drills.time || 'Not specified',
            drill_location: drill.drills.location || 'Not specified',
            instructor: drillData?.instructor || 'LifeCraft Instructor',
            organization: 'LifeCraft',
            certificate_url: drill.certificate_url,
            completed_at: drill.completed_at
          };
        })
      );

      certificates.push(...drillCertificates);
    }

    // Now add community session certificates
    const { data: userSessions, error: sessionsError } = await supabase
      .from('user_community_sessions')
      .select(`
        id,
        session_id,
        completed_at,
        certificate_url,
        community_sessions!inner (
          id,
          title,
          certified,
          date,
          time,
          location,
          instructor,
          organization
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching session certificates:', sessionsError);
    }

    if (userSessions && userSessions.length > 0) {
      const certifiedSessions = userSessions.filter(
        (session: any) => session.community_sessions?.certified === true
      );

      const sessionCertificates: UserCertificate[] = certifiedSessions.map((session: any) => ({
        id: session.id,
        type: 'session' as const,
        session_id: session.session_id,
        session_title: session.community_sessions.title,
        session_date: session.community_sessions.date,
        session_time: session.community_sessions.time || 'Not specified',
        session_location: session.community_sessions.location || 'Not specified',
        instructor: session.community_sessions.instructor || 'Community Instructor',
        organization: session.community_sessions.organization || 'LifeCraft Community',
        certificate_url: session.certificate_url,
        completed_at: session.completed_at
      }));

      certificates.push(...sessionCertificates);
    }

    // Sort by completion date
    certificates.sort((a, b) => 
      new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );

    return certificates;
  } catch (error) {
    console.error('Error fetching user certificates:', error);
    return [];
  }
}

export async function logActivity(
  userId: string,
  action: string,
  item: string,
  points: number = 0
): Promise<void> {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert([{
        user_id: userId,
        action,
        item,
        points
      }]);

    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

export async function updateUserPoints(
  userId: string,
  pointsToAdd: number
): Promise<void> {
  try {
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching profile for points update:', fetchError);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ points: (profile.points || 0) + pointsToAdd })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating points:', updateError);
    }
  } catch (error) {
    console.error('Error updating user points:', error);
  }
}

export function getRankInfo(points: number) {
  if (points < 500) {
    return { 
      current: 'Beginner', 
      next: 'Responder', 
      nextPoints: 500,
      level: 1 
    };
  }
  if (points < 1000) {
    return { 
      current: 'Responder', 
      next: 'Emergency Responder', 
      nextPoints: 1000,
      level: 2 
    };
  }
  if (points < 2000) {
    return { 
      current: 'Emergency Responder', 
      next: 'Disaster Specialist', 
      nextPoints: 2000,
      level: 3 
    };
  }
  if (points < 5000) {
    return { 
      current: 'Disaster Specialist', 
      next: 'Master Coordinator', 
      nextPoints: 5000,
      level: 4 
    };
  }
  return { 
    current: 'Master Coordinator', 
    next: 'Max Level', 
    nextPoints: 5000,
    level: 5 
  };
}

export function getTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  } catch (error) {
    return 'Recently';
  }
}

export function getActivityIcon(action: string): string {
  try {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('completed') || actionLower.includes('finished')) return '✅';
    if (actionLower.includes('badge') || actionLower.includes('achievement')) return '🏆';
    if (actionLower.includes('drill') || actionLower.includes('practice')) return '🎯';
    if (actionLower.includes('training') || actionLower.includes('session')) return '📚';
    if (actionLower.includes('registered') || actionLower.includes('joined')) return '📝';
    if (actionLower.includes('certificate') || actionLower.includes('certification')) return '🎓';
    
    return '📋';
  } catch (error) {
    return '📋';
  }
}

export function getCertificateTypeColor(type?: 'drill' | 'session'): string {
  return type === 'drill' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200';
}

export function getCertificateTypeLabel(type?: 'drill' | 'session'): string {
  return type === 'drill' ? 'Physical Drill' : 'Community Session';
}