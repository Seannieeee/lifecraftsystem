'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Profile } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { getUserModuleProgress } from '@/lib/modules-utils';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { BookOpen, Clock, Trophy, CheckCircle, Lock, Play, RefreshCw, Edit, X, Sparkles, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { LessonViewer } from './LessonViewer';
import { ModuleFormModal } from './ModuleFormModal';

interface ModulesPageProps {
  profile: Profile;
}

interface Module {
  id: string;
  title: string;
  description: string;
  duration: string;
  points: number;
  difficulty: string;
  lessons: number;
  category: string;
  locked: boolean;
}

interface ModuleWithProgress extends Module {
  progress: number;
  completed: boolean;
  score: number | null;
}

interface UserModuleData {
  user_id: string;
  score: number;
  completed_at: string;
  full_name: string;
  email: string;
}

interface CacheData {
  modules: ModuleWithProgress[];
  moduleUsers: Map<string, UserModuleData[]>;
  timestamp: number;
}

// Cache helper using IndexedDB-like approach with fallback to memory
class ModuleCache {
  private static CACHE_KEY = 'modules_cache_v1';
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private memoryCache: CacheData | null = null;

  async get(): Promise<CacheData | null> {
    // Try memory first
    if (this.memoryCache) {
      const age = Date.now() - this.memoryCache.timestamp;
      if (age < ModuleCache.CACHE_DURATION) {
        return this.memoryCache;
      }
    }

    // Try sessionStorage
    try {
      const cached = sessionStorage.getItem(ModuleCache.CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        if (age < ModuleCache.CACHE_DURATION) {
          // Reconstruct Map from plain object
          data.moduleUsers = new Map(Object.entries(data.moduleUsers || {}));
          this.memoryCache = data;
          return data;
        }
      }
    } catch (e) {
      console.warn('Cache read failed:', e);
    }
    return null;
  }

  async set(data: CacheData): Promise<void> {
    this.memoryCache = data;
    try {
      // Convert Map to plain object for storage
      const storageData = {
        ...data,
        moduleUsers: Object.fromEntries(data.moduleUsers)
      };
      sessionStorage.setItem(ModuleCache.CACHE_KEY, JSON.stringify(storageData));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
  }

  clear(): void {
    this.memoryCache = null;
    try {
      sessionStorage.removeItem(ModuleCache.CACHE_KEY);
    } catch (e) {
      console.warn('Cache clear failed:', e);
    }
  }
}

const cache = new ModuleCache();

// Skeleton loader component
const ModuleSkeleton = () => (
  <Card className="p-4 sm:p-6 animate-pulse">
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="h-6 bg-gray-200 rounded w-20"></div>
        <div className="h-8 bg-gray-200 rounded w-8"></div>
      </div>
      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      <div className="flex gap-2">
        <div className="h-6 bg-gray-200 rounded w-16"></div>
        <div className="h-6 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="h-10 bg-gray-200 rounded w-full"></div>
    </div>
  </Card>
);

export function ModulesPage({ profile }: ModulesPageProps) {
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleUsers, setModuleUsers] = useState<Map<string, UserModuleData[]>>(new Map());
  const [viewingUsersModule, setViewingUsersModule] = useState<Module | null>(null);
  const [animateCards, setAnimateCards] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = profile.role === 'admin';

