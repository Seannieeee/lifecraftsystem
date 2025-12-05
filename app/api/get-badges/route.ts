import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    console.log(`🔍 [Badge API] Fetching badges for user: ${userId}`);

    // Try Redis first (fastest)
    const redisKey = `user_badges_${userId}`;
    const cachedBadges = await redis.get(redisKey);
    
    if (cachedBadges) {
      const badges = JSON.parse(cachedBadges);
      console.log(`✅ [Badge API] Redis cache hit: ${badges.length} badges`);
      return NextResponse.json({
        badges,
        source: 'redis',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔄 [Badge API] Cache miss, fetching from Supabase...`);
    
    // Fallback to Supabase (slower but reliable)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: badgeActivities, error } = await supabase
      .from('activity_log')
      .select('item')
      .eq('user_id', userId)
      .eq('action', 'Earned Badge')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [Badge API] Supabase error:', error);
      return NextResponse.json({ badges: [] }, { status: 200 });
    }

    // Get unique badges
    const badges = [...new Set(badgeActivities?.map(b => b.item) || [])];
    
    // Cache the result for next time (1 hour)
    if (badges.length > 0) {
      await redis.set(redisKey, JSON.stringify(badges), 'EX', 3600);
    }

    console.log(`✅ [Badge API] Found ${badges.length} badges from Supabase`);
    
    return NextResponse.json({
      badges,
      source: 'supabase',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [Badge API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch badges", badges: [] },
      { status: 500 }
    );
  }
}