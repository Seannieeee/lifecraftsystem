import { supabase } from './supabase';

export interface ParticipantStats {
  id: string;
  full_name: string;
  email: string;
  role: string;
  points: number;
  rank: string;
  created_at: string;
  modulesCompleted: number;
  totalModules: number;
  drillsCompleted: number;
  completionRate: number;
}

export interface AdminDashboardStats {
  totalParticipants: number;
  totalModules: number;
  totalDrills: number;
  avgCompletionRate: number;
  totalCertifiedDrills?: number;
  activeUsers7d?: number;
  totalCertifications?: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  user_name: string;
  created_at: string;
  details?: string;
}

export interface DrillStats {
  id: string;
  title: string;
  type: string;
  date?: string;
  time?: string;
  location?: string;
  registered?: number;
  capacity?: number;
  avgScore: number;
}

export interface CertifiedDrill {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  instructor: string;
  completedParticipants: CompletedParticipant[];
}

export interface CompletedParticipant {
  id: string;
  user_id: string;
  drill_id: string;
  full_name: string;
  email: string;
  completed_at: string;
  certificate_url?: string;
}

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  try {
    const { count: totalParticipants } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'admin');

    const { count: totalModules } = await supabase
      .from('modules')
      .select('*', { count: 'exact', head: true });

    const { count: totalDrills } = await supabase
      .from('drills')
      .select('*', { count: 'exact', head: true });

    const { data: completionData } = await supabase
      .from('user_modules')
      .select('completed');

    const completedCount = completionData?.filter(m => m.completed).length || 0;
    const totalAttempts = completionData?.length || 1;
    const avgCompletionRate = Math.round((completedCount / totalAttempts) * 100);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeUsersData } = await supabase
      .from('activity_log')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());

    const activeUsers7d = new Set(activeUsersData?.map(a => a.user_id)).size;

    const { count: totalCertifications } = await supabase
      .from('user_modules')
      .select('*', { count: 'exact', head: true })
      .eq('completed', true);

    const { count: totalCertifiedDrills } = await supabase
      .from('drills')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'Physical')
      .not('date', 'is', null);

    return {
      totalParticipants: totalParticipants || 0,
      totalModules: totalModules || 0,
      totalDrills: totalDrills || 0,
      avgCompletionRate,
      activeUsers7d,
      totalCertifications: totalCertifications || 0,
      totalCertifiedDrills: totalCertifiedDrills || 0
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return {
      totalParticipants: 0,
      totalModules: 0,
      totalDrills: 0,
      avgCompletionRate: 0,
      activeUsers7d: 0,
      totalCertifications: 0,
      totalCertifiedDrills: 0
    };
  }
}

export async function getAllParticipants(): Promise<ParticipantStats[]> {
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    if (!profiles) return [];

    const participantsWithStats = await Promise.all(
      profiles.map(async (profile) => {
        const { count: totalModules } = await supabase
          .from('modules')
          .select('*', { count: 'exact', head: true });

        const { count: completedModules } = await supabase
          .from('user_modules')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('completed', true);

        const { data: completedDrills } = await supabase
          .from('user_drills')
          .select('drill_id')
          .eq('user_id', profile.id)
          .eq('status', 'completed');

        const uniqueDrills = new Set(completedDrills?.map(d => d.drill_id));

        const modulesCompleted = completedModules || 0;
        const total = totalModules || 1;
        const completionRate = Math.round((modulesCompleted / total) * 100);

        return {
          id: profile.id,
          full_name: profile.full_name || 'Unknown',
          email: profile.email,
          role: profile.role,
          points: profile.points || 0,
          rank: profile.rank || 'Beginner',
          created_at: profile.created_at,
          modulesCompleted,
          totalModules: total,
          drillsCompleted: uniqueDrills.size,
          completionRate
        };
      })
    );

    return participantsWithStats;
  } catch (error) {
    console.error('Error getting participants:', error);
    return [];
  }
}