  const loadModuleUsers = async (moduleId: string): Promise<UserModuleData[]> => {
    try {
      const { data: joinData, error: joinError } = await supabase
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

      if (joinError) {
        console.error('Error with join query:', joinError);
      }

      if (joinData && joinData.length > 0) {
        return joinData.map((item: any) => ({
          user_id: item.user_id,
          score: item.score || 0,
          completed_at: item.completed_at,
          full_name: item.profiles?.full_name || 'Unknown User',
          email: item.profiles?.email || 'No email'
        }));
      }

      const { data: userModulesData, error: umError } = await supabase
        .from('user_modules')
        .select('user_id, score, completed_at')
        .eq('module_id', moduleId)
        .eq('completed', true)
        .order('score', { ascending: false });

      if (umError || !userModulesData || userModulesData.length === 0) {
        return [];
      }

      const userIds = [...new Set(userModulesData.map((um: any) => um.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      return userModulesData.map((um: any) => {
        const profile = profilesData?.find((p: any) => p.id === um.user_id);
        return {
          user_id: um.user_id,
          score: um.score || 0,
          completed_at: um.completed_at,
          full_name: profile?.full_name || 'Unknown User',
          email: profile?.email || 'No email'
        };
      });
    } catch (error) {
      console.error('Error in loadModuleUsers:', error);
      return [];
    }
  };

  const loadModulesAndProgress = useCallback(async (forceRefresh = false) => {
    try {
      // Try to load from cache first
      if (!forceRefresh) {
        const cachedData = await cache.get();
        if (cachedData) {
          setModules(cachedData.modules);
          setModuleUsers(cachedData.moduleUsers);
          setLoading(false);
          setAnimateCards(true);
          // Still fetch fresh data in background
          loadModulesAndProgress(true);
          return;
        }
      }

      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('difficulty', { ascending: true });

      if (modulesError) {
        throw modulesError;
      }

      const modulesWithProgress = await Promise.all(
        (modulesData || []).map(async (module) => {
          const progressData = await getUserModuleProgress(profile.id, module.id);
          
          const { data: lessonsData } = await supabase
            .from('lessons')
            .select('id')
            .eq('module_id', module.id);

          const actualLessonCount = lessonsData?.length || module.lessons;
          
          return {
            ...module,
            lessons: actualLessonCount,
            progress: progressData?.progress || 0,
            completed: progressData?.completed || false,
            score: progressData?.final_score || null
          };
        })
      );

      setModules(modulesWithProgress);

      // Load users for each module if admin
      const usersMap = new Map();
      if (isAdmin) {
        for (const module of modulesWithProgress) {
          const users = await loadModuleUsers(module.id);
          usersMap.set(module.id, users);
        }
      }
      setModuleUsers(usersMap);

      // Cache the data
      await cache.set({
        modules: modulesWithProgress,
        moduleUsers: usersMap,
        timestamp: Date.now()
      });

      setAnimateCards(true);
    } catch (error) {
      console.error('Error in loadModulesAndProgress:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile.id, isAdmin]);

  useEffect(() => {
    loadModulesAndProgress();
  }, [loadModulesAndProgress]);

  const handleRefresh = () => {
    cache.clear();
    loadModulesAndProgress(true);
  };

  const handleStartModule = (module: Module) => {
    setActiveModule(module);
  };

  const handleModuleComplete = async () => {
    setActiveModule(null);
    cache.clear();
    await loadModulesAndProgress(true);
  };

  const handleModuleClose = () => {
    setActiveModule(null);
    setTimeout(() => {
      loadModulesAndProgress(true);
    }, 100);
  };

  const handleEditModule = (module: Module) => {
    setEditingModule(module);
    setShowModuleForm(true);
  };

  const handleModuleFormClose = () => {
    setShowModuleForm(false);
    setEditingModule(null);
  };

  const handleModuleFormSuccess = async () => {
    setShowModuleForm(false);
    setEditingModule(null);
    cache.clear();
    await loadModulesAndProgress(true);
  };

  const categories = ['All', ...new Set(modules.map(m => m.category))];
  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced'];

  const filteredModules = modules.filter(module => {
    const categoryMatch = selectedCategory === 'All' || module.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === 'All' || module.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

  const completedModules = modules.filter(m => m.completed);
  const completedCount = completedModules.length;
  const totalCount = modules.filter(m => !m.locked).length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && modules.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Skeleton */}
        <div className="mb-6 sm:mb-8">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
        </div>

        {/* Progress Skeleton */}
        {!isAdmin && (
          <Card className="p-4 sm:p-6 mb-6 sm:mb-8 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
          </Card>
        )}

        {/* Modules Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <ModuleSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <>
      {showModuleForm && (
        <ModuleFormModal
          module={editingModule}
          onClose={handleModuleFormClose}
          onSuccess={handleModuleFormSuccess}
        />
      )}

      {/* Users Performance Modal */}
      {viewingUsersModule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl bg-white p-4 sm:p-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border-0 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-4 sm:mb-6 gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold truncate bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {viewingUsersModule.title}
                </h2>
                <p className="text-xs sm:text-sm text-gray-700 mt-1 flex items-center gap-2 font-medium">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Users Performance Report
                </p>
              </div>
              <button 
                onClick={() => setViewingUsersModule(null)} 
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 hover:bg-gray-100 rounded-lg p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {(() => {
              const users = moduleUsers.get(viewingUsersModule.id) || [];
              
              if (users.length === 0) {
                return (
                  <div className="text-center py-12 sm:py-16">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trophy className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 font-semibold">No completions yet</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Be the first to complete this module!</p>
                  </div>
                );
              }

              return (
                <>
                  <div className="mb-4 sm:mb-6 p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100 shadow-sm">
                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                      <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-700 mb-1 font-bold">Completions</p>
                        <p className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                          {users.length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-700 mb-1 font-bold">Avg Score</p>
                        <p className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                          {Math.round(users.reduce((sum, u) => sum + u.score, 0) / users.length)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-700 mb-1 font-bold">Pass Rate</p>
                        <p className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                          {Math.round((users.filter(u => u.score >= 50).length / users.length) * 100)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="text-base sm:text-lg font-bold mb-3 flex items-center gap-2 text-gray-900">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      Leaderboard
                    </h3>
                    {users.map((userData, index) => (
                      <div 
                        key={userData.user_id} 
                        className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
                      >
                        <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 shadow-sm ${
                              index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                              index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                              index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {index < 3 ? '🏆' : `#${index + 1}`}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm sm:text-base truncate text-gray-900 group-hover:text-blue-600 transition-colors">
                                {userData.full_name}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600 truncate font-medium">{userData.email}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className={`text-xl sm:text-2xl font-bold ${
                              userData.score >= 80 ? 'text-green-600' :
                              userData.score >= 50 ? 'text-blue-600' :
                              'text-orange-600'
                            }`}>
                              {userData.score}%
                            </div>
                            <Badge className={`text-xs mt-1 font-semibold ${
                              userData.score >= 50 
                                ? 'bg-green-100 text-green-800 border-green-200' 
                                : 'bg-orange-100 text-orange-800 border-orange-200'
                            }`}>
                              {userData.score >= 50 ? '✓ Passed' : '✗ Failed'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mb-2 font-medium">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{formatDate(userData.completed_at)}</span>
                        </div>
                        <Progress value={userData.score} className="h-2" />
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Learning Modules
            </h1>
            <p className="text-sm sm:text-base text-gray-700 flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Interactive disaster preparedness training
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 hover:bg-indigo-50 hover:border-indigo-300 transition-all font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Progress Overview */}
        {!isAdmin && (
          <Card className="p-4 sm:p-6 mb-6 sm:mb-8 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold mb-1 text-gray-900">Your Progress</h2>
                <p className="text-xs sm:text-sm text-gray-700 font-semibold">
                  {completedCount} of {totalCount} modules completed
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {Math.round(progressPercent)}%
                  </div>
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-700 mt-1 font-semibold">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>{profile.points} points</span>
                  </div>
                </div>
              </div>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </Card>
        )}

        {/* Filters */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm"
          >
            <span className="text-sm font-bold text-gray-800">Filters</span>
            {showFilters ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
            {(selectedCategory !== 'All' || selectedDifficulty !== 'All') && (
              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs ml-2 font-semibold">
                Active
              </Badge>
            )}
          </button>

          {showFilters && (
            <div className="mt-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2 duration-200">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                  <span className="text-sm font-bold text-gray-800 min-w-fit">Category:</span>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                          selectedCategory === cat
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-105'
                            : 'bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                  <span className="text-sm font-bold text-gray-800 min-w-fit">Difficulty:</span>
                  <div className="flex flex-wrap gap-2">
                    {difficulties.map(diff => (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                          selectedDifficulty === diff
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-105'
                            : 'bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modules Grid */}
        {filteredModules.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center bg-gray-50 border-dashed">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 text-sm sm:text-base font-bold">No modules found</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 font-medium">Try adjusting your filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredModules.map((module, index) => {
              const isCompleted = module.completed;
              const isStarted = module.progress > 0;
              const moduleProgressPercent = module.progress;
              const users = moduleUsers.get(module.id) || [];
              
              return (
                <Card 
                  key={module.id} 
                  className={`p-4 sm:p-6 relative hover:shadow-xl transition-all duration-300 border-gray-200 hover:border-indigo-200 group ${
                    module.locked ? 'opacity-60' : ''
                  } ${
                    animateCards ? 'animate-in fade-in slide-in-from-bottom-4' : ''
                  }`}
                  style={{
                    animationDelay: animateCards ? `${index * 50}ms` : '0ms',
                    animationFillMode: 'backwards'
                  }}
                >
                  {module.locked && !isAdmin && (
                    <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  )}
                  
                  {!isAdmin && isCompleted && (
                    <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-green-400 to-green-500 rounded-lg flex items-center justify-center shadow-lg">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}

                  {!isAdmin && isStarted && !isCompleted && (
                    <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                      <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-md text-xs font-bold px-2 py-1">
                        {moduleProgressPercent}%
                      </Badge>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditModule(module);
                        }}
                        className="h-8 px-3 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all font-medium"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  )}

                  <div className="mb-4">
                    <Badge variant="outline" className="mb-3 text-xs font-semibold border-gray-300 text-gray-700">
                      {module.category}
                    </Badge>
                    <h3 className="text-base sm:text-lg mb-2 font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-700 line-clamp-2 font-medium">{module.description}</p>
                  </div>

                  {/* Admin View: Show users who completed the module */}
                  {isAdmin && (
                    <div className="mb-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingUsersModule(module)}
                        className="flex-1 flex items-center justify-center gap-2 hover:bg-amber-50 hover:border-amber-300 transition-all font-medium"
                      >
                        <Users className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-semibold">
                          {users.length} {users.length === 1 ? 'User' : 'Users'}
                        </span>
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{module.duration}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{module.lessons} lessons</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge 
                        className={`text-xs font-bold px-2.5 py-1 ${
                          module.difficulty === 'Beginner' 
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : module.difficulty === 'Intermediate'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-purple-100 text-purple-800 border-purple-200'
                        }`}
                      >
                        {module.difficulty}
                      </Badge>
                      <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <Trophy className="w-4 h-4 text-amber-600" />
                        <span className="text-xs sm:text-sm font-bold text-amber-800">{module.points} pts</span>
                      </div>
                    </div>

                    {!isAdmin && isStarted && !isCompleted && (
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs text-gray-700 mb-2 font-semibold">
                          <span>Progress</span>
                          <span className="text-blue-600">{moduleProgressPercent}%</span>
                        </div>
                        <Progress value={moduleProgressPercent} className="h-2" />
                      </div>
                    )}

                    {!isAdmin && isCompleted && module.score !== null && module.score !== undefined && (
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-gray-700 font-bold">Your Score:</span>
                          <div className="text-right">
                            <span className={`text-lg sm:text-xl font-bold ${
                              module.score >= 80 ? 'text-green-600' :
                              module.score >= 50 ? 'text-blue-600' :
                              'text-orange-600'
                            }`}>
                              {module.score}%
                            </span>
                            {module.score < 50 && (
                              <p className="text-xs text-orange-600 mt-0.5 font-semibold">
                                Below 50% - No points
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {isAdmin ? (
                    <Button 
                      className="w-full text-xs sm:text-sm bg-gray-100 text-gray-600 cursor-not-allowed font-semibold"
                      disabled
                    >
                      Admin View Only
                    </Button>
                  ) : (
                    <Button 
                      className={`w-full text-xs sm:text-sm font-bold transition-all duration-200 ${
                        isCompleted 
                          ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300' 
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
                      }`}
                      disabled={module.locked}
                      onClick={() => handleStartModule(module)}
                    >
                      {module.locked ? (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Locked
                        </>
                      ) : isCompleted ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Review Module
                        </>
                      ) : isStarted ? (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Continue Learning
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Module
                        </>
                      )}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Lesson Viewer Modal */}
      {activeModule && !isAdmin && (
        <LessonViewer
          moduleId={activeModule.id}
          moduleTitle={activeModule.title}
          modulePoints={activeModule.points}
          userId={profile.id}
          onComplete={handleModuleComplete}
          onClose={handleModuleClose}
        />
      )}
    </>
  );
}