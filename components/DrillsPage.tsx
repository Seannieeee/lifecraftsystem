import { useState, useEffect, useRef } from 'react';
import type { Profile } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Target, Clock, MapPin, Calendar, CheckCircle, Play, TrendingUp, Loader2, ClipboardList, Plus, Edit, RefreshCw, AlertCircle, Inbox, Activity, Lock, BookOpen } from 'lucide-react';
import {
  getDrillsWithUserStatus,
  startVirtualDrill,
  completeVirtualDrill,
  registerForPhysicalDrill,
  getUserDrillStats,
  getUserPerformanceHistory,
  hasCompletedModule,
  type DrillWithUserStatus,
  type UserDrillStats,
  type PerformanceRecord
} from '@/lib/drills-utils';
import { InteractiveDrillInterface } from './InteractiveDrillInterface';
import { DrillFormModal } from './DrillFormModal';
import { AdminDrillRegistrations } from './AdminDrillRegistration';

interface DrillsPageProps {
  profile: Profile;
  onNavigate?: (page: string) => void;
}

interface CacheData<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000;

const cache = {
  drills: null as CacheData<DrillWithUserStatus[]> | null,
  stats: null as CacheData<UserDrillStats> | null,
  performance: null as CacheData<PerformanceRecord[]> | null,
};

const isCacheValid = <T,>(cached: CacheData<T> | null): boolean => {
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_DURATION;
};

