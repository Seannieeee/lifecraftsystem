// ============================================================================
// FILE: community-utils.ts (COMPLETE WITH ALL FIXES)
// ============================================================================

import { supabase } from './supabase';

export interface CommunitySession {
  id: string;
  title: string;
  description: string | null;
  organization: string | null;
  category: string | null;
  level: string | null;
  date: string;
  time: string;
  location: string;
  instructor: string | null;
  capacity: number;
  certified: boolean;
  volunteer: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionWithStats extends CommunitySession {
  registered_count: number;
  available_spots: number;
  user_registration?: {
    id: string;
    status: string;
  } | null;
}

export interface UserSessionRegistration {
  id: string;
  user_id: string;
  session_id: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  certificate_url?: string | null;
  profiles?: {
    full_name?: string;
    email?: string;
    role?: string;
  };
  community_sessions?: {
    title: string;
    date: string;
    time: string;
    location: string;
    organization: string;
    certified?: boolean;
    instructor?: string;
  };
}

/**
 * Get all community sessions with registration stats
 */
export async function getSessionsWithStats(userId?: string): Promise<SessionWithStats[]> {
  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from('community_sessions')
      .select('*')
      .order('date', { ascending: true });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw new Error('Failed to load sessions. Please try again later.');
    }

    const { data: registrations, error: regError } = await supabase
      .from('user_community_sessions')
      .select('session_id, status');

    if (regError) {
      console.warn('Error fetching registrations:', regError);
    }

    let userRegistrations: UserSessionRegistration[] = [];
    if (userId) {
      const { data, error } = await supabase
        .from('user_community_sessions')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.warn('Error fetching user registrations:', error);
      } else if (data) {
        userRegistrations = data;
      }
    }

    return (sessions || []).map(session => {
      // FIXED: Include 'completed' status in registration count
      const sessionRegs = registrations?.filter(
        r => r.session_id === session.id && 
             (r.status === 'registered' || r.status === 'approved' || r.status === 'completed')
      ) || [];
      
      const registered_count = sessionRegs.length;
      const available_spots = Math.max(0, session.capacity - registered_count);
      
      const userReg = userRegistrations.find(r => r.session_id === session.id);

      return {
        ...session,
        registered_count,
        available_spots,
        user_registration: userReg ? {
          id: userReg.id,
          status: userReg.status
        } : null
      };
    });
  } catch (error) {
    console.error('Error in getSessionsWithStats:', error);
    return [];
  }
}

/**
 * Register user for a session
 */
export async function registerForSession(userId: string, sessionId: string): Promise<void> {
  try {
    const { data: existing, error: checkError } = await supabase
      .from('user_community_sessions')
      .select('id, status')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing registration:', checkError);
      throw new Error('Failed to check registration status. Please try again.');
    }

    if (existing) {
      if (existing.status === 'pending') {
        throw new Error('You have already registered for this session and your registration is pending approval.');
      } else if (existing.status === 'registered' || existing.status === 'approved') {
        throw new Error('You have already been approved for this session.');
      } else if (existing.status === 'completed') {
        throw new Error('You have already completed this session.');
      } else if (existing.status === 'declined') {
        throw new Error('Your previous registration for this session was declined. Please contact an administrator.');
      } else {
        throw new Error('You are already registered for this session.');
      }
    }

    const { data: session, error: sessionError } = await supabase
      .from('community_sessions')
      .select('id, capacity, certified, title')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError);
      throw new Error('Session not found.');
    }

    const { count, error: countError } = await supabase
      .from('user_community_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .in('status', ['registered', 'approved', 'pending', 'completed']);

    if (countError) {
      console.error('Error counting registrations:', countError);
    }

    const currentCount = count || 0;
    if (currentCount >= session.capacity) {
      throw new Error('This session is full. Please choose another session.');
    }

    const { error: insertError } = await supabase
      .from('user_community_sessions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        status: 'pending'
      });

    if (insertError) {
      console.error('Error creating registration:', insertError);
      
      if (insertError.code === '23505') {
        throw new Error('You are already registered for this session.');
      }
      
      if (insertError.code === '42501') {
        throw new Error('Permission denied. Please make sure you are logged in.');
      }

      if (insertError.code === '23514') {
        throw new Error('Invalid registration status. Please contact support.');
      }
      
      throw new Error(`Failed to register: ${insertError.message || 'Unknown error'}`);
    }

    try {
      await supabase
        .from('activity_log')
        .insert({
          user_id: userId,
          action: 'Registered for community session',
          item: sessionId,
          points: 0
        });
    } catch (logError) {
      console.warn('Failed to log activity (non-critical):', logError);
    }
  } catch (error) {
    console.error('Error in registerForSession:', error);
    throw error;
  }
}