export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  try {
    const { data } = await supabase
      .from('activity_log')
      .select(`
        id,
        action,
        item,
        points,
        created_at,
        user_id,
        profiles!activity_log_user_id_fkey (
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map(activity => ({
      id: activity.id,
      action: activity.action,
      user_name: (activity.profiles as any)?.full_name || 'Unknown User',
      created_at: activity.created_at,
      details: activity.item || undefined
    }));
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
}

export async function getDrillStatistics(): Promise<DrillStats[]> {
  try {
    const { data: drills } = await supabase
      .from('drills')
      .select('*')
      .order('created_at', { ascending: false });

    if (!drills) return [];

    const drillsWithStats = await Promise.all(
      drills.map(async (drill) => {
        const { count: registered } = await supabase
          .from('user_drills')
          .select('*', { count: 'exact', head: true })
          .eq('drill_id', drill.id)
          .in('status', ['pending', 'approved', 'completed']);

        let avgScore = 0;
        if (drill.type === 'Virtual') {
          const { data: scores } = await supabase
            .from('user_drills')
            .select('score')
            .eq('drill_id', drill.id)
            .eq('status', 'completed')
            .not('score', 'is', null);

          if (scores && scores.length > 0) {
            const total = scores.reduce((sum, s) => sum + (s.score || 0), 0);
            avgScore = Math.round(total / scores.length);
          }
        }

        return {
          id: drill.id,
          title: drill.title,
          type: drill.type,
          date: drill.date,
          time: drill.time,
          location: drill.location,
          registered: registered || 0,
          capacity: drill.capacity,
          avgScore
        };
      })
    );

    return drillsWithStats;
  } catch (error) {
    console.error('Error getting drill statistics:', error);
    return [];
  }
}

export async function getPerformanceMetrics() {
  try {
    const { data: moduleScores } = await supabase
      .from('user_modules')
      .select('score')
      .not('score', 'is', null);

    const avgModuleScore = moduleScores && moduleScores.length > 0
      ? Math.round(moduleScores.reduce((sum, m) => sum + (m.score || 0), 0) / moduleScores.length)
      : 0;

    const { data: drillScores } = await supabase
      .from('user_drills')
      .select('score')
      .eq('status', 'completed')
      .not('score', 'is', null);

    const avgDrillScore = drillScores && drillScores.length > 0
      ? Math.round(drillScores.reduce((sum, d) => sum + (d.score || 0), 0) / drillScores.length)
      : 0;

    return {
      avgModuleScore,
      avgDrillScore
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return {
      avgModuleScore: 0,
      avgDrillScore: 0
    };
  }
}

export async function searchParticipants(query: string): Promise<ParticipantStats[]> {
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'admin')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!profiles) return [];

    const participantsWithStats = await Promise.all(
      profiles.map(async (profile) => {
        const { count: totalModules } = await supabase
          .from('modules')
          .select('*', { count: 'exact', head: true });

        const { count: completedModules } = await supabase
          .from('user_modules')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('completed', true);

        const { data: completedDrills } = await supabase
          .from('user_drills')
          .select('drill_id')
          .eq('user_id', profile.id)
          .eq('status', 'completed');

        const uniqueDrills = new Set(completedDrills?.map(d => d.drill_id));

        const modulesCompleted = completedModules || 0;
        const total = totalModules || 1;
        const completionRate = Math.round((modulesCompleted / total) * 100);

        return {
          id: profile.id,
          full_name: profile.full_name || 'Unknown',
          email: profile.email,
          role: profile.role,
          points: profile.points || 0,
          rank: profile.rank || 'Beginner',
          created_at: profile.created_at,
          modulesCompleted,
          totalModules: total,
          drillsCompleted: uniqueDrills.size,
          completionRate
        };
      })
    );

    return participantsWithStats;
  } catch (error) {
    console.error('Error searching participants:', error);
    return [];
  }
}

/**
 * Get all physical drills with completed participants
 */
export async function getCertifiedDrills(): Promise<CertifiedDrill[]> {
  try {
    const { data: drills } = await supabase
      .from('drills')
      .select('*')
      .eq('type', 'Physical')
      .not('date', 'is', null)
      .order('date', { ascending: false });

    if (!drills) return [];

    const drillsWithParticipants = await Promise.all(
      drills.map(async (drill) => {
        const { data: completedUsers } = await supabase
          .from('user_drills')
          .select(`
            id,
            user_id,
            drill_id,
            completed_at,
            certificate_url,
            profiles!user_drills_user_id_fkey (
              full_name,
              email
            )
          `)
          .eq('drill_id', drill.id)
          .eq('status', 'completed')
          .not('completed_at', 'is', null);

        const completedParticipants: CompletedParticipant[] = (completedUsers || []).map((user: any) => ({
          id: user.id,
          user_id: user.user_id,
          drill_id: user.drill_id,
          full_name: user.profiles?.full_name || 'Unknown',
          email: user.profiles?.email || 'No email',
          completed_at: user.completed_at,
          certificate_url: user.certificate_url
        }));

        return {
          id: drill.id,
          title: drill.title,
          date: drill.date,
          time: drill.time || 'Not specified',
          location: drill.location || 'Not specified',
          instructor: drill.instructor || 'LifeCraft Instructor',
          completedParticipants
        };
      })
    );

    return drillsWithParticipants.filter(d => d.completedParticipants.length > 0);
  } catch (error) {
    console.error('Error getting certified drills:', error);
    return [];
  }
}

/**
 * Store certificate URL (data URI) after generation - MOBILE COMPATIBLE
 * This function now stores base64 data URIs instead of blob URLs
 */
export async function storeCertificateUrl(
  userDrillId: string,
  certificateDataUri: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_drills')
      .update({ certificate_url: certificateDataUri })
      .eq('id', userDrillId);

    if (error) {
      console.error('Error storing certificate data URI:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error storing certificate data URI:', error);
    return false;
  }
}

/**
 * NEW FUNCTION: Send email notification when certificate is awarded
 */
export async function sendCompletionNotification(
  email: string,
  fullName: string,
  drillTitle: string,
  drillDate?: string,
  drillLocation?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/send-completion-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        fullName,
        drillTitle,
        drillDate,
        drillLocation
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Failed to send notification:', data.error);
      return { success: false, error: data.error || 'Failed to send notification' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending completion notification:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}