import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, Download, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { getAllDrillRegistrations, updateDrillRegistrationStatus, markPhysicalDrillComplete } from '@/lib/drills-utils';

interface DrillRegistration {
  id: string;
  user_id: string;
  drill_id: string;
  status: string;
  created_at: string;
  completed_at?: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
  drills: {
    title: string;
    date?: string;
    time?: string;
    location?: string;
    type: string;
  } | null;
}

interface RegistrationsByDrill {
  drillId: string;
  drillTitle: string;
  drillDate: string;
  drillTime: string;
  drillLocation: string;
  registrations: DrillRegistration[];
}

type FilterTab = 'all' | 'pending' | 'approved' | 'completed' | 'declined';

export function AdminDrillRegistrations() {
  const [registrations, setRegistrations] = useState<DrillRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDrills, setExpandedDrills] = useState<Set<string>>(new Set());
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [confirmComplete, setConfirmComplete] = useState<{
    show: boolean;
    registration: DrillRegistration | null;
  }>({ show: false, registration: null });

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const data = await getAllDrillRegistrations();
      
      const transformedData = data.map((reg: any) => ({
        id: reg.id,
        user_id: reg.user_id,
        drill_id: reg.drill_id,
        status: reg.status,
        created_at: reg.created_at,
        completed_at: reg.completed_at,
        profiles: Array.isArray(reg.profiles) 
          ? (reg.profiles[0] || null)
          : reg.profiles,
        drills: Array.isArray(reg.drills)
          ? (reg.drills[0] || null)
          : reg.drills
      }));
      
      setRegistrations(transformedData as DrillRegistration[]);
      
      const drillIds = new Set(transformedData.map((r: any) => r.drill_id));
      setExpandedDrills(drillIds);
    } catch (error) {
      console.error('Error loading drill registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadRegistrations();
    } finally {
      setRefreshing(false);
    }
  };

  const handleStatusUpdate = async (registrationId: string, status: 'approved' | 'declined') => {
    try {
      setActionLoading(registrationId);
      await updateDrillRegistrationStatus(registrationId, status);
      await loadRegistrations();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update registration status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkComplete = async (registration: DrillRegistration) => {
    setConfirmComplete({ show: true, registration });
  };

  const confirmMarkComplete = async () => {
    if (!confirmComplete.registration) return;

    try {
      setActionLoading(confirmComplete.registration.id);
      await markPhysicalDrillComplete(
        confirmComplete.registration.id,
        confirmComplete.registration.user_id,
        confirmComplete.registration.drill_id
      );
      
      setConfirmComplete({ show: false, registration: null });
      await loadRegistrations();
      
      alert('✅ Drill marked as completed! You can now award a certificate from the Certificates tab.');
    } catch (error: any) {
      console.error('Error marking drill as complete:', error);
      
      // Check if it's just an activity log permission error
      if (error.message && error.message.includes('activity_log')) {
        // The drill was marked complete, just the activity log failed
        setConfirmComplete({ show: false, registration: null });
        await loadRegistrations();
        alert('✅ Drill marked as completed! You can now award a certificate from the Certificates tab.');
      } else {
        alert('Failed to mark drill as complete. Please try again.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const toggleDrill = (drillId: string) => {
    setExpandedDrills(prev => {
      const newSet = new Set(prev);
      if (newSet.has(drillId)) {
        newSet.delete(drillId);
      } else {
        newSet.add(drillId);
      }
      return newSet;
    });
  };

  const generatePDF = async (drillData: RegistrationsByDrill) => {
    setPdfLoading(drillData.drillId);
    
    const approvedRegs = drillData.registrations.filter(
      r => r.status === 'approved' || r.status === 'completed'
    );

    const dateString = drillData.drillDate 
      ? new Date(drillData.drillDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'TBA';

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

      // Header
      doc.setFontSize(24);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('LifeCraft', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 10;
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.text('Physical Drill Registration List', pageWidth / 2, yPos, { align: 'center' });
      
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

      // Drill Info Box
      doc.setFillColor(249, 250, 251);
      doc.rect(leftMargin, yPos, contentWidth, 45, 'F');
      
      doc.setFillColor(220, 38, 38);
      doc.rect(leftMargin, yPos, 2, 45, 'F');
      
      yPos += 8;
      
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.text(drillData.drillTitle, leftMargin + 5, yPos);
      
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
      doc.text(drillData.drillTime || 'TBA', leftMargin + 25, yPos);
      
      yPos += 6;
      
      doc.setTextColor(107, 114, 128);
      doc.text('Location:', leftMargin + 5, yPos);
      doc.setTextColor(31, 41, 55);
      const locationLines = doc.splitTextToSize(drillData.drillLocation || 'TBA', contentWidth - 30);
      doc.text(locationLines, leftMargin + 25, yPos);
      yPos += (locationLines.length * 5);
      
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('Approved Participants', leftMargin, yPos);
      
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
        doc.text('Status', col4, yPos + 5);
        
        yPos += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        approvedRegs.forEach((reg, index) => {
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
          
          const status = reg.status === 'completed' ? '✓ Completed' : 'Approved';
          doc.text(status, col4, yPos + 5);
          
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
      doc.text('LifeCraft - Emergency Response Training', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      doc.text('This document contains confidential information. Handle with care.', pageWidth / 2, yPos, { align: 'center' });

      const defaultFileName = `LifeCraft_${drillData.drillTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

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

  // Filter registrations
  const filteredRegistrations = registrations.filter(reg => {
    if (activeFilter === 'all') return true;
    return reg.status === activeFilter;
  });

  const registrationsByDrill: RegistrationsByDrill[] = [];
  const drillMap = new Map<string, RegistrationsByDrill>();

  filteredRegistrations.forEach(reg => {
    const drillId = reg.drill_id;
    if (!drillMap.has(drillId)) {
      drillMap.set(drillId, {
        drillId,
        drillTitle: reg.drills?.title || 'Unknown Drill',
        drillDate: reg.drills?.date || '',
        drillTime: reg.drills?.time || '',
        drillLocation: reg.drills?.location || '',
        registrations: []
      });
    }
    drillMap.get(drillId)!.registrations.push(reg);
  });

  registrationsByDrill.push(...Array.from(drillMap.values()));

  registrationsByDrill.sort((a, b) => 
    new Date(a.drillDate || 0).getTime() - new Date(b.drillDate || 0).getTime()
  );

  const pendingCount = registrations.filter(r => r.status === 'pending').length;
  const approvedCount = registrations.filter(r => r.status === 'approved').length;
  const completedCount = registrations.filter(r => r.status === 'completed').length;
  const declinedCount = registrations.filter(r => r.status === 'declined').length;

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: registrations.length },
    { id: 'pending', label: 'Pending', count: pendingCount },
    { id: 'approved', label: 'Approved', count: approvedCount },
    { id: 'completed', label: 'Completed', count: completedCount },
    { id: 'declined', label: 'Declined', count: declinedCount },
  ];

  return (
    <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Manage Physical Drill Registrations</h1>
            <p className="text-sm sm:text-base text-gray-600">Review, approve, and track drill registrations</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Pending</p>
                <p className="text-xl sm:text-2xl font-semibold">{pendingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Approved</p>
                <p className="text-xl sm:text-2xl font-semibold">{approvedCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Completed</p>
                <p className="text-xl sm:text-2xl font-semibold">{completedCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Declined</p>
                <p className="text-xl sm:text-2xl font-semibold">{declinedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {filterTabs.map(tab => (
              <Button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                variant={activeFilter === tab.id ? 'default' : 'outline'}
                className={`flex items-center gap-2 ${
                  activeFilter === tab.id
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-white hover:bg-gray-50'
                }`}
                size="sm"
              >
                <span className="text-sm">{tab.label}</span>
                <Badge 
                  className={`${
                    activeFilter === tab.id
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-200 text-gray-700'
                  } text-xs`}
                >
                  {tab.count}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        {/* Confirmation Modal */}
        {confirmComplete.show && confirmComplete.registration && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Mark Drill as Completed?</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    You are about to mark this drill as completed for:
                  </p>
                  <p className="font-medium">{confirmComplete.registration.profiles?.full_name}</p>
                  <p className="text-sm text-gray-600">{confirmComplete.registration.drills?.title}</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  ℹ️ After marking as complete, you can award a certificate from the <strong>Certificates tab</strong>.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setConfirmComplete({ show: false, registration: null })}
                  variant="outline"
                  className="flex-1"
                  disabled={actionLoading === confirmComplete.registration.id}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmMarkComplete}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={actionLoading === confirmComplete.registration.id}
                >
                  {actionLoading === confirmComplete.registration.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Marking...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Registrations by Drill */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">
            {activeFilter === 'all' ? 'All Drills' : `${filterTabs.find(t => t.id === activeFilter)?.label} Registrations`}
          </h2>
          
          {registrationsByDrill.length === 0 ? (
            <Card className="p-8 sm:p-12 text-center">
              <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm sm:text-base text-gray-600">
                {activeFilter === 'all' ? 'No registrations yet' : `No ${activeFilter} registrations`}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {registrationsByDrill.map((drill) => {
                const isExpanded = expandedDrills.has(drill.drillId);
                const pendingRegs = drill.registrations.filter(r => r.status === 'pending');
                const approvedRegs = drill.registrations.filter(r => r.status === 'approved');
                const completedRegs = drill.registrations.filter(r => r.status === 'completed');
                const declinedRegs = drill.registrations.filter(r => r.status === 'declined');

                return (
                  <Card key={drill.drillId} className="overflow-hidden">
                    <div 
                      className="p-4 sm:p-6 bg-gradient-to-r from-red-50 to-orange-50 cursor-pointer hover:from-red-100 hover:to-orange-100 transition-colors"
                      onClick={() => toggleDrill(drill.drillId)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg sm:text-xl font-semibold truncate">{drill.drillTitle}</h3>
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
                                {drill.drillDate ? new Date(drill.drillDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }) : 'TBA'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">🕐</span>
                              <span className="truncate">{drill.drillTime || 'TBA'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">📍</span>
                              <span className="truncate">{drill.drillLocation || 'TBA'}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {pendingRegs.length > 0 && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                {pendingRegs.length} Pending
                              </Badge>
                            )}
                            {approvedRegs.length > 0 && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                {approvedRegs.length} Approved
                              </Badge>
                            )}
                            {completedRegs.length > 0 && (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
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
                            generatePDF(drill);
                          }}
                          size="sm"
                          disabled={pdfLoading === drill.drillId}
                          className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto flex-shrink-0"
                        >
                          {pdfLoading === drill.drillId ? (
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
                        {/* Pending Registrations */}
                        {pendingRegs.length > 0 && (
                          <div className="mb-6">
                            <h4 className="font-semibold mb-3 text-amber-700 text-sm sm:text-base flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Pending Approval ({pendingRegs.length})
                            </h4>
                            <div className="space-y-3">
                              {pendingRegs.map(reg => (
                                <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm sm:text-base truncate">{reg.profiles?.full_name || 'Unknown'}</p>
                                    <p className="text-xs sm:text-sm text-gray-600 break-all">{reg.profiles?.email || 'No email'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Registered: {new Date(reg.created_at).toLocaleDateString()} at {new Date(reg.created_at).toLocaleTimeString()}
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

                        {/* Approved Registrations */}
                        {approvedRegs.length > 0 && (
                          <div className="mb-6">
                            <h4 className="font-semibold mb-3 text-green-700 text-sm sm:text-base flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Approved - Can Attend ({approvedRegs.length})
                            </h4>
                            <div className="space-y-3">
                              {approvedRegs.map(reg => (
                                <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-medium text-sm sm:text-base truncate">{reg.profiles?.full_name || 'Unknown'}</p>
                                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                        ✓ Approved
                                      </Badge>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-600 break-all">{reg.profiles?.email || 'No email'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Registered: {new Date(reg.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkComplete(reg)}
                                    disabled={actionLoading === reg.id}
                                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                                  >
                                    {actionLoading === reg.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        <span className="hidden sm:inline text-sm">Mark Complete</span>
                                        <span className="sm:hidden text-sm">Complete</span>
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Completed Registrations */}
                        {completedRegs.length > 0 && (
                          <div className="mb-6">
                            <h4 className="font-semibold mb-3 text-blue-700 text-sm sm:text-base flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Completed - Ready for Certificate ({completedRegs.length})
                            </h4>
                            <div className="space-y-2">
                              {completedRegs.map(reg => (
                                <div key={reg.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-medium text-sm sm:text-base truncate">{reg.profiles?.full_name || 'Unknown'}</p>
                                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                                        ✓ Completed
                                      </Badge>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-600 break-all">{reg.profiles?.email || 'No email'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Completed: {reg.completed_at ? new Date(reg.completed_at).toLocaleDateString() : 'Unknown'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-blue-600" />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs sm:text-sm text-blue-800">
                                💡 <strong>Next Step:</strong> Go to the <strong>Certificates</strong> tab to award certificates to these participants.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Declined Registrations */}
                        {declinedRegs.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-3 text-red-700 text-sm sm:text-base flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              Declined ({declinedRegs.length})
                            </h4>
                            <div className="space-y-2">
                              {declinedRegs.map(reg => (
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

                        {drill.registrations.length === 0 && (
                          <p className="text-center text-gray-500 py-8 text-sm sm:text-base">No registrations for this drill yet</p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Help Section */}
        <Card className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Registration Workflow
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <span className="font-bold text-amber-600 flex-shrink-0">1.</span>
              <p><strong>Pending:</strong> User submits registration → Wait for admin approval</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold text-green-600 flex-shrink-0">2.</span>
              <p><strong>Approved:</strong> Admin approves → User can attend the drill</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
              <p><strong>Drill Happens:</strong> Physical drill takes place in person</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
              <p><strong>Mark Complete:</strong> Admin marks drill as completed after it's done</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold text-purple-600 flex-shrink-0">5.</span>
              <p><strong>Award Certificate:</strong> Admin awards certificate from Certificates tab</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold text-indigo-600 flex-shrink-0">6.</span>
              <p><strong>User Downloads:</strong> User can download their certificate from their dashboard</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}