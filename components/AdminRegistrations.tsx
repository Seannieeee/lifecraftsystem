import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Users, CheckCircle, XCircle, Clock, Loader2, Download, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { getAllRegistrations, updateRegistrationStatus, markSessionComplete } from '@/lib/community-utils';

interface Registration {
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
    title?: string;
    date?: string;
    time?: string;
    location?: string;
    organization?: string;
    certified?: boolean;
    instructor?: string;
  };
}

interface RegistrationsBySession {
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  sessionLocation: string;
  organization: string;
  certified: boolean;
  instructor: string;
  registrations: Registration[];
}

export function AdminRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllRegistrations();
      console.log('=== ADMIN REGISTRATIONS LOADED ===');
      console.log('Total registrations:', data.length);
      
      setRegistrations(data as Registration[]);
      
      const sessionIds = new Set(data.map((r: any) => r.session_id));
      setExpandedSessions(sessionIds);
    } catch (error: any) {
      console.error('Error loading registrations:', error);
      setError(error?.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (registrationId: string, status: 'pending' | 'approved' | 'declined') => {
    try {
      setActionLoading(registrationId);
      await updateRegistrationStatus(registrationId, status);
      await loadRegistrations();
      
      const statusText = status === 'approved' ? 'approved' : 'declined';
      alert(`Registration ${statusText} successfully!`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      const errorMessage = error?.message || 'Failed to update registration. Please try again.';
      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkComplete = async (registrationId: string, userId: string, sessionId: string) => {
    try {
      setActionLoading(`complete-${registrationId}`);
      await markSessionComplete(registrationId, userId, sessionId);
      await loadRegistrations();
      
      alert('Session marked as completed successfully! Certificate has been generated.');
    } catch (error: any) {
      console.error('Error marking session as complete:', error);
      const errorMessage = error?.message || 'Failed to mark session as complete. Please try again.';
      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const generatePDF = async (sessionData: RegistrationsBySession) => {
    setPdfLoading(sessionData.sessionId);
    
    const approvedRegs = sessionData.registrations.filter(
      (r: Registration) => r.status === 'registered' || r.status === 'approved' || r.status === 'completed'
    );

    const dateString = new Date(sessionData.sessionDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    try {
      const loadScript = () => {
        return new Promise((resolve, reject) => {
          if ((window as any).jspdf) {
            resolve(true);
            return;
          }
          
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => resolve(true);
          script.onerror = () => reject(new Error('Failed to load PDF library'));
          document.head.appendChild(script);
        });
      };

      await loadScript();

      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      let yPos = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 15;
      const rightMargin = 15;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      const checkAddPage = (neededSpace: number) => {
        if (yPos + neededSpace > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      doc.setFontSize(24);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('LifeCraft', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 10;
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.text('Training Session Registration List', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 6;
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 8;
      
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);
      yPos += 10;

      doc.setFillColor(249, 250, 251);
      doc.rect(leftMargin, yPos, contentWidth, 45, 'F');
      
      doc.setFillColor(220, 38, 38);
      doc.rect(leftMargin, yPos, 2, 45, 'F');
      
      yPos += 8;
      
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.text(sessionData.sessionTitle, leftMargin + 5, yPos);
      
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      doc.setTextColor(107, 114, 128);
      doc.text('Date:', leftMargin + 5, yPos);
      doc.setTextColor(31, 41, 55);
      doc.text(dateString, leftMargin + 25, yPos);
      
      yPos += 6;
      
      doc.setTextColor(107, 114, 128);
      doc.text('Time:', leftMargin + 5, yPos);
      doc.setTextColor(31, 41, 55);
      doc.text(sessionData.sessionTime, leftMargin + 25, yPos);
      
      yPos += 6;
      
      doc.setTextColor(107, 114, 128);
      doc.text('Location:', leftMargin + 5, yPos);
      doc.setTextColor(31, 41, 55);
      const locationLines = doc.splitTextToSize(sessionData.sessionLocation, contentWidth - 30);
      doc.text(locationLines, leftMargin + 25, yPos);
      yPos += (locationLines.length * 5);
      
      if (sessionData.organization) {
        yPos += 1;
        doc.setTextColor(107, 114, 128);
        doc.text('Organization:', leftMargin + 5, yPos);
        doc.setTextColor(31, 41, 55);
        doc.text(sessionData.organization, leftMargin + 35, yPos);
      }
      
      yPos += 15;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('Approved Registrations', leftMargin, yPos);
      
      doc.setFillColor(220, 38, 38);
      const badgeText = `${approvedRegs.length} Registered`;
      const badgeWidth = doc.getTextWidth(badgeText) + 8;
      doc.roundedRect(leftMargin + 60, yPos - 4, badgeWidth, 6, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, leftMargin + 64, yPos);
      
      yPos += 8;

      if (approvedRegs.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.setFont('helvetica', 'normal');
        doc.text('No approved registrations yet.', pageWidth / 2, yPos + 10, { align: 'center' });
      } else {
        doc.setFillColor(243, 244, 246);
        doc.rect(leftMargin, yPos, contentWidth, 8, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 65, 81);
        
        const col1 = leftMargin + 2;
        const col2 = leftMargin + 12;
        const col3 = leftMargin + 55;
        const col4 = leftMargin + 125;
        
        doc.text('#', col1, yPos + 5);
        doc.text('Name', col2, yPos + 5);
        doc.text('Email', col3, yPos + 5);
        doc.text('Date', col4, yPos + 5);
        
        yPos += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        approvedRegs.forEach((reg: Registration, index: number) => {
          checkAddPage(10);
          
          if (index % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(leftMargin, yPos, contentWidth, 8, 'F');
          }
          
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.1);
          doc.line(leftMargin, yPos + 8, pageWidth - rightMargin, yPos + 8);
          
          doc.setTextColor(31, 41, 55);
          
          doc.text(`${index + 1}`, col1, yPos + 5);
          
          const name = reg.profiles?.full_name || 'N/A';
          doc.setFont('helvetica', 'bold');
          const nameLines = doc.splitTextToSize(name, 40);
          doc.text(nameLines[0], col2, yPos + 5);
          doc.setFont('helvetica', 'normal');
          
          const email = reg.profiles?.email || 'N/A';
          const emailLines = doc.splitTextToSize(email, 65);
          doc.text(emailLines[0], col3, yPos + 5);
          
          const regDate = new Date(reg.created_at).toLocaleDateString();
          doc.text(regDate, col4, yPos + 5);
          
          yPos += 8;
        });
      }
      
      yPos = pageHeight - 20;
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);
      
      yPos += 5;
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'bold');
      doc.text('LifeCraft - Community Training Management', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      doc.text('This document contains confidential information. Handle with care.', pageWidth / 2, yPos, { align: 'center' });

      const defaultFileName = `LifeCraft_${sessionData.sessionTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      if ('showSaveFilePicker' in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: defaultFileName,
            types: [{
              description: 'PDF Files',
              accept: { 'application/pdf': ['.pdf'] }
            }]
          });

          const pdfBlob = doc.output('blob');
          const writable = await fileHandle.createWritable();
          await writable.write(pdfBlob);
          await writable.close();

          setPdfLoading(null);
          alert('PDF saved successfully!');
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setPdfLoading(null);
            return;
          }
          doc.save(defaultFileName);
          setPdfLoading(null);
        }
      } else {
        doc.save(defaultFileName);
        setPdfLoading(null);
      }
      
    } catch (error) {
      console.error('PDF generation error:', error);
      setPdfLoading(null);
      alert('Failed to generate PDF. Please try again.');
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadRegistrations}>Retry</Button>
        </Card>
      </div>
    );
  }

  const registrationsBySession: RegistrationsBySession[] = [];
  const sessionMap = new Map<string, RegistrationsBySession>();

  registrations.forEach((reg: Registration) => {
    const sessionId = reg.session_id;
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        sessionId,
        sessionTitle: reg.community_sessions?.title || 'Unknown Session',
        sessionDate: reg.community_sessions?.date || '',
        sessionTime: reg.community_sessions?.time || '',
        sessionLocation: reg.community_sessions?.location || '',
        organization: reg.community_sessions?.organization || '',
        certified: reg.community_sessions?.certified || false,
        instructor: reg.community_sessions?.instructor || 'LifeCraft Instructor',
        registrations: []
      });
    }
    sessionMap.get(sessionId)!.registrations.push(reg);
  });

  registrationsBySession.push(...Array.from(sessionMap.values()));

  registrationsBySession.sort((a, b) => 
    new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
  );

  const totalRegistrations = registrations.length;
  const pendingCount = registrations.filter((r: Registration) => r.status === 'pending').length;
  const approvedCount = registrations.filter((r: Registration) => r.status === 'registered' || r.status === 'approved').length;
  const declinedCount = registrations.filter((r: Registration) => r.status === 'declined').length;
  const completedCount = registrations.filter((r: Registration) => r.status === 'completed').length;

  return (
    <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Manage Registrations</h1>
              <p className="text-sm sm:text-base text-gray-600">Review and approve community session registrations by training session</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Total</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{totalRegistrations}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Pending</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{pendingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Approved</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{approvedCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Declined</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{declinedCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{completedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Registrations by Training Session</h2>
          
          {registrationsBySession.length === 0 ? (
            <Card className="p-8 sm:p-12 text-center">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm sm:text-base text-gray-600">No registrations yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {registrationsBySession.map((session: RegistrationsBySession) => {
                const isExpanded = expandedSessions.has(session.sessionId);
                const pendingRegs = session.registrations.filter((r: Registration) => r.status === 'pending');
                const approvedRegs = session.registrations.filter((r: Registration) => r.status === 'registered' || r.status === 'approved');
                const declinedRegs = session.registrations.filter((r: Registration) => r.status === 'declined');
                const completedRegs = session.registrations.filter((r: Registration) => r.status === 'completed');

                return (
                  <Card key={session.sessionId} className="overflow-hidden">
                    <div 
                      className="p-4 sm:p-6 bg-gradient-to-r from-red-50 to-orange-50 cursor-pointer hover:from-red-100 hover:to-orange-100 transition-colors"
                      onClick={() => toggleSession(session.sessionId)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg sm:text-xl font-semibold truncate">{session.sessionTitle}</h3>
                            {session.certified && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                Certified
                              </Badge>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-600 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">📅</span>
                              <span className="truncate">
                                {new Date(session.sessionDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">🕐</span>
                              <span className="truncate">{session.sessionTime}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">📍</span>
                              <span className="truncate">{session.sessionLocation}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                              {pendingRegs.length} Pending
                            </Badge>
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              {approvedRegs.length} Approved
                            </Badge>
                            {completedRegs.length > 0 && (
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                                {completedRegs.length} Completed
                              </Badge>
                            )}
                            {declinedRegs.length > 0 && (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                                {declinedRegs.length} Declined
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            generatePDF(session);
                          }}
                          size="sm"
                          disabled={pdfLoading === session.sessionId}
                          className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto flex-shrink-0"
                        >
                          {pdfLoading === session.sessionId ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              <span className="text-xs sm:text-sm">Generating...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              <span className="text-xs sm:text-sm">Export PDF</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 sm:p-6 border-t">
                        {pendingRegs.length > 0 && (
                          <div className="mb-6">
                            <h4 className="font-semibold mb-3 text-amber-700 text-sm sm:text-base">Pending Approval ({pendingRegs.length})</h4>
                            <div className="space-y-3">
                              {pendingRegs.map((reg: Registration) => (
                                <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm sm:text-base truncate">{reg.profiles?.full_name || 'Unknown'}</p>
                                    <p className="text-xs sm:text-sm text-gray-600 break-all">{reg.profiles?.email || 'No email'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Registered: {new Date(reg.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleStatusUpdate(reg.id, 'approved')}
                                      disabled={actionLoading === reg.id}
                                      className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                                    >
                                      {actionLoading === reg.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle className="w-4 h-4 mr-1" />
                                          <span className="text-xs sm:text-sm">Approve</span>
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleStatusUpdate(reg.id, 'declined')}
                                      disabled={actionLoading === reg.id}
                                      variant="outline"
                                      className="text-red-600 border-red-300 hover:bg-red-50 flex-1 sm:flex-none"
                                    >
                                      {actionLoading === reg.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <XCircle className="w-4 h-4 mr-1" />
                                          <span className="text-xs sm:text-sm">Decline</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {approvedRegs.length > 0 && (
                          <div className="mb-6">
                            <h4 className="font-semibold mb-3 text-green-700 text-sm sm:text-base">Approved ({approvedRegs.length})</h4>
                            <div className="space-y-3">
                              {approvedRegs.map((reg: Registration) => (
                                <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm sm:text-base truncate">{reg.profiles?.full_name || 'Unknown'}</p>
                                    <p className="text-xs sm:text-sm text-gray-600 break-all">{reg.profiles?.email || 'No email'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Registered: {new Date(reg.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs self-start sm:self-center flex-shrink-0">
                                      ✓ Approved
                                    </Badge>
                                    {session.certified && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleMarkComplete(reg.id, reg.user_id, reg.session_id)}
                                        disabled={actionLoading === `complete-${reg.id}`}
                                        className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
                                      >
                                        {actionLoading === `complete-${reg.id}` ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <>
                                            <Award className="w-4 h-4 mr-1" />
                                            <span className="text-xs sm:text-sm">Complete & Certify</span>
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {completedRegs.length > 0 && (
                          <div className="mb-6">
                            <h4 className="font-semibold mb-3 text-purple-700 text-sm sm:text-base">Completed ({completedRegs.length})</h4>
                            <div className="space-y-2">
                              {completedRegs.map((reg: Registration) => (
                                <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm sm:text-base truncate">{reg.profiles?.full_name || 'Unknown'}</p>
                                    <p className="text-xs sm:text-sm text-gray-600 break-all">{reg.profiles?.email || 'No email'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Completed: {reg.completed_at ? new Date(reg.completed_at).toLocaleString() : 'Unknown'}
                                    </p>
                                    {reg.certificate_url && (
                                      <p className="text-xs text-green-600 mt-1">
                                        ✓ Certificate Generated
                                      </p>
                                    )}
                                  </div>
                                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs self-start sm:self-center flex-shrink-0">
                                    ✓ Completed
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {declinedRegs.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-3 text-red-700 text-sm sm:text-base">Declined ({declinedRegs.length})</h4>
                            <div className="space-y-2">
                              {declinedRegs.map((reg: Registration) => (
                                <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-600 text-sm sm:text-base truncate">{reg.profiles?.full_name || 'Unknown'}</p>
                                    <p className="text-xs sm:text-sm text-gray-500 break-all">{reg.profiles?.email || 'No email'}</p>
                                  </div>
                                  <Badge className="bg-red-100 text-red-700 border-red-200 text-xs self-start sm:self-center flex-shrink-0">
                                    ✗ Declined
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {session.registrations.length === 0 && (
                          <p className="text-center text-gray-500 py-8 text-sm sm:text-base">No registrations for this session yet</p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}