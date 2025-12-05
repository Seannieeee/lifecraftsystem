'use client';

import { useState, useEffect } from 'react';
import type { Profile } from '@/lib/supabase';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Users, 
  BookOpen, 
  Target, 
  TrendingUp, 
  BarChart3,
  Search,
  Loader2,
  Calendar,
  Award,
  Activity,
  Send,
  CheckCircle,
  Mail
} from 'lucide-react';
import {
  getDashboardStats,
  getAllParticipants,
  getRecentActivity,
  getDrillStatistics,
  getPerformanceMetrics,
  searchParticipants,
  getCertifiedDrills,
  storeCertificateUrl,
  sendCompletionNotification,
  type ParticipantStats,
  type AdminDashboardStats,
  type RecentActivity,
  type DrillStats,
  type CertifiedDrill
} from '@/lib/admin-portal-utils';

interface AdminPortalProps {
  profile: Profile;
}

export function AdminPortal({ profile }: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'drills' | 'certificates'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  
  // Data states
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats>({
    totalParticipants: 0,
    totalModules: 0,
    totalDrills: 0,
    avgCompletionRate: 0,
    totalCertifiedDrills: 0
  });
  const [participants, setParticipants] = useState<ParticipantStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [drillStats, setDrillStats] = useState<DrillStats[]>([]);
  const [certifiedDrills, setCertifiedDrills] = useState<CertifiedDrill[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    avgModuleScore: 0,
    avgDrillScore: 0
  });
  const [generatingCertificate, setGeneratingCertificate] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch();
    } else {
      loadParticipants();
    }
  }, [searchQuery]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [stats, activity, drills, metrics, certDrills] = await Promise.all([
        getDashboardStats(),
        getRecentActivity(10),
        getDrillStatistics(),
        getPerformanceMetrics(),
        getCertifiedDrills()
      ]);

      setDashboardStats(stats);
      setRecentActivity(activity);
      setDrillStats(drills);
      setPerformanceMetrics(metrics);
      setCertifiedDrills(certDrills);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadParticipants = async () => {
    try {
      const data = await getAllParticipants();
      setParticipants(data);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadParticipants();
      return;
    }

    try {
      setSearching(true);
      const results = await searchParticipants(searchQuery);
      setParticipants(results);
    } catch (error) {
      console.error('Error searching participants:', error);
    } finally {
      setSearching(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  // UPDATED: Generate certificate and send email notification
  const generateAndMakeCertificateAvailable = async (drill: CertifiedDrill, participant: any) => {
    setGeneratingCertificate(`${drill.id}-${participant.user_id}`);

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
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Classic black border frame - no whitespace
      doc.setLineWidth(2);
      doc.setDrawColor(0, 0, 0);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
      
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

      // Organization header
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('LifeCraft Training Program', pageWidth / 2, 25, { align: 'center' });

      // Certificate Title
      doc.setFontSize(40);
      doc.setFont('times', 'bold');
      doc.text('Certificate of Completion', pageWidth / 2, 50, { align: 'center' });

      // Decorative line under title
      doc.setLineWidth(0.8);
      doc.setDrawColor(0, 0, 0);
      doc.line(50, 55, pageWidth - 50, 55);

      // Presented to text
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('This certificate is proudly presented to', pageWidth / 2, 72, { align: 'center' });

      // Participant name - larger and prominent
      doc.setFontSize(32);
      doc.setFont('times', 'bolditalic');
      doc.text(participant.full_name, pageWidth / 2, 90, { align: 'center' });

      // Line under name
      doc.setLineWidth(0.3);
      doc.setDrawColor(0, 0, 0);
      const nameWidth = doc.getTextWidth(participant.full_name);
      doc.line((pageWidth - nameWidth - 20) / 2, 93, (pageWidth + nameWidth + 20) / 2, 93);

      // Recognition text
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('for successfully completing the physical drill training', pageWidth / 2, 106, { align: 'center' });

      // Drill title - bold and centered
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(drill.title, pageWidth - 80);
      const titleY = 120;
      doc.text(titleLines, pageWidth / 2, titleY, { align: 'center' });

      // Drill details
      const detailsY = titleY + (titleLines.length * 9) + 8;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      const drillDate = new Date(drill.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.text(`Conducted on ${drillDate} at ${drill.time}`, pageWidth / 2, detailsY, { align: 'center' });
      doc.text(`Location: ${drill.location}`, pageWidth / 2, detailsY + 7, { align: 'center' });
      doc.text(`Lead Instructor: ${drill.instructor}`, pageWidth / 2, detailsY + 14, { align: 'center' });

      // Footer section with signatures
      const footerY = pageHeight - 42;
      
      // Signature lines
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      
      // Left signature (Instructor)
      const leftSigStart = 45;
      const leftSigEnd = 100;
      doc.line(leftSigStart, footerY, leftSigEnd, footerY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Instructor', (leftSigStart + leftSigEnd) / 2, footerY + 6, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.text(drill.instructor, (leftSigStart + leftSigEnd) / 2, footerY + 11, { align: 'center' });

      // Right signature (Program Director)
      const rightSigStart = pageWidth - 100;
      const rightSigEnd = pageWidth - 45;
      doc.line(rightSigStart, footerY, rightSigEnd, footerY);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Program Director', (rightSigStart + rightSigEnd) / 2, footerY + 6, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.text('LifeCraft Administration', (rightSigStart + rightSigEnd) / 2, footerY + 11, { align: 'center' });

      // Issue date at bottom center
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(60, 60, 60);
      doc.text(`Certificate issued on ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`, pageWidth / 2, pageHeight - 22, { align: 'center' });

      // Organization seal/emblem (text-based) - above the bottom border
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('~ LifeCraft ~', pageWidth / 2, pageHeight - 15, { align: 'center' });

      // Convert to data URI (mobile compatible)
      const pdfDataUri = doc.output('datauristring');

      // Store certificate data URI in database
      const success = await storeCertificateUrl(participant.id, pdfDataUri);

      if (success) {
        // Send email notification
        const emailResult = await sendCompletionNotification(
          participant.email,
          participant.full_name,
          drill.title,
          drill.date,
          drill.location
        );

        if (emailResult.success) {
          alert(`✅ Certificate awarded and email notification sent to ${participant.full_name}!`);
        } else {
          alert(`⚠️ Certificate awarded but email notification failed: ${emailResult.error}\n\nThe certificate is still available in their dashboard.`);
        }
        
        // Refresh the data
        const certDrills = await getCertifiedDrills();
        setCertifiedDrills(certDrills);
      } else {
        alert('Certificate generated but failed to save. Please try again.');
      }

      setGeneratingCertificate(null);
    } catch (error) {
      console.error('Certificate generation error:', error);
      setGeneratingCertificate(null);
      alert('Failed to generate certificate. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Admin Portal</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage participants, modules, and training programs</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Participants</p>
              <p className="text-xl sm:text-2xl font-semibold">{dashboardStats.totalParticipants}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Modules</p>
              <p className="text-xl sm:text-2xl font-semibold">{dashboardStats.totalModules}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Drills</p>
              <p className="text-xl sm:text-2xl font-semibold">{dashboardStats.totalDrills}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Cert. Drills</p>
              <p className="text-xl sm:text-2xl font-semibold">{dashboardStats.totalCertifiedDrills}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base whitespace-nowrap transition-colors relative ${
            activeTab === 'overview' ? 'text-red-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
          {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base whitespace-nowrap transition-colors relative ${
            activeTab === 'participants' ? 'text-red-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Participants
          {activeTab === 'participants' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
        </button>
        <button
          onClick={() => setActiveTab('drills')}
          className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base whitespace-nowrap transition-colors relative ${
            activeTab === 'drills' ? 'text-red-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Drills
          {activeTab === 'drills' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
        </button>
        <button
          onClick={() => setActiveTab('certificates')}
          className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base whitespace-nowrap transition-colors relative ${
            activeTab === 'certificates' ? 'text-red-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Certificates
          {activeTab === 'certificates' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
        </button>
      </div>
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Recent Activity */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">No recent activity</p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.action}</p>
                        <p className="text-xs text-gray-600 truncate">{activity.user_name}</p>
                      </div>
                      <p className="text-xs text-gray-600 flex-shrink-0">{formatTimeAgo(activity.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Performance Metrics */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <h2 className="text-lg sm:text-xl font-semibold">Performance Metrics</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Avg. Module Score</p>
                  <p className="text-xl sm:text-2xl font-semibold text-blue-600">{performanceMetrics.avgModuleScore}%</p>
                </div>
                <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Avg. Drill Score</p>
                  <p className="text-xl sm:text-2xl font-semibold text-green-600">{performanceMetrics.avgDrillScore}%</p>
                </div>
                <div className="p-3 sm:p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Completion Rate</p>
                  <p className="text-xl sm:text-2xl font-semibold text-purple-600">{dashboardStats.avgCompletionRate}%</p>
                </div>
                <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Cert. Drills</p>
                  <p className="text-xl sm:text-2xl font-semibold text-amber-600">{dashboardStats.totalCertifiedDrills}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar - Top Performers */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Top Performers</h2>
              {participants.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">No participants yet</p>
              ) : (
                <div className="space-y-3">
                  {participants
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 5)
                    .map((participant, index) => (
                      <div key={participant.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{participant.full_name}</p>
                          <p className="text-xs text-gray-600">{participant.rank}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-red-600">{participant.points}</p>
                          <p className="text-xs text-gray-600">points</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Participants Tab */}
      {activeTab === 'participants' && (
        <div>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search participants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 sm:pl-10 text-sm sm:text-base"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600">Name</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600">Progress</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600">Drills</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600">Points</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {participants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-600">
                        No participants found
                      </td>
                    </tr>
                  ) : (
                    participants.map(participant => (
                      <tr key={participant.id} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div>
                            <p className="text-xs sm:text-sm font-medium truncate">{participant.full_name}</p>
                            <p className="text-xs text-gray-600 truncate">{participant.email}</p>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <span>{participant.modulesCompleted}/{participant.totalModules}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-red-600 h-1.5 rounded-full"
                                style={{ width: `${participant.completionRate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm font-medium">{participant.drillsCompleted}</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div className="text-xs sm:text-sm font-semibold text-red-600">{participant.points}</div>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <Badge 
                            className={`text-xs ${
                              participant.rank === 'Advanced' || participant.rank === 'Expert'
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : participant.rank === 'Intermediate'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : 'bg-green-100 text-green-700 border-green-200'
                            }`}
                          >
                            {participant.rank}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Drills Tab */}
      {activeTab === 'drills' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {drillStats.length === 0 ? (
              <div className="col-span-full">
                <Card className="p-8 sm:p-12 text-center">
                  <Target className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm sm:text-base text-gray-600">No drills created yet</p>
                </Card>
              </div>
            ) : (
              drillStats.map(drill => (
                <Card key={drill.id} className="p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className={`text-xs ${
                      drill.type === 'Virtual'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-green-100 text-green-700 border-green-200'
                    }`}>
                      {drill.type}
                    </Badge>
                  </div>
                  
                  <h3 className="text-sm sm:text-base font-semibold mb-2 line-clamp-2">{drill.title}</h3>
                  
                  <div className="space-y-2 text-xs sm:text-sm text-gray-600">
                    {drill.date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(drill.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{drill.registered} registered</span>
                      {drill.capacity && <span>/ {drill.capacity} capacity</span>}
                    </div>
                    
                    {drill.type === 'Virtual' && drill.avgScore > 0 && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>Avg. Score: {drill.avgScore}%</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Certificates Tab */}
      {activeTab === 'certificates' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Physical Drill Certificates</h2>
            <p className="text-sm text-gray-600">Award certificates to participants who completed physical drills</p>
          </div>

          {certifiedDrills.length === 0 ? (
            <Card className="p-8 sm:p-12 text-center">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm sm:text-base text-gray-600">No completed physical drills yet</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {certifiedDrills.map(drill => (
                <Card key={drill.id} className="p-4 sm:p-6">
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">{drill.title}</h3>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(drill.date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}</span>
                          </div>
                          <span>•</span>
                          <span>{drill.time}</span>
                          <span>•</span>
                          <span>{drill.location}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Instructor: {drill.instructor}
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        {drill.completedParticipants.length} Completed
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Participants:</h4>
                    {drill.completedParticipants.map(participant => (
                      <div 
                        key={participant.id}
                        className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{participant.full_name}</p>
                          <p className="text-xs text-gray-600 truncate">{participant.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Completed: {new Date(participant.completed_at).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex-shrink-0">
                          {participant.certificate_url ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle className="w-5 h-5" />
                              <span className="text-xs font-medium hidden sm:inline">Certificate Awarded</span>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => generateAndMakeCertificateAvailable(drill, participant)}
                              disabled={generatingCertificate === `${drill.id}-${participant.user_id}`}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {generatingCertificate === `${drill.id}-${participant.user_id}` ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  <span className="hidden sm:inline">Generating...</span>
                                  <span className="sm:hidden">...</span>
                                </>
                              ) : (
                                <>
                                  <Mail className="w-4 h-4 mr-2" />
                                  <span className="hidden sm:inline">Award & Notify</span>
                                  <span className="sm:hidden">Award</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}