export function DrillsPage({ profile, onNavigate }: DrillsPageProps) {
  const [activeTab, setActiveTab] = useState<'virtual' | 'physical' | 'scores'>('virtual');
  const [drills, setDrills] = useState<DrillWithUserStatus[]>([]);
  const [stats, setStats] = useState<UserDrillStats>({ drillsCompleted: 0, averageScore: 0, scheduled: 0 });
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeDrill, setActiveDrill] = useState<{ id: string; title: string; userDrillId: string; isRetry: boolean } | null>(null);
  const [showAdminView, setShowAdminView] = useState(false);
  const [showDrillForm, setShowDrillForm] = useState(false);
  const [editingDrill, setEditingDrill] = useState<DrillWithUserStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasModuleAccess, setHasModuleAccess] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const isMountedRef = useRef(true);
  const isAdmin = profile.role === 'admin';

  useEffect(() => {
    isMountedRef.current = true;
    checkModuleAccess();
    return () => { isMountedRef.current = false; };
  }, [profile.id]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const checkModuleAccess = async () => {
    try {
      setCheckingAccess(true);
      // Admins always have access
      if (isAdmin) {
        setHasModuleAccess(true);
        await loadData();
      } else {
        const hasCompleted = await hasCompletedModule(profile.id);
        setHasModuleAccess(hasCompleted);
        if (hasCompleted) {
          await loadData();
        }
      }
    } catch (error) {
      console.error('Error checking module access:', error);
      setError('Failed to verify access. Please try again.');
    } finally {
      setCheckingAccess(false);
    }
  };

  const loadData = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) setLoading(true);
      else setRefreshing(true);
      setError(null);

      if (!forceRefresh && isCacheValid(cache.drills) && isCacheValid(cache.stats) && isCacheValid(cache.performance)) {
        if (isMountedRef.current) {
          setDrills(cache.drills!.data);
          setStats(cache.stats!.data);
          setPerformanceHistory(cache.performance!.data);
          setLoading(false);
          setRefreshing(false);
        }
        loadFreshData();
        return;
      }
      await loadFreshData();
    } catch (error) {
      console.error('Error loading drills:', error);
      if (isMountedRef.current) setError('Failed to load drills. Please try again.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const loadFreshData = async () => {
    const [drillsData, statsData, historyData] = await Promise.all([
      getDrillsWithUserStatus(profile.id),
      getUserDrillStats(profile.id),
      getUserPerformanceHistory(profile.id)
    ]);
    const now = Date.now();
    cache.drills = { data: drillsData, timestamp: now };
    cache.stats = { data: statsData, timestamp: now };
    cache.performance = { data: historyData, timestamp: now };
    if (isMountedRef.current) {
      setDrills(drillsData);
      setStats(statsData);
      setPerformanceHistory(historyData);
    }
  };

  const handleRefresh = async () => {
    await checkModuleAccess();
    if (hasModuleAccess) {
      await loadData(true);
    }
  };

  const handleStartVirtualDrill = async (drillId: string, drillTitle: string) => {
    if (!hasModuleAccess && !isAdmin) {
      setError('You must complete at least one module before accessing drills.');
      return;
    }
    
    try {
      setActionLoading(drillId);
      setError(null);
      const drill = drills.find(d => d.id === drillId);
      const isRetry = drill?.userDrill?.status === 'completed';
      const userDrill = await startVirtualDrill(profile.id, drillId);
      setActiveDrill({ id: drillId, title: drillTitle, userDrillId: userDrill.id, isRetry });
      setActionLoading(null);
    } catch (error: any) {
      console.error('Error starting drill:', error);
      setError(error.message || 'Failed to start drill. Please try again.');
      setActionLoading(null);
    }
  };

  const handleRegisterPhysicalDrill = async (drillId: string) => {
    if (!hasModuleAccess && !isAdmin) {
      setError('You must complete at least one module before registering for drills.');
      return;
    }

    if (isAdmin) {
      setError('Admins cannot register for physical drills. You can only manage drill registrations.');
      return;
    }
    
    try {
      setActionLoading(drillId);
      setError(null);
      await registerForPhysicalDrill(profile.id, drillId);
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadData(true);
    } catch (error: any) {
      console.error('Error registering:', error);
      setError(error.message || 'Failed to register for drill. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDrillComplete = async (score: number, timeSpent: string) => {
    if (!activeDrill) return;
    try {
      const drill = drills.find(d => d.id === activeDrill.id);
      const previousBestScore = drill?.userDrill?.score || 0;
      await completeVirtualDrill(profile.id, activeDrill.id, score, timeSpent, activeDrill.isRetry);
      if (!activeDrill.isRetry && score > previousBestScore) {
        const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
        if (updatedProfile) Object.assign(profile, updatedProfile);
      }
      setActiveDrill(null);
      await loadData(true);
    } catch (error) {
      console.error('Error completing drill:', error);
      setError('Failed to save drill results. Please try again.');
    }
  };

  const handleDrillExit = () => setActiveDrill(null);

  const handleCreateDrill = () => {
    setEditingDrill(null);
    setShowDrillForm(true);
  };

  const handleEditDrill = (drill: DrillWithUserStatus) => {
    setEditingDrill(drill);
    setShowDrillForm(true);
  };

  const handleDrillFormClose = () => {
    setShowDrillForm(false);
    setEditingDrill(null);
  };

  const handleDrillFormSuccess = async () => {
    setShowDrillForm(false);
    setEditingDrill(null);
    await loadData(true);
  };

  const handleNavigateToModules = () => {
    if (onNavigate) {
      onNavigate('modules');
    }
  };

  // Show access denied screen for non-admin users without module completion
  if (checkingAccess) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (!hasModuleAccess && !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <Card className="p-8 sm:p-12 text-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-gray-900">Drills Locked</h2>
              <p className="text-base sm:text-lg text-gray-600 font-medium mb-6 max-w-2xl">
                To access emergency response drills, you need to complete at least one training module first. This ensures you have the foundational knowledge needed to participate effectively.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Why complete modules first?
                </h3>
                <ul className="text-sm text-gray-700 space-y-2 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Build essential emergency response knowledge</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Learn proper protocols and procedures</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Prepare for realistic drill scenarios</span>
                  </li>
                </ul>
              </div>
              <Button 
                onClick={handleNavigateToModules} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-lg px-8 py-6"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Go to Training Modules
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (showAdminView && isAdmin) {
    return (
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button onClick={() => setShowAdminView(false)} variant="outline" className="mb-4">← Back to Drills</Button>
        </div>
        <AdminDrillRegistrations />
      </div>
    );
  }

  const virtualDrills = drills.filter(d => d.type === 'Virtual');
  const physicalDrills = drills.filter(d => d.type === 'Physical');

  const DrillCardSkeleton = () => (
    <Card className="p-4 sm:p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-6 w-20 bg-gray-200 rounded"></div>
        <div className="h-6 w-16 bg-gray-200 rounded"></div>
      </div>
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-2"></div>
      <div className="h-4 w-full bg-gray-200 rounded mb-4"></div>
      <div className="space-y-2 mb-4">
        <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
        <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
      </div>
      <div className="h-10 w-full bg-gray-200 rounded"></div>
    </Card>
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-96 bg-gray-200 rounded animate-pulse"></div>
        </div>
        {!isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 sm:p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                    <div className="h-6 w-16 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-32 bg-gray-200 rounded-t animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (<DrillCardSkeleton key={i} />))}
        </div>
      </div>
    );
  }

  // Continues in Part 2...
  // ... continuing from Part 1

  return (
    <>
      {activeDrill && (
        <InteractiveDrillInterface
          drillId={activeDrill.id}
          drillTitle={activeDrill.title}
          userId={profile.id}
          userDrillId={activeDrill.userDrillId}
          isRetry={activeDrill.isRetry}
          onComplete={handleDrillComplete}
          onExit={handleDrillExit}
        />
      )}
      {showDrillForm && (
        <DrillFormModal drill={editingDrill} onClose={handleDrillFormClose} onSuccess={handleDrillFormSuccess} />
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900">Emergency Response Drills</h1>
            <p className="text-sm sm:text-base text-gray-600 font-medium">Practice and assess your preparedness skills</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="border-gray-300 font-medium">
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isAdmin && activeTab === 'physical' && (
              <Button onClick={() => setShowAdminView(true)} variant="outline" className="border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-medium">
                <ClipboardList className="w-4 h-4 mr-2" />
                Manage Registrations
              </Button>
            )}
          </div>
        </div>
        {error && (
          <Alert className="mb-6 bg-orange-50 border-orange-300">
            <AlertCircle className="h-4 w-4 text-orange-700" />
            <AlertDescription className="text-orange-900 font-medium flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-auto p-1 hover:bg-orange-100 text-lg font-semibold">×</Button>
            </AlertDescription>
          </Alert>
        )}
        {!isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-700 font-semibold">Drills Completed</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.drillsCompleted}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-700 font-semibold">Average Score</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.averageScore}%</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-700 font-semibold">Approved</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.scheduled}</p>
                </div>
              </div>
            </Card>
          </div>
        )}
        <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
          <button onClick={() => setActiveTab('virtual')} className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors relative ${activeTab === 'virtual' ? 'text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`}>
            Virtual Drills
            {activeTab === 'virtual' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
          <button onClick={() => setActiveTab('physical')} className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors relative ${activeTab === 'physical' ? 'text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`}>
            Physical Drills
            {activeTab === 'physical' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
          <button onClick={() => setActiveTab('scores')} className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors relative ${activeTab === 'scores' ? 'text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`}>
            My Scores
            {activeTab === 'scores' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        </div>
        {activeTab === 'virtual' && (
          <>
            {isAdmin && (
              <div className="mb-4">
                <Button onClick={handleCreateDrill} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                  <Plus className="w-4 h-4 mr-2" />Create New Drill
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {virtualDrills.length === 0 ? (
                <Card className="lg:col-span-2 p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <Activity className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-2 text-gray-900">No Virtual Drills Available</h3>
                      <p className="text-sm sm:text-base text-gray-600 font-medium mb-4">{isAdmin ? "Get started by creating your first virtual drill for the team." : "Check back later for new virtual drills to test your skills."}</p>
                      {isAdmin && (<Button onClick={handleCreateDrill} className="bg-indigo-600 hover:bg-indigo-700 font-medium"><Plus className="w-4 h-4 mr-2" />Create Virtual Drill</Button>)}
                    </div>
                  </div>
                </Card>
              ) : (
                virtualDrills.map(drill => {
                  const isCompleted = drill.userDrill?.status === 'completed';
                  const isLoading = actionLoading === drill.id;
                  return (
                    <Card key={drill.id} className="p-4 sm:p-6 hover:shadow-lg transition-shadow duration-200">
                      <div className="flex items-start justify-between mb-3 sm:mb-4">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm font-semibold">{drill.type}</Badge>
                        <div className="flex items-center gap-2">
                          {!isAdmin && isCompleted && (
                            <div className="flex items-center gap-1 text-green-600 text-xs sm:text-sm font-bold">
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span>Best: {drill.userDrill?.score}%</span>
                            </div>
                          )}
                          {isAdmin && (
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleEditDrill(drill); }} className="h-8 px-2 hover:bg-gray-50 font-medium">
                              <Edit className="w-4 h-4 mr-1" />Edit
                            </Button>
                          )}
                        </div>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold mb-2 line-clamp-2 text-gray-900">{drill.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-700 mb-3 sm:mb-4 line-clamp-2 font-medium">{drill.description}</p>
                      <div className="space-y-2 mb-3 sm:mb-4">
                        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-700 font-medium">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{drill.duration}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge className={`text-xs font-semibold ${drill.difficulty === 'Beginner' ? 'bg-green-100 text-green-800 border-green-200' : drill.difficulty === 'Intermediate' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'}`}>{drill.difficulty}</Badge>
                          {drill.points > 0 && (
                            <div className="text-xs sm:text-sm text-amber-700 font-bold">{isCompleted ? 'No points on retry' : `+${drill.points} pts`}</div>
                          )}
                        </div>
                      </div>
                      {isAdmin ? (
                        <Button disabled className="w-full text-sm sm:text-base font-semibold bg-gray-100 text-gray-500 cursor-not-allowed">Admin - Cannot Start Drill</Button>
                      ) : (
                        <Button onClick={() => handleStartVirtualDrill(drill.id, drill.title)} disabled={isLoading} className={`w-full text-sm sm:text-base font-semibold transition-all ${isCompleted ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                          {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) : isCompleted ? (<><Play className="w-4 h-4 mr-2" />Retry Drill</>) : (<><Play className="w-4 h-4 mr-2" />Start Drill</>)}
                        </Button>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}
        {activeTab === 'physical' && (
          <>
            {isAdmin && (
              <div className="mb-4">
                <Button onClick={handleCreateDrill} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                  <Plus className="w-4 h-4 mr-2" />Create New Drill
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {physicalDrills.length === 0 ? (
                <Card className="lg:col-span-2 p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-2 text-gray-900">No Physical Drills Scheduled</h3>
                      <p className="text-sm sm:text-base text-gray-600 font-medium mb-4">{isAdmin ? "Schedule your first physical drill to train the team in real-world scenarios." : "No physical drills are currently scheduled. Check back later for upcoming sessions."}</p>
                      {isAdmin && (<Button onClick={handleCreateDrill} className="bg-indigo-600 hover:bg-indigo-700 font-medium"><Plus className="w-4 h-4 mr-2" />Schedule Physical Drill</Button>)}
                    </div>
                  </div>
                </Card>
              ) : (
                physicalDrills.map(drill => {
                  const isRegistered = drill.userDrill?.status === 'pending' || drill.userDrill?.status === 'approved';
                  const isLoading = actionLoading === drill.id;
                  return (
                    <Card key={drill.id} className="p-4 sm:p-6 hover:shadow-lg transition-shadow duration-200">
                      <div className="flex items-start justify-between mb-3 sm:mb-4">
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs sm:text-sm font-semibold">{drill.type}</Badge>
                        <div className="flex items-center gap-2">
                          {!isAdmin && isRegistered && (
                            <Badge className={`text-xs sm:text-sm font-semibold ${drill.userDrill?.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                              {drill.userDrill?.status === 'approved' ? 'Approved' : 'Pending'}
                            </Badge>
                          )}
                          {isAdmin && (
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleEditDrill(drill); }} className="h-8 px-2 hover:bg-gray-50 font-medium">
                              <Edit className="w-4 h-4 mr-1" />Edit
                            </Button>
                          )}
                        </div>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold mb-2 line-clamp-2 text-gray-900">{drill.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-700 mb-3 sm:mb-4 line-clamp-2 font-medium">{drill.description}</p>
                      <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>{drill.date} at {drill.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="line-clamp-1">{drill.location}</span>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-700 font-medium">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{drill.duration}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <Badge className={`text-xs font-semibold ${drill.difficulty === 'Beginner' ? 'bg-green-100 text-green-800 border-green-200' : drill.difficulty === 'Intermediate' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'}`}>{drill.difficulty}</Badge>
                          <div className="text-xs sm:text-sm text-gray-600 font-semibold">No points</div>
                        </div>
                      </div>
                      {isAdmin ? (
                        <Button disabled className="w-full text-sm sm:text-base font-semibold bg-gray-100 text-gray-500 cursor-not-allowed">Admin - Cannot Register</Button>
                      ) : (
                        <Button onClick={() => handleRegisterPhysicalDrill(drill.id)} disabled={isRegistered || isLoading} className={`w-full text-sm sm:text-base font-semibold transition-all ${isRegistered ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                          {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) : isRegistered ? (drill.userDrill?.status === 'approved' ? 'Approved' : 'Pending Approval') : ('Register')}
                        </Button>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}
        {activeTab === 'scores' && (
          <div className="space-y-4 sm:space-y-6">
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900">Best Scores Per Drill</h2>
              <div className="space-y-3 sm:space-y-4">
                {performanceHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Inbox className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-gray-900">No Scores Yet</h3>
                    <p className="text-sm sm:text-base text-gray-600 font-medium mb-6">Start completing virtual drills to track your performance and see your progress over time.</p>
                    <Button onClick={() => setActiveTab('virtual')} className="bg-indigo-600 hover:bg-indigo-700 font-medium">
                      <Play className="w-4 h-4 mr-2" />Start Your First Drill
                    </Button>
                  </div>
                ) : (
                  (() => {
                    const bestScores = performanceHistory.reduce<Record<string, PerformanceRecord>>((acc, record) => {
                      const drillId = record.drill_id;
                      if (!drillId) return acc;
                      const currentScore = typeof record.score === 'number' ? record.score : 0;
                      const bestRecord = acc[drillId];
                      const bestScore = bestRecord && typeof bestRecord.score === 'number' ? bestRecord.score : 0;
                      if (!bestRecord || currentScore > bestScore) {
                        acc[drillId] = record;
                      }
                      return acc;
                    }, {});
                    return Object.values(bestScores).map((record, index: number) => {
                      const score = record.score || 0;
                      const scoreColor = score >= 80 ? 'from-green-500 to-emerald-600' : score >= 60 ? 'from-blue-500 to-cyan-600' : 'from-amber-500 to-orange-600';
                      return (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 gap-3 sm:gap-4 hover:shadow-md transition-shadow">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm sm:text-base font-bold mb-2 line-clamp-2 text-gray-900">{record.drills?.title || 'Unknown Drill'}</h3>
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-700 font-medium">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>Last: {record.completed_at ? new Date(record.completed_at).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              {record.completion_time && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Time: {record.completion_time}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="text-right">
                              <div className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r ${scoreColor} bg-clip-text text-transparent`}>{score}%</div>
                              <div className="text-xs text-gray-700 font-bold">Best Score</div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}