/**
 * Get all registrations for admin
 */
export async function getAllRegistrations(): Promise<UserSessionRegistration[]> {
  try {
    console.log('Fetching all registrations...');
    
    const { data, error } = await supabase
      .from('user_community_sessions')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email,
          role
        ),
        community_sessions:session_id (
          title,
          date,
          time,
          location,
          organization,
          certified,
          instructor
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all registrations:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to load registrations: ${error.message}`);
    }

    console.log('Registrations fetched successfully:', data?.length || 0);
    console.log('Sample data:', data?.[0]);

    return data || [];
  } catch (error) {
    console.error('Error in getAllRegistrations:', error);
    throw error;
  }
}

/**
 * Update registration status (admin only)
 */
export async function updateRegistrationStatus(
  registrationId: string,
  status: 'pending' | 'approved' | 'declined'
): Promise<void> {
  try {
    const newStatus = status === 'approved' ? 'registered' : status;
    
    const { error } = await supabase
      .from('user_community_sessions')
      .update({ status: newStatus })
      .eq('id', registrationId);

    if (error) {
      console.error('Error updating registration status:', error);
      throw new Error('Failed to update registration. Please try again later.');
    }
  } catch (error) {
    console.error('Error in updateRegistrationStatus:', error);
    throw error;
  }
}

/**
 * Generate certificate PDF and return as base64 data URI (mobile compatible)
 * BLACK AND WHITE VERSION with LifeCraft Heart Logo
 * Returns a data URI that works across all devices including mobile
 */
async function generateCertificateDataUri(
  userName: string,
  sessionTitle: string,
  sessionDate: string,
  sessionTime: string,
  sessionLocation: string,
  instructor: string,
  organization: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const loadScript = () => {
        return new Promise((res, rej) => {
          if ((window as any).jspdf) {
            res(true);
            return;
          }
          
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => res(true);
          script.onerror = () => rej(new Error('Failed to load PDF library'));
          document.head.appendChild(script);
        });
      };

      await loadScript();

      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // FULL PAGE - Certificate border (no margins)
      doc.setLineWidth(2);
      doc.setDrawColor(0, 0, 0); // Black border
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10, 'S');
      
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.rect(8, 8, pageWidth - 16, pageHeight - 16, 'S');

      // Draw Heart Logo (matching LifeCraft logo)
      let yPos = 25;
      const logoSize = 15;
      const logoX = pageWidth / 2;
      
      // Heart shape using lines (simple outline)
      doc.setLineWidth(1.5);
      doc.setDrawColor(0, 0, 0);
      
      // Draw heart outline
      const heartPath = [
        [logoX - 4, yPos - 2],
        [logoX - 7, yPos - 5],
        [logoX - 7, yPos - 8],
        [logoX - 5, yPos - 10],
        [logoX - 2, yPos - 10],
        [logoX, yPos - 8],
        [logoX + 2, yPos - 10],
        [logoX + 5, yPos - 10],
        [logoX + 7, yPos - 8],
        [logoX + 7, yPos - 5],
        [logoX + 4, yPos - 2],
        [logoX, yPos + 3],
        [logoX - 4, yPos - 2]
      ];
      
      for (let i = 0; i < heartPath.length - 1; i++) {
        doc.line(heartPath[i][0], heartPath[i][1], heartPath[i + 1][0], heartPath[i + 1][1]);
      }

      // Logo/Header Text
      yPos += 8;
      doc.setFontSize(32);
      doc.setTextColor(0, 0, 0); // Black text
      doc.setFont('helvetica', 'bold');
      doc.text('LifeCraft', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 7;
      doc.setFontSize(14);
      doc.setTextColor(60, 60, 60); // Dark gray
      doc.setFont('helvetica', 'normal');
      doc.text('Community Training Program', pageWidth / 2, yPos, { align: 'center' });

      // Certificate Title
      yPos += 18;
      doc.setFontSize(26);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('CERTIFICATE OF COMPLETION', pageWidth / 2, yPos, { align: 'center' });

      // Decorative line
      yPos += 6;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      const lineWidth = 100;
      doc.line((pageWidth - lineWidth) / 2, yPos, (pageWidth + lineWidth) / 2, yPos);

      // This certifies text
      yPos += 13;
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text('This is to certify that', pageWidth / 2, yPos, { align: 'center' });

      // Participant name
      yPos += 11;
      doc.setFontSize(28);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(userName, pageWidth / 2, yPos, { align: 'center' });

      // Name underline
      yPos += 2;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      const nameWidth = doc.getTextWidth(userName) + 20;
      doc.line((pageWidth - nameWidth) / 2, yPos, (pageWidth + nameWidth) / 2, yPos);

      // Completion text
      yPos += 11;
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text('has successfully completed the training session', pageWidth / 2, yPos, { align: 'center' });

      // Training session title
      yPos += 9;
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(sessionTitle, pageWidth - 60);
      doc.text(titleLines, pageWidth / 2, yPos, { align: 'center' });
      yPos += (titleLines.length * 7);

      // Session details box
      yPos += 7;
      const boxWidth = 200;
      const boxX = (pageWidth - boxWidth) / 2;
      const boxHeight = 28;
      
      // Light gray background box
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(boxX, yPos, boxWidth, boxHeight, 2, 2, 'F');
      
      // Black accent line on left
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(boxX, yPos, 2, boxHeight, 1, 1, 'F');

      yPos += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      
      const dateFormatted = new Date(sessionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      doc.text('Date:', boxX + 8, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(dateFormatted, boxX + 25, yPos);
      
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text('Time:', boxX + 110, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(sessionTime, boxX + 128, yPos);
      
      yPos += 6;
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text('Location:', boxX + 8, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      const locationText = sessionLocation.length > 60 ? sessionLocation.substring(0, 57) + '...' : sessionLocation;
      doc.text(locationText, boxX + 30, yPos);

      yPos += 6;
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text('Organization:', boxX + 8, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      const orgText = organization.length > 55 ? organization.substring(0, 52) + '...' : organization;
      doc.text(orgText, boxX + 38, yPos);

      // Signature section - positioned at bottom
      yPos = pageHeight - 35;
      
      const signatureWidth = 65;
      const leftSigX = (pageWidth / 2) - signatureWidth - 20;
      const rightSigX = (pageWidth / 2) + 20;
      
      // Instructor signature
      doc.setLineWidth(0.3);
      doc.setDrawColor(0, 0, 0);
      doc.line(leftSigX, yPos, leftSigX + signatureWidth, yPos);
      
      yPos += 4;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(instructor, leftSigX + (signatureWidth / 2), yPos, { align: 'center' });
      
      yPos += 4;
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text('Instructor', leftSigX + (signatureWidth / 2), yPos, { align: 'center' });

      // Date signature
      yPos = pageHeight - 35;
      doc.setLineWidth(0.3);
      doc.setDrawColor(0, 0, 0);
      doc.line(rightSigX, yPos, rightSigX + signatureWidth, yPos);
      
      yPos += 4;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(new Date().toLocaleDateString(), rightSigX + (signatureWidth / 2), yPos, { align: 'center' });
      
      yPos += 4;
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text('Date Issued', rightSigX + (signatureWidth / 2), yPos, { align: 'center' });

      // Footer - positioned at very bottom
      yPos = pageHeight - 15;
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'italic');
      doc.text('This certificate verifies successful completion of community training requirements.', pageWidth / 2, yPos, { align: 'center' });

      // Generate base64 data URI instead of blob (mobile compatible)
      const pdfDataUri = doc.output('datauristring');
      
      resolve(pdfDataUri);
    } catch (error) {
      console.error('Error generating certificate:', error);
      reject(error);
    }
  });
}

/**
 * Mark community session as completed (admin only) - for certified sessions
 * Generates certificate and stores base64 data URI in database
 */
export async function markSessionComplete(
  registrationId: string,
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    // Get registration and session details
    const { data: registration, error: regError } = await supabase
      .from('user_community_sessions')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email
        ),
        community_sessions:session_id (
          title,
          date,
          time,
          location,
          organization,
          instructor,
          certified
        )
      `)
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      console.error('Error fetching registration:', regError);
      throw new Error('Registration not found.');
    }

    if (!registration.community_sessions.certified) {
      throw new Error('This session is not a certified training session.');
    }

    // Generate certificate data URI
    const userName = registration.profiles?.full_name || 'Participant';
    const sessionTitle = registration.community_sessions.title;
    const sessionDate = registration.community_sessions.date;
    const sessionTime = registration.community_sessions.time;
    const sessionLocation = registration.community_sessions.location;
    const instructor = registration.community_sessions.instructor || 'LifeCraft Instructor';
    const organization = registration.community_sessions.organization || 'LifeCraft Community';

    const certificateDataUri = await generateCertificateDataUri(
      userName,
      sessionTitle,
      sessionDate,
      sessionTime,
      sessionLocation,
      instructor,
      organization
    );

    // Update the user_community_sessions record with completion and data URI
    const { error: updateError } = await supabase
      .from('user_community_sessions')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        certificate_url: certificateDataUri // Store the data URI (mobile compatible)
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('Error marking session as complete:', updateError);
      throw new Error('Failed to mark session as complete. Please try again later.');
    }

    // Try to log activity
    try {
      await supabase
        .from('activity_log')
        .insert({
          user_id: userId,
          action: 'Completed community session',
          item: sessionId,
          points: 0
        });
      console.log('Activity logged successfully');
    } catch (logError) {
      console.warn('Activity log failed (non-critical):', logError);
    }
  } catch (error) {
    console.error('Error in markSessionComplete:', error);
    throw error;
  }
}

