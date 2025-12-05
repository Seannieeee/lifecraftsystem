import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local FIRST
dotenv.config({ path: resolve(__dirname, '../.env.local') });

import redis from "./redisClient.js";
import { createClient } from '@supabase/supabase-js';

interface BadgeRule {
  name: string;
  description: string;
  icon: string;
  check: (stats: any) => boolean;
}

const BADGE_RULES: BadgeRule[] = [
  {
    name: "First Steps",
    description: "Complete your first module",
    icon: "🎯",
    check: (stats) => stats.completedModules >= 1
  },
  {
    name: "Quick Learner",
    description: "Complete 3 modules",
    icon: "⚡",
    check: (stats) => stats.completedModules >= 3
  },
  {
    name: "Perfect Score",
    description: "Get 100% on any module",
    icon: "💯",
    check: (stats) => stats.hasPerfectScore
  },
  {
    name: "Knowledge Seeker",
    description: "Complete 5 modules",
    icon: "📚",
    check: (stats) => stats.completedModules >= 5
  },
  {
    name: "High Achiever",
    description: "Maintain 80%+ average across all modules",
    icon: "🌟",
    check: (stats) => stats.averageScore >= 80
  },
  {
    name: "Category Master",
    description: "Complete all modules in one category",
    icon: "👑",
    check: (stats) => stats.hasCompletedCategory
  }
];

export default async function processRecommendation(userId: string, moduleId?: string) {
  // Create Supabase client INSIDE the function after env is loaded
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`[Worker] Processing badges for user: ${userId}`);
  if (moduleId) {
    console.log(`[Worker] Triggered by module completion: ${moduleId}`);
  }

  // Get user's current badges from activity_log
  const { data: existingBadges, error: badgeError } = await supabase
    .from('activity_log')
    .select('item')
    .eq('user_id', userId)
    .eq('action', 'Earned Badge');

  if (badgeError) {
    console.error('[Worker] Error fetching existing badges:', badgeError);
  }

  const currentBadges = new Set(existingBadges?.map(b => b.item) || []);
  const stats = await getUserStats(userId, supabase);
  const newBadges: Array<{ name: string; description: string; icon: string }> = [];

  // Check each rule for new badges
  for (const rule of BADGE_RULES) {
    if (!currentBadges.has(rule.name) && rule.check(stats)) {
      // Log badge in activity_log
      const { error: logError } = await supabase.from('activity_log').insert({
        user_id: userId,
        action: 'Earned Badge',
        item: rule.name,
        points: 50
      });

      if (logError) {
        console.error(`[Worker] Failed to award badge ${rule.name}:`, logError);
        continue;
      }

      // Update user points
      const { data: profile } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', userId)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({ 
            points: (profile.points || 0) + 50,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      }

      newBadges.push({
        name: rule.name,
        description: rule.description,
        icon: rule.icon
      });

      console.log(`[Worker] ✅ Awarded badge: ${rule.name}`);
    }
  }

  // Combine old and new badges
  const allUserBadges = [...currentBadges, ...newBadges.map(b => b.name)];
  
  if (newBadges.length > 0) {
    // Store new badges temporarily for notifications (5 minutes)
    await redis.set(
      `new_badges_${userId}`,
      JSON.stringify(newBadges),
      "EX", 300
    );
    console.log(`[Worker] 💾 Cached ${newBadges.length} new badge(s) in Redis (temp)`);
    
    // Store ALL badges permanently for dashboard (7 days)
    await redis.set(
      `user_badges_${userId}`,
      JSON.stringify(allUserBadges),
      "EX", 86400 * 7
    );
    console.log(`[Worker] 💾 Saved ${allUserBadges.length} badges to permanent cache`);
  } else {
    console.log(`[Worker] ℹ️ No new badges earned`);
    
    // Still update the permanent cache with existing badges
    await redis.set(
      `user_badges_${userId}`,
      JSON.stringify([...currentBadges]),
      "EX", 86400 * 7
    );
  }

  await redis.del(`badge_processing_${userId}`);
  console.log(`[Worker] ✅ Completed processing for user: ${userId}`);
}

async function getUserStats(userId: string, supabase: any) {
  const { data: completedModules, error: modulesError } = await supabase
    .from('user_modules')
    .select('score, module_id, modules(category)')
    .eq('user_id', userId)
    .eq('completed', true);

  if (modulesError) {
    console.error('[Worker] Error fetching completed modules:', modulesError);
  }

  const scores = completedModules?.map((m: any) => m.score || 0).filter((s: number) => s > 0) || [];
  const averageScore = scores.length > 0
    ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    : 0;

  const hasPerfectScore = scores.some((s: number) => s === 100);

  const categoryCounts = completedModules?.reduce((acc: any, m: any) => {
    const cat = (m.modules as any)?.category || 'Unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const { data: allModules, error: allModulesError } = await supabase
    .from('modules')
    .select('category');

  if (allModulesError) {
    console.error('[Worker] Error fetching all modules:', allModulesError);
  }

  const categoryTotals = allModules?.reduce((acc: any, m: any) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasCompletedCategory = Object.keys(categoryCounts || {}).some(
    cat => categoryCounts![cat] === categoryTotals![cat]
  );

  return {
    completedModules: completedModules?.length || 0,
    averageScore,
    hasPerfectScore,
    hasCompletedCategory
  };
}