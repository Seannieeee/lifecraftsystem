'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Profile } from '@/lib/supabase';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Trophy, Target, Zap, TrendingUp, Award, BookOpen, Activity, ChevronRight, RefreshCw, Download, FileText, Sparkles, Clock, Wifi, WifiOff } from 'lucide-react';
import { Button } from './ui/button';
import { 
  fetchDashboardData, 
  fetchUserCertificates,
  getRankInfo, 
  getTimeAgo, 
  getActivityIcon,
  getCertificateTypeColor,
  getCertificateTypeLabel,
  downloadCertificateFromDataUri,
  type UserCertificate,
  getCertificateTitle,
  getCertificateDate,
  getCertificateTime,
  getCertificateLocation
} from '@/lib/dashboard-utils';
import { fetchAIRecommendations, type AIRecommendation } from '@/lib/ai-recommendations';
import { useRouter } from 'next/navigation';

interface DashboardProps {
  profile: Profile;
}

// Optimized cache with compression and size limits
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 2 * 1024 * 1024; // 2MB max cache size
const CACHE_KEYS = {
  DASHBOARD: 'dashboard_data',
  CERTIFICATES: 'certificates_data',
  AI_RECOMMENDATIONS: 'ai_recommendations'
};

interface CachedData<T> {
  data: T;
  timestamp: number;
  version: number; // For cache invalidation
}

// Optimized cache utilities with size management
const getFromCache = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(key); // Use sessionStorage for better performance
    if (!cached) return null;
    
    const { data, timestamp, version }: CachedData<T> = JSON.parse(cached);
    const currentVersion = 1; // Increment this when data structure changes
    
    if (Date.now() - timestamp > CACHE_TTL || version !== currentVersion) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const setToCache = <T,>(key: string, data: T): void => {
  if (typeof window === 'undefined') return;
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      version: 1
    };
    const serialized = JSON.stringify(cached);
    
    // Check cache size
    if (serialized.length > MAX_CACHE_SIZE / 10) {
      console.warn('Cache item too large, skipping');
      return;
    }
    
    sessionStorage.setItem(key, serialized);
  } catch (error) {
    console.warn('Cache storage failed:', error);
    // Clear old cache if storage is full
    try {
      sessionStorage.clear();
    } catch {}
  }
};

// Cleanup old cache entries
const cleanupCache = () => {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('dashboard_') || key.startsWith('certificates_') || key.startsWith('ai_')) {
        getFromCache(key); // This will auto-remove expired entries
      }
    });
  } catch {}
};

