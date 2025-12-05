'use client';

import { useState, useEffect } from 'react';
import { supabase, type Profile, type Module, type UserModule } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Zap, TrendingUp, BookOpen, Activity } from 'lucide-react';

interface DashboardHomeProps {
  profile: Profile;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  duration: string;
  points: number;
  lessons: number;
  reason: string;
}

export default function DashboardHome({ profile }: DashboardHomeProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [completedModules, setCompletedModules] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [profile.id]);

  const loadDashboardData = async () => {
    try {
      // Load completed modules count
      const { count: modulesCount } = await supabase
        .from('user_modules')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('completed', true);

      setCompletedModules(modulesCount || 0);

      // Load recent activity
      const { data: activityData } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(4);

      setRecentActivity(activityData || []);

      // Load AI recommendations
      await loadRecommendations();
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      // Get completed modules with details
      const { data: userModules } = await supabase
        .from('user_modules')
        .select(`
          *,
          modules:module_id (*)
        `)
        .eq('user_id', profile.id)
        .eq('completed', true);

      // Get available modules
      const { data: allModules } = await supabase
        .from('modules')
        .select('*')
        .eq('locked', false);

      if (!allModules) return;

      // Prepare data for AI service
      const completedModulesData = (userModules || []).map((um: any) => ({
        module_id: um.module_id,
        title: um.modules.title,
        category: um.modules.category,
        difficulty: um.modules.difficulty,
        score: um.score
      }));

      // Call AI recommendation API
      const response = await fetch('/api/ai-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile: {
            id: profile.id,
            points: profile.points,
            rank: profile.rank
          },
          completedModules: completedModulesData,
          availableModules: allModules
        })
      });

      const data = await response.json();
      
      if (data.recommendations && data.recommendations.length > 0) {
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const upcomingCertifications = [
    { name: 'Emergency Response Certification', progress: 75, remaining: '2 modules' },
    { name: 'First Aid Professional', progress: 45, remaining: '4 modules' },
    { name: 'Disaster Coordinator', progress: 20, remaining: '8 modules' }
  ];

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Welcome Section */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back, {profile.full_name || 'there'}!</h1>
        <p className="text-sm sm:text-base text-gray-600">Continue your preparedness journey</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Total Points</p>
              <p className="text-xl sm:text-2xl font-bold truncate">{profile.points}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Completed</p>
              <p className="text-xl sm:text-2xl font-bold truncate">{completedModules}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Current Rank</p>
              <p className="text-base sm:text-lg font-semibold truncate">{profile.rank}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          {/* AI-Powered Recommendations */}
          {recommendations.length > 0 && (
            <Card className="p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                <h2 className="text-lg sm:text-xl font-bold">AI-Powered Recommendations</h2>
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Smart Learning</Badge>
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold mb-1 truncate">{rec.title}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{rec.reason}</p>
                      </div>
                      <Badge variant="outline" className="text-xs w-fit">{rec.difficulty}</Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mt-3">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-600">
                        <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{rec.points} points</span>
                      </div>
                      <button className="w-full sm:w-auto px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs sm:text-sm hover:bg-purple-700 transition-colors">
                        Start Learning
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Certification Progress */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <h2 className="text-lg sm:text-xl font-bold">Certification Progress</h2>
            </div>
            
            <div className="space-y-4 sm:space-y-6">
              {upcomingCertifications.map((cert, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-4">
                      <h3 className="text-xs sm:text-sm font-semibold truncate">{cert.name}</h3>
                      <p className="text-xs text-gray-600">{cert.remaining} remaining</p>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold flex-shrink-0">{cert.progress}%</span>
                  </div>
                  <Progress value={cert.progress} className="h-2" />
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              <h2 className="text-lg sm:text-xl font-bold">Recent Activity</h2>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-100 last:border-0 gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center text-base sm:text-lg flex-shrink-0">
                        {activity.action.includes('Completed') && '✅'}
                        {activity.action.includes('Earned') && '🏆'}
                        {activity.action.includes('Drill') && '🎯'}
                        {activity.action.includes('Joined') && '📚'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate">
                          {activity.action}: {activity.item}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(activity.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs sm:text-sm text-amber-600 font-semibold flex-shrink-0">
                      +{activity.points} pts
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs sm:text-sm text-gray-600 text-center py-4">No recent activity</p>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 sm:space-y-8">
          {/* Rank Progress */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              <h2 className="text-lg sm:text-xl font-bold">Rank Progress</h2>
            </div>
            
            <div className="space-y-4">
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Current Rank</p>
                <p className="text-xl sm:text-2xl font-bold mb-2">{profile.rank}</p>
                <div className="flex items-center justify-center gap-1 text-green-600 text-xs sm:text-sm font-semibold">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Level {Math.floor(profile.points / 500) + 1}</span>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2 text-xs sm:text-sm">
                  <span className="font-medium">Next: Disaster Specialist</span>
                  <span className="font-semibold">{profile.points}/2000</span>
                </div>
                <Progress value={(profile.points / 2000) * 100} className="h-2" />
                <p className="text-xs text-gray-600 mt-2">{2000 - profile.points} points to next rank</p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold mb-2">Rank Hierarchy:</p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 bg-gray-300 rounded-full flex-shrink-0"></div>
                    <span className="truncate">Beginner (0-500)</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 bg-gray-300 rounded-full flex-shrink-0"></div>
                    <span className="truncate">Responder (500-1000)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${profile.points >= 1000 && profile.points < 2000 ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${profile.points >= 1000 && profile.points < 2000 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className="truncate">Emergency Responder (1000-2000) {profile.points >= 1000 && profile.points < 2000 && '⭐'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 bg-gray-300 rounded-full flex-shrink-0"></div>
                    <span className="truncate">Disaster Specialist (2000-5000)</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 bg-gray-300 rounded-full flex-shrink-0"></div>
                    <span className="truncate">Master Coordinator (5000+)</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}