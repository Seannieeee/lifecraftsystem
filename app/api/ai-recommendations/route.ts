import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import redis from '@/lib/redis';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types remain the same...
interface ModuleData {
  title: string;
  category: string;
  difficulty: string;
}

interface UserModuleWithDetails {
  score: number | null;
  modules: ModuleData;
}

interface UserStats {
  userId: string;
  totalPoints: number;
  rank: string;
  completedModules: number;
  totalModules: number;
  completedModuleDetails: Array<{
    title: string;
    category: string;
    difficulty: string;
    score: number;
  }>;
  badges: string[];
  averageScore: number;
}

interface ModuleOption {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  points: number;
  lessons: number;
  duration: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const cacheKey = `ai_reco_${userId}`;

    // 1. CHECK REDIS CACHE FIRST
    console.log('🔍 [Redis] Checking cache for:', cacheKey);
    
    try {
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const cacheTime = Date.now() - startTime;
        console.log('✅ [Redis] CACHE HIT! Retrieved in', cacheTime, 'ms');
        
        return NextResponse.json({
          fromCache: true,
          recommendations: JSON.parse(cached),
          responseTime: cacheTime,
          source: 'Redis Cache'
        });
      } else {
        console.log('❌ [Redis] CACHE MISS - Generating fresh recommendations');
      }
    } catch (cacheError) {
      console.error('⚠️ [Redis] Cache read failed:', cacheError);
    }

    // 2. GENERATE FRESH RECOMMENDATIONS
    console.log('🤖 [Gemini] Generating AI recommendations...');
    
    const userStats = await fetchUserStats(userId);
    const availableModules = await fetchAvailableModules(userId);

    if (availableModules.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'All modules completed! Great job!'
      });
    }

    const recommendations = await generateRecommendations(userStats, availableModules);
    
    const generationTime = Date.now() - startTime;
    console.log('✅ [Gemini] Generated in', generationTime, 'ms');

    // 3. CACHE FOR 10 MINUTES
    try {
      await redis.set(cacheKey, JSON.stringify(recommendations), 'EX', 60 * 10);
      console.log('💾 [Redis] Cached recommendations for 10 minutes');
      
      // Also store metadata for debugging
      await redis.set(
        `${cacheKey}_meta`,
        JSON.stringify({
          cachedAt: new Date().toISOString(),
          generationTime,
          userId
        }),
        'EX',
        60 * 10
      );
    } catch (cacheError) {
      console.error('⚠️ [Redis] Cache write failed:', cacheError);
    }

    return NextResponse.json({ 
      fromCache: false,
      recommendations,
      responseTime: generationTime,
      source: 'Fresh Generation (Gemini AI)'
    });
  } catch (error) {
    console.error('❌ [Error] Failed to generate recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

// Rest of the functions remain the same...
async function fetchUserStats(userId: string): Promise<UserStats> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('points, rank, full_name')
    .eq('id', userId)
    .single();

  const { data: completedModules } = await supabase
    .from('user_modules')
    .select(`
      score,
      modules (
        title,
        category,
        difficulty
      )
    `)
    .eq('user_id', userId)
    .eq('completed', true)
    .returns<UserModuleWithDetails[]>();

  const { count: totalModules } = await supabase
    .from('modules')
    .select('*', { count: 'exact', head: true });

  const { data: badgeActivities } = await supabase
    .from('activity_log')
    .select('item')
    .eq('user_id', userId)
    .eq('action', 'Earned Badge');

  const badges = badgeActivities?.map(b => b.item) || [];

  const scores = completedModules?.map(m => m.score || 0).filter(s => s > 0) || [];
  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const completedModuleDetails = completedModules?.map(m => ({
    title: m.modules?.title || 'Unknown Module',
    category: m.modules?.category || 'General',
    difficulty: m.modules?.difficulty || 'Beginner',
    score: m.score || 0
  })) || [];

  return {
    userId,
    totalPoints: profile?.points || 0,
    rank: profile?.rank || 'Beginner',
    completedModules: completedModules?.length || 0,
    totalModules: totalModules || 0,
    completedModuleDetails,
    badges,
    averageScore
  };
}

async function fetchAvailableModules(userId: string): Promise<ModuleOption[]> {
  const { data: allModules } = await supabase
    .from('modules')
    .select('*')
    .eq('locked', false);

  const { data: completedModuleIds } = await supabase
    .from('user_modules')
    .select('module_id')
    .eq('user_id', userId)
    .eq('completed', true);

  const completedIds = new Set(completedModuleIds?.map(m => m.module_id) || []);
  const availableModules = allModules?.filter(m => !completedIds.has(m.id)) || [];

  return availableModules.map(m => ({
    id: m.id,
    title: m.title || 'Untitled Module',
    description: m.description || '',
    category: m.category || 'General',
    difficulty: m.difficulty || 'Beginner',
    points: m.points || 0,
    lessons: m.lessons || 0,
    duration: m.duration || 'N/A'
  }));
}

async function generateRecommendations(
  userStats: UserStats,
  availableModules: ModuleOption[]
): Promise<Array<{
  moduleId: string;
  title: string;
  reason: string;
  difficulty: string;
  points: number;
}>> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are an AI learning advisor for LifeCraft, a disaster preparedness training platform. Analyze the user's learning journey and recommend the top 3 most suitable modules.

USER PROFILE:
- Total Points: ${userStats.totalPoints}
- Current Rank: ${userStats.rank}
- Completed Modules: ${userStats.completedModules}/${userStats.totalModules}
- Average Score: ${userStats.averageScore}%
- Badges Earned: ${userStats.badges.join(', ') || 'None yet'}

COMPLETED MODULES:
${userStats.completedModuleDetails.map(m => 
  `- ${m.title} (${m.category}, ${m.difficulty}) - Score: ${m.score}%`
).join('\n') || 'None yet'}

AVAILABLE MODULES:
${availableModules.map((m, i) => 
  `${i + 1}. ${m.title}
   Category: ${m.category}
   Difficulty: ${m.difficulty}
   Points: ${m.points}
   Duration: ${m.duration}
   Description: ${m.description}`
).join('\n\n')}

RECOMMENDATION CRITERIA:
1. Consider the user's current skill level (rank and average score)
2. Build on completed modules for progressive learning
3. Balance difficulty - not too easy, not too hard
4. Prioritize categories the user hasn't explored yet for variety
5. Consider high scores as readiness for harder challenges
6. For beginners, start with foundational topics
7. For advanced users, recommend specialized or advanced topics

Respond with EXACTLY 3 recommendations in this JSON format (no markdown, no code blocks, just pure JSON):
[
  {
    "moduleId": "module_id_here",
    "title": "Module Title",
    "reason": "One clear, engaging sentence explaining why this module is recommended based on their progress and learning patterns",
    "difficulty": "Beginner/Intermediate/Advanced",
    "points": 100
  }
]

Make reasons personal, specific, and motivating. Focus on learning progression and skill building.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const recommendations = JSON.parse(cleanedText);
    
    if (Array.isArray(recommendations)) {
      return recommendations.slice(0, 3).map(rec => ({
        moduleId: rec.moduleId || '',
        title: rec.title || 'Recommended Module',
        reason: rec.reason || 'Great next step in your training',
        difficulty: rec.difficulty || 'Beginner',
        points: rec.points || 0
      }));
    }
    
    throw new Error('Invalid recommendation format');
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return generateFallbackRecommendations(userStats, availableModules);
  }
}

function generateFallbackRecommendations(
  userStats: UserStats,
  availableModules: ModuleOption[]
): Array<{
  moduleId: string;
  title: string;
  reason: string;
  difficulty: string;
  points: number;
}> {
  const sortedModules = [...availableModules].sort((a, b) => {
    const difficultyScore = (m: ModuleOption) => {
      if (userStats.averageScore >= 80) {
        return m.difficulty === 'Advanced' ? 3 : m.difficulty === 'Intermediate' ? 2 : 1;
      } else if (userStats.averageScore >= 60) {
        return m.difficulty === 'Intermediate' ? 3 : m.difficulty === 'Beginner' ? 2 : 1;
      } else {
        return m.difficulty === 'Beginner' ? 3 : m.difficulty === 'Intermediate' ? 2 : 1;
      }
    };

    return difficultyScore(b) - difficultyScore(a);
  });

  return sortedModules.slice(0, 3).map(m => ({
    moduleId: m.id,
    title: m.title,
    reason: `Great next step in your ${m.category.toLowerCase()} training journey`,
    difficulty: m.difficulty,
    points: m.points
  }));
}