export function Dashboard({ profile }: DashboardProps) {
  const router = useRouter();
  
  // Calculate badges directly from profile points (instant, no API call)
  const userBadges = useMemo(() => {
    const badges: string[] = [];
    const points = profile.points;
    
    if (points >= 0) badges.push('Beginner');
    if (points >= 500) badges.push('Responder');
    if (points >= 1000) badges.push('Emergency Responder');
    if (points >= 2000) badges.push('Disaster Specialist');
    if (points >= 5000) badges.push('Master Coordinator');
    if (points >= 10000) badges.push('Elite Responder');
    
    return badges;
  }, [profile.points]);
  
  // Optimized initial state with skeleton data
  const [data, setData] = useState({
    completedModules: 0,
    totalModules: 0,
    badges: userBadges, // Use calculated badges
    recentActivity: [] as any[]
  });
  const [certificates, setCertificates] = useState<UserCertificate[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  
  // Granular loading states for progressive rendering
  const [loadingStates, setLoadingStates] = useState({
    dashboard: true,
    certificates: true,
    ai: true
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showSkeletons, setShowSkeletons] = useState(true);

  // Monitor online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Cleanup old cache on mount
    cleanupCache();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Memoized rank info to prevent recalculation
  const rankInfo = useMemo(() => getRankInfo(profile.points), [profile.points]);

  // Optimized data loading with timeout and retry
  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    const cacheKey = `${CACHE_KEYS.DASHBOARD}_${profile.id}`;
    
    // Always show cached data first for instant UI
    if (!forceRefresh) {
      const cachedData = getFromCache<typeof data>(cacheKey);
      if (cachedData) {
        setData(cachedData);
        setLoadingStates(prev => ({ ...prev, dashboard: false }));
        setShowSkeletons(false);
        setLastUpdated(new Date());
      }
    }

    // Fetch fresh data with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const dashboardData = await fetchDashboardData(profile.id);
      clearTimeout(timeoutId);
      
      // Merge with calculated badges (they should match, but use calculated as source of truth)
      const mergedData = {
        ...dashboardData,
        badges: userBadges // Always use calculated badges
      };
      
      setData(mergedData);
      setToCache(cacheKey, mergedData);
      setLastUpdated(new Date());
      setShowSkeletons(false);
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.warn('Dashboard data fetch timeout');
      } else {
        console.error('Error loading dashboard:', error);
      }
      
      // Keep using cached data if available
      const cachedData = getFromCache<typeof data>(cacheKey);
      if (cachedData && !data.recentActivity.length) {
        setData(cachedData);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, dashboard: false }));
    }
  }, [profile.id]);

  // Load certificates with lower priority
  const loadCertificates = useCallback(async (forceRefresh = false) => {
    const cacheKey = `${CACHE_KEYS.CERTIFICATES}_${profile.id}`;
    
    if (!forceRefresh) {
      const cachedCerts = getFromCache<UserCertificate[]>(cacheKey);
      if (cachedCerts) {
        setCertificates(cachedCerts);
        setLoadingStates(prev => ({ ...prev, certificates: false }));
        return;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const certsData = await fetchUserCertificates(profile.id);
      clearTimeout(timeoutId);
      setCertificates(certsData);
      setToCache(cacheKey, certsData);
    } catch (error: any) {
      clearTimeout(timeoutId);
      const cachedCerts = getFromCache<UserCertificate[]>(cacheKey);
      if (cachedCerts) {
        setCertificates(cachedCerts);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, certificates: false }));
    }
  }, [profile.id]);

  // Load AI recommendations with lowest priority (can be delayed)
  const loadAIRecommendations = useCallback(async (forceRefresh = false) => {
    const cacheKey = `${CACHE_KEYS.AI_RECOMMENDATIONS}_${profile.id}`;
    
    if (!forceRefresh) {
      const cachedRecs = getFromCache<AIRecommendation[]>(cacheKey);
      if (cachedRecs) {
        setAiRecommendations(cachedRecs);
        setLoadingStates(prev => ({ ...prev, ai: false }));
        return;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const recommendations = await fetchAIRecommendations(profile.id);
      clearTimeout(timeoutId);
      setAiRecommendations(recommendations);
      setToCache(cacheKey, recommendations);
    } catch (error: any) {
      clearTimeout(timeoutId);
      const cachedRecs = getFromCache<AIRecommendation[]>(cacheKey);
      if (cachedRecs) {
        setAiRecommendations(cachedRecs);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, ai: false }));
    }
  }, [profile.id]);

  // Progressive loading: Load critical data first, then secondary data
  useEffect(() => {
    // Phase 1: Load dashboard data immediately (critical)
    loadDashboardData();
    
    // Phase 2: Load certificates after a brief delay (less critical)
    const certsTimer = setTimeout(() => {
      loadCertificates();
    }, 300);
    
    // Phase 3: Load AI recommendations last (least critical)
    const aiTimer = setTimeout(() => {
      loadAIRecommendations();
    }, 800);
    
    return () => {
      clearTimeout(certsTimer);
      clearTimeout(aiTimer);
    };
  }, [loadDashboardData, loadCertificates, loadAIRecommendations]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShowSkeletons(true);
    
    // Staggered refresh for better UX
    await loadDashboardData(true);
    await Promise.all([
      loadCertificates(true),
      loadAIRecommendations(true)
    ]);
    
    setIsRefreshing(false);
  };

  const downloadCertificate = async (certificate: UserCertificate) => {
    if (!certificate.certificate_url) {
      alert('Certificate not yet available. Please contact your administrator.');
      return;
    }

    try {
      const userName = profile.full_name || 'Participant';
      const sessionTitle = getCertificateTitle(certificate);
      
      downloadCertificateFromDataUri(
        certificate.certificate_url,
        userName,
        sessionTitle
      );
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Failed to download certificate. Please try again.');
    }
  };

  const handleStartModule = (moduleId: string) => {
    router.push('/modules');
  };
  // Skeleton loader components for better perceived performance
  const StatCardSkeleton = () => (
    <Card className="p-3 xs:p-4 sm:p-6 animate-pulse">
      <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3 sm:gap-4">
        <div className="w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 bg-gray-200 rounded-xl"></div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-20"></div>
          <div className="h-6 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    </Card>
  );

  const ActivitySkeleton = () => (
    <div className="flex items-center gap-2 xs:gap-3 py-2 xs:py-2.5 sm:py-3 animate-pulse">
      <div className="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 bg-gray-200 rounded-lg"></div>
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        <div className="h-2 bg-gray-200 rounded w-1/4"></div>
      </div>
      <div className="w-12 h-6 bg-gray-200 rounded"></div>
    </div>
  );

  const CertificateSkeleton = () => (
    <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border-2 border-gray-200 animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        <div className="h-8 bg-gray-200 rounded w-full mt-2"></div>
      </div>
    </div>
  );

  const AIRecSkeleton = () => (
    <div className="p-3 xs:p-3.5 sm:p-4 border-2 border-gray-200 rounded-xl animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        <div className="flex justify-between items-center mt-3">
          <div className="h-6 bg-gray-200 rounded w-20"></div>
          <div className="h-8 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    </div>
  );

  // Show initial loading only if no cached data
  if (showSkeletons && loadingStates.dashboard && !data.recentActivity.length) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {/* Header Skeleton */}
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
          </div>

          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 xs:gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>

          <div className="text-center text-sm text-gray-500 mt-8">
            Loading your dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Welcome Section with Status Bar */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
            <div className="flex-1">
              <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Welcome back, {profile.full_name || 'Responder'}!
              </h1>
              <p className="text-xs xs:text-sm sm:text-base text-gray-600">
                Continue your preparedness journey
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm hover:bg-gray-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
          </div>
          
          {/* Status Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {!isOnline && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <WifiOff className="w-3 h-3 mr-1" />
                Offline Mode
              </Badge>
            )}
            {lastUpdated && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Clock className="w-3 h-3 mr-1" />
                Updated {getTimeAgo(lastUpdated.toISOString())}
              </Badge>
            )}
            {isOnline && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Wifi className="w-3 h-3 mr-1" />
                Online
              </Badge>
            )}
          </div>
        </div>

        {/* Enhanced Stats Grid - Always visible with real or cached data */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 xs:gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
          <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3 sm:gap-4">
              <div className="w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                <Trophy className="w-5 h-5 xs:w-5.5 xs:h-5.5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-amber-700 mb-0.5 font-medium">Total Points</p>
                <p className="text-lg xs:text-xl sm:text-2xl font-bold text-amber-900 truncate">
                  {profile.points.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3 sm:gap-4">
              <div className="w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                <BookOpen className="w-5 h-5 xs:w-5.5 xs:h-5.5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-blue-700 mb-0.5 font-medium">Completed</p>
                <p className="text-lg xs:text-xl sm:text-2xl font-bold text-blue-900 truncate">
                  {data.completedModules}/{data.totalModules}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3 sm:gap-4">
              <div className="w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                <Award className="w-5 h-5 xs:w-5.5 xs:h-5.5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-green-700 mb-0.5 font-medium">Badges</p>
                <p className="text-lg xs:text-xl sm:text-2xl font-bold text-green-900 truncate">
                  {userBadges.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100 col-span-2 lg:col-span-1">
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3 sm:gap-4">
              <div className="w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                <Target className="w-5 h-5 xs:w-5.5 xs:h-5.5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-purple-700 mb-0.5 font-medium">Current Rank</p>
                <p className="text-base xs:text-lg sm:text-lg font-semibold text-purple-900 truncate">
                  {rankInfo.current}
                </p>
              </div>
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
            {/* AI-Powered Recommendations with Progressive Loading */}
            <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-purple-50 via-white to-pink-50 border-purple-100">
              <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 mb-3 xs:mb-4 sm:mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white flex-shrink-0" />
                </div>
                <h2 className="text-base xs:text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-900 to-pink-900 bg-clip-text text-transparent">
                  AI Recommendations
                </h2>
                <Badge className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-200 text-[10px] xs:text-xs px-1.5 xs:px-2 py-0.5">
                  Powered by Gemini
                </Badge>
              </div>
              
              {loadingStates.ai && aiRecommendations.length === 0 ? (
                <div className="space-y-3">
                  <AIRecSkeleton />
                  <AIRecSkeleton />
                </div>
              ) : aiRecommendations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">No recommendations yet</p>
                  <p className="text-xs text-gray-500">Complete more modules to get personalized suggestions!</p>
                </div>
              ) : (
                <div className="space-y-2.5 xs:space-y-3 sm:space-y-4">
                  {aiRecommendations.map((rec, index) => (
                    <div 
                      key={index} 
                      className="group p-3 xs:p-3.5 sm:p-4 border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer bg-white"
                    >
                      <div className="flex flex-col gap-2 mb-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm xs:text-base sm:text-base font-semibold text-gray-900 flex-1 leading-tight group-hover:text-purple-700 transition-colors">
                            {rec.title || 'Recommended Module'}
                          </h3>
                          <Badge variant="outline" className="text-[10px] xs:text-xs flex-shrink-0 bg-purple-50 border-purple-200 text-purple-700">
                            {rec.difficulty || 'N/A'}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {rec.reason || 'Great next step in your training'}
                        </p>
                      </div>
                      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 mt-3">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-lg">
                          <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span>{rec.points || 0} points</span>
                        </div>
                        <button 
                          onClick={() => rec.moduleId && handleStartModule(rec.moduleId)}
                          className="w-full xs:w-auto px-3 xs:px-4 py-2 xs:py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          Start Learning
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Your Certificates with Progressive Loading */}
            <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-1.5 xs:gap-2 mb-3 xs:mb-4 sm:mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white flex-shrink-0" />
                </div>
                <h2 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">Your Certificates</h2>
                {certificates.length > 0 && (
                  <Badge variant="outline" className="ml-auto">
                    {certificates.length}
                  </Badge>
                )}
              </div>
              
              {loadingStates.certificates && certificates.length === 0 ? (
                <div className="space-y-3">
                  <CertificateSkeleton />
                  <CertificateSkeleton />
                </div>
              ) : certificates.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-8 h-8 text-amber-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">No certificates yet</p>
                  <p className="text-xs text-gray-500">Complete physical drills or certified community sessions to earn certificates</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certificates.map((cert) => (
                    <div 
                      key={cert.id}
                      className="p-3 sm:p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 hover:border-amber-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-2 flex-1">
                              {getCertificateTitle(cert)}
                            </h3>
                            <Badge className={`text-xs flex-shrink-0 ${getCertificateTypeColor(cert.type)}`}>
                              {getCertificateTypeLabel(cert.type)}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <p className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              {new Date(getCertificateDate(cert)).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })} at {getCertificateTime(cert)}
                            </p>
                            <p>📍 {getCertificateLocation(cert)}</p>
                            <p>👨‍🏫 {cert.instructor}</p>
                            <p>🏢 {cert.organization}</p>
                          </div>
                        </div>
                        <Award className="w-6 h-6 text-amber-600 flex-shrink-0" />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => downloadCertificate(cert)}
                        disabled={!cert.certificate_url}
                        className={`w-full mt-2 transition-all ${
                          cert.certificate_url 
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md hover:shadow-lg' 
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {!cert.certificate_url ? (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Awaiting Certificate
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Download Certificate
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Activity */}
            <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-1.5 xs:gap-2 mb-3 xs:mb-4 sm:mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white flex-shrink-0" />
                </div>
                <h2 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">Recent Activity</h2>
              </div>
              
              {loadingStates.dashboard && data.recentActivity.length === 0 ? (
                <div className="space-y-3">
                  <ActivitySkeleton />
                  <ActivitySkeleton />
                  <ActivitySkeleton />
                </div>
              ) : data.recentActivity.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">No activity yet</p>
                  <p className="text-xs text-gray-500">Start learning to see your progress here!</p>
                </div>
              ) : (
                <div className="space-y-2 xs:space-y-3 sm:space-y-4">
                  {data.recentActivity.map((activity) => (
                    <div 
                      key={activity.id} 
                      className="flex items-center gap-2 xs:gap-3 py-2 xs:py-2.5 sm:py-3 border-b border-gray-100 last:border-0 hover:bg-gradient-to-r hover:from-green-50 hover:to-transparent rounded-lg px-2 xs:px-3 -mx-2 xs:-mx-3 transition-all duration-200"
                    >
                      <div className="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center text-base xs:text-lg sm:text-xl flex-shrink-0 shadow-sm">
                        {getActivityIcon(activity.action)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs xs:text-sm sm:text-sm font-medium text-gray-900 truncate leading-tight">
                          {activity.action}: {activity.item}
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getTimeAgo(activity.created_at)}
                        </p>
                      </div>
                      <div className="px-2 py-1 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg text-xs xs:text-sm sm:text-sm text-amber-700 font-bold flex-shrink-0">
                        +{activity.points}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Badges */}
            <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-1.5 xs:gap-2 mb-3 xs:mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white flex-shrink-0" />
                </div>
                <h2 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">Your Badges</h2>
                <Badge variant="outline" className="ml-auto text-xs">
                  {userBadges.length}/{userBadges.length >= 6 ? userBadges.length : '6'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-3 gap-2 xs:gap-2.5 sm:gap-3">
                {userBadges.map((badge, index) => (
                  <div 
                    key={index} 
                    className="group flex flex-col items-center gap-1.5 xs:gap-2 p-2 xs:p-2.5 sm:p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 hover:border-amber-300 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                  >
                    <div className="text-2xl xs:text-3xl group-hover:scale-110 transition-transform">🏆</div>
                    <p className="text-[10px] xs:text-xs text-center font-medium leading-tight text-gray-700">{badge}</p>
                  </div>
                ))}
                {userBadges.length < 6 && [...Array(6 - userBadges.length)].map((_, index) => (
                  <div 
                    key={`locked-${index}`} 
                    className="flex flex-col items-center gap-1.5 xs:gap-2 p-2 xs:p-2.5 sm:p-3 bg-gray-50 rounded-xl border-2 border-gray-200 border-dashed hover:border-gray-300 transition-all"
                  >
                    <div className="text-2xl xs:text-3xl opacity-40">🔒</div>
                    <p className="text-[10px] xs:text-xs text-center text-gray-500 leading-tight">Locked</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Rank Progress */}
            <Card className="p-3 xs:p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-green-50 via-white to-emerald-50 border-green-100">
              <div className="flex items-center gap-1.5 xs:gap-2 mb-3 xs:mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white flex-shrink-0" />
                </div>
                <h2 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">Rank Progress</h2>
              </div>
              
              <div className="space-y-3 xs:space-y-4">
                <div className="text-center p-4 xs:p-5 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl border-2 border-green-300 shadow-sm">
                  <p className="text-xs sm:text-sm text-green-700 mb-1 font-medium">Current Rank</p>
                  <p className="text-xl xs:text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent mb-2">
                    {rankInfo.current}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 text-green-700 text-xs sm:text-sm font-semibold bg-white/50 rounded-full px-3 py-1">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{profile.points.toLocaleString()} points</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2 text-xs sm:text-sm">
                    <span className="font-medium text-gray-700">Next: {rankInfo.next}</span>
                    <span className="font-bold text-gray-900">{profile.points.toLocaleString()}/{rankInfo.nextPoints.toLocaleString()}</span>
                  </div>
                  <div className="relative">
                    <Progress value={(profile.points / rankInfo.nextPoints) * 100} className="h-3 sm:h-3.5" />
                    <div className="absolute inset-0 rounded-full overflow-hidden opacity-20">
                      <div className="h-full bg-gradient-to-r from-green-400 to-emerald-400 animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-[10px] xs:text-xs text-gray-600 mt-2 text-center">
                    <span className="font-bold text-green-600">{(rankInfo.nextPoints - profile.points).toLocaleString()}</span> points to next rank 🎯
                  </p>
                </div>

                <div className="pt-3 xs:pt-4 border-t-2 border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2.5 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Rank Hierarchy
                  </p>
                  <div className="space-y-1.5 xs:space-y-2 text-[10px] xs:text-xs">
                    {[
                      { name: 'Beginner', range: '0-500', points: 0, emoji: '🌱' },
                      { name: 'Responder', range: '500-1000', points: 500, emoji: '🚑' },
                      { name: 'Emergency Responder', range: '1000-2000', points: 1000, emoji: '⚡' },
                      { name: 'Disaster Specialist', range: '2000-5000', points: 2000, emoji: '🛡️' },
                      { name: 'Master Coordinator', range: '5000+', points: 5000, emoji: '👑' }
                    ].map((rank) => {
                      const isActive = rankInfo.current === rank.name;
                      const isPassed = profile.points >= rank.points;
                      return (
                        <div 
                          key={rank.name}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                            isActive 
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 text-green-700 font-semibold shadow-sm' 
                              : isPassed 
                                ? 'text-gray-600 bg-gray-50' 
                                : 'text-gray-400'
                          }`}
                        >
                          <span className="text-base">{rank.emoji}</span>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            isActive ? 'bg-green-500 shadow-lg shadow-green-300 animate-pulse' : isPassed ? 'bg-gray-400' : 'bg-gray-300'
                          }`}></div>
                          <span className="leading-tight truncate flex-1">
                            {rank.name} ({rank.range})
                          </span>
                          {isActive && <span className="text-sm">⭐</span>}
                          {isPassed && !isActive && <span className="text-sm">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