/**
 * Create new session (admin only)
 */
export async function createSession(sessionData: Omit<CommunitySession, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  try {
    const { error } = await supabase
      .from('community_sessions')
      .insert(sessionData);

    if (error) {
      console.error('Error creating session:', error);
      throw new Error('Failed to create session. Please try again later.');
    }
  } catch (error) {
    console.error('Error in createSession:', error);
    throw error;
  }
}

/**
 * Update session (admin only)
 */
export async function updateSession(sessionId: string, sessionData: Partial<CommunitySession>): Promise<void> {
  try {
    const { error } = await supabase
      .from('community_sessions')
      .update(sessionData)
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session:', error);
      throw new Error('Failed to update session. Please try again later.');
    }
  } catch (error) {
    console.error('Error in updateSession:', error);
    throw error;
  }
}

/**
 * Delete session (admin only)
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const { error: deleteRegsError } = await supabase
      .from('user_community_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (deleteRegsError) {
      console.error('Error deleting session registrations:', deleteRegsError);
      throw new Error('Failed to delete session registrations.');
    }

    const { error } = await supabase
      .from('community_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting session:', error);
      throw new Error('Failed to delete session. Please try again later.');
    }
  } catch (error) {
    console.error('Error in deleteSession:', error);
    throw error;
  }
}

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