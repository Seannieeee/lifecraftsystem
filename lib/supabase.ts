import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only log warnings in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  if (!supabaseUrl) {
    console.warn('⚠️ NEXT_PUBLIC_SUPABASE_URL is not defined');
  }
  if (!supabaseAnonKey) {
    console.warn('⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
  }
}

// Create Supabase client
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Database types
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'admin' | 'instructor';
  points: number;
  rank: string;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string | null;
  points: number;
  lessons: number;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserModule {
  id: string;
  user_id: string;
  module_id: string;
  completed: boolean;
  score: number | null;
  last_lesson_index: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content: string;
  order_number: number;
  duration: string;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  lesson_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  order_number: number;
  created_at: string;
  updated_at: string;
}

export interface UserLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  quiz_score: number | null;
  attempts: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Drill {
  id: string;
  title: string;
  description: string | null;
  type: 'Virtual' | 'Physical';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string | null;
  points: number;
  location: string | null;
  date: string | null;
  time: string | null;
  capacity: number | null;
  participants: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDrill {
  id: string;
  user_id: string;
  drill_id: string;
  status: 'registered' | 'completed' | 'cancelled';
  score: number | null;
  completion_time: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CommunitySession {
  id: string;
  title: string;
  description: string | null;
  organization: string | null;
  category: string | null;
  level: string | null;
  date: string;
  time: string;
  location: string;
  instructor: string | null;
  capacity: number;
  certified: boolean;
  volunteer: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCommunitySession {
  id: string;
  user_id: string;
  session_id: string;
  status: 'registered' | 'attended' | 'cancelled';
  created_at: string;
}

export interface FirstAidTutorial {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: 'Essential' | 'Important';
  duration: string | null;
  steps: number;
  type: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  item: string | null;
  points: number;
  created_at: string;
}