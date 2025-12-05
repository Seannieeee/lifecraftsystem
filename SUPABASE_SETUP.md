# Supabase Database Setup

## 1. Create a new Supabase project
Go to https://app.supabase.com and create a new project

## 2. Run the following SQL in the Supabase SQL Editor

```sql
-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin', 'instructor')),
  points INTEGER DEFAULT 0,
  rank TEXT DEFAULT 'Beginner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modules table
CREATE TABLE public.modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty TEXT CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
  duration TEXT,
  points INTEGER DEFAULT 0,
  lessons INTEGER DEFAULT 0,
  locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User module progress
CREATE TABLE public.user_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  score INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- Drills table
CREATE TABLE public.drills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('Virtual', 'Physical')),
  difficulty TEXT CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
  duration TEXT,
  points INTEGER DEFAULT 0,
  location TEXT,
  date DATE,
  time TEXT,
  capacity INTEGER,
  participants TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User drill registrations
CREATE TABLE public.user_drills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  drill_id UUID REFERENCES public.drills(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'completed', 'cancelled')),
  score INTEGER,
  completion_time TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, drill_id)
);

-- Community training sessions
CREATE TABLE public.community_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  organization TEXT,
  category TEXT,
  level TEXT,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  instructor TEXT,
  capacity INTEGER NOT NULL,
  certified BOOLEAN DEFAULT false,
  volunteer BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User community session registrations
CREATE TABLE public.user_community_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.community_sessions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- First aid tutorials
CREATE TABLE public.first_aid_tutorials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty TEXT CHECK (difficulty IN ('Essential', 'Important')),
  duration TEXT,
  steps INTEGER DEFAULT 0,
  type TEXT DEFAULT 'Visual + Text',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity log
CREATE TABLE public.activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  item TEXT,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_community_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.first_aid_tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- RLS Policies for modules (public read)
CREATE POLICY "Anyone can view modules" ON public.modules
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage modules" ON public.modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- RLS Policies for user_modules
CREATE POLICY "Users can view their own module progress" ON public.user_modules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own module progress" ON public.user_modules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own module progress" ON public.user_modules
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for drills (public read)
CREATE POLICY "Anyone can view drills" ON public.drills
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage drills" ON public.drills
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- RLS Policies for user_drills
CREATE POLICY "Users can view their own drill registrations" ON public.user_drills
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can register for drills" ON public.user_drills
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drill registrations" ON public.user_drills
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all drill registrations" ON public.user_drills
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- RLS Policies for community_sessions (public read)
CREATE POLICY "Anyone can view community sessions" ON public.community_sessions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage community sessions" ON public.community_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- RLS Policies for user_community_sessions
CREATE POLICY "Users can view their own session registrations" ON public.user_community_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can register for sessions" ON public.user_community_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session registrations" ON public.user_community_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for first_aid_tutorials (public read)
CREATE POLICY "Anyone can view first aid tutorials" ON public.first_aid_tutorials
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage tutorials" ON public.first_aid_tutorials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'instructor')
    )
  );

-- RLS Policies for activity_log
CREATE POLICY "Users can view their own activity" ON public.activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity" ON public.activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drills
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.community_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.first_aid_tutorials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

## 3. Insert Sample Data

```sql
-- Insert sample modules
INSERT INTO public.modules (title, description, category, difficulty, duration, points, lessons, locked) VALUES
  ('Fire Safety & Prevention', 'Learn how to prevent fires and respond effectively in fire emergencies', 'Fire Safety', 'Beginner', '45 min', 150, 8, false),
  ('Earthquake Preparedness', 'Essential knowledge for before, during, and after an earthquake', 'Natural Disasters', 'Intermediate', '60 min', 200, 10, false),
  ('First Aid Basics', 'Core first aid techniques for common emergencies', 'Medical', 'Beginner', '90 min', 250, 12, false),
  ('Flood Emergency Response', 'Comprehensive guide to flood preparedness and response', 'Natural Disasters', 'Intermediate', '55 min', 180, 9, false),
  ('Hurricane Preparedness', 'Prepare for and survive hurricane conditions safely', 'Natural Disasters', 'Intermediate', '70 min', 220, 11, false),
  ('CPR & AED Training', 'Life-saving CPR techniques and automated external defibrillator use', 'Medical', 'Advanced', '120 min', 300, 15, false),
  ('Wildfire Safety & Evacuation', 'Protection strategies and evacuation planning for wildfires', 'Natural Disasters', 'Beginner', '50 min', 170, 8, false),
  ('Severe Weather Response', 'Handling tornadoes, thunderstorms, and extreme weather events', 'Natural Disasters', 'Intermediate', '65 min', 190, 10, false),
  ('Emergency Communications', 'Maintaining contact during disasters when normal systems fail', 'Communications', 'Beginner', '40 min', 140, 7, false),
  ('Mass Casualty Management', 'Advanced techniques for managing multiple casualties', 'Medical', 'Advanced', '100 min', 350, 14, true);

-- Insert sample drills
INSERT INTO public.drills (title, description, type, difficulty, duration, points, participants) VALUES
  ('Emergency Evacuation Simulation', 'Practice evacuating from various building types under time pressure', 'Virtual', 'Beginner', '15 min', 100, '1'),
  ('Fire Response Drill', 'Simulated fire emergency with decision-making scenarios', 'Virtual', 'Intermediate', '20 min', 150, '1-4'),
  ('Earthquake Drop, Cover, Hold', 'Interactive earthquake safety procedure training', 'Virtual', 'Beginner', '10 min', 80, '1'),
  ('Medical Triage Simulation', 'Assess and prioritize multiple casualties in emergency scenarios', 'Virtual', 'Advanced', '30 min', 200, '1'),
  ('CPR Practice Session', 'Hands-on CPR training with feedback tracking', 'Physical', 'Intermediate', '45 min', 250, 'Max 12', '2025-11-15', '14:00'),
  ('Fire Extinguisher Training', 'Live fire extinguisher operation and safety', 'Physical', 'Beginner', '30 min', 180, 'Max 15', '2025-11-18', '10:00'),
  ('Search and Rescue Exercise', 'Team-based search and rescue simulation', 'Physical', 'Advanced', '120 min', 350, 'Max 20', '2025-11-22', '09:00');

-- Insert sample first aid tutorials
INSERT INTO public.first_aid_tutorials (title, description, category, difficulty, duration, steps, type) VALUES
  ('CPR for Adults', 'Step-by-step guide for performing CPR on adults', 'Life-Saving', 'Essential', '10 min read', 7, 'Visual + Text'),
  ('Choking & Heimlich Maneuver', 'How to help someone who is choking', 'Life-Saving', 'Essential', '5 min read', 5, 'Visual + Text'),
  ('Severe Bleeding Control', 'Techniques to stop severe bleeding', 'Trauma', 'Essential', '8 min read', 6, 'Visual + Text'),
  ('Burn Treatment', 'First aid for different degrees of burns', 'Injury Care', 'Important', '7 min read', 8, 'Visual + Text'),
  ('Fracture Immobilization', 'How to immobilize suspected fractures', 'Trauma', 'Important', '12 min read', 10, 'Visual + Text'),
  ('Recognizing and Treating Shock', 'Identifying and responding to medical shock', 'Life-Saving', 'Essential', '6 min read', 5, 'Visual + Text'),
  ('Severe Allergic Reactions', 'Using an EpiPen and responding to anaphylaxis', 'Medical Emergency', 'Essential', '5 min read', 4, 'Visual + Text'),
  ('Heat Stroke & Heat Exhaustion', 'Recognizing and treating heat-related emergencies', 'Environmental', 'Important', '7 min read', 6, 'Visual + Text'),
  ('Hypothermia Treatment', 'Warming techniques for hypothermia victims', 'Environmental', 'Important', '8 min read', 7, 'Visual + Text'),
  ('Poisoning Response', 'What to do when someone has been poisoned', 'Medical Emergency', 'Essential', '6 min read', 5, 'Visual + Text'),
  ('Seizure First Aid', 'How to help someone having a seizure', 'Medical Emergency', 'Important', '5 min read', 6, 'Visual + Text'),
  ('Wound Care & Bandaging', 'Proper wound cleaning and bandaging techniques', 'Injury Care', 'Important', '10 min read', 8, 'Visual + Text');

-- Insert sample community sessions
INSERT INTO public.community_sessions (title, description, organization, category, level, date, time, location, instructor, capacity, certified, volunteer) VALUES
  ('Community CPR & AED Workshop', 'Learn life-saving CPR and AED techniques', 'Red Cross - Downtown Chapter', 'Medical', 'Beginner', '2025-11-15', '14:00-17:00', 'Community Center, 123 Main St', 'Dr. Sarah Johnson', 20, true, false),
  ('Emergency Preparedness for Families', 'Family-focused emergency planning', 'FEMA Community Program', 'General Preparedness', 'All Levels', '2025-11-18', '10:00-12:00', 'Public Library, 456 Oak Ave', 'Mike Thompson', 30, false, false),
  ('Search and Rescue Volunteer Training', 'Join our search and rescue team', 'City Emergency Services', 'Advanced Response', 'Intermediate', '2025-11-22', '09:00-16:00', 'Fire Station #7, 789 Elm St', 'Captain Roberts', 15, true, true),
  ('Wildfire Evacuation Planning', 'Prepare your evacuation plan', 'Forest Service Outreach', 'Natural Disaster', 'Beginner', '2025-11-25', '18:00-20:00', 'City Hall Auditorium', 'Ranger Patricia Lee', 50, false, false),
  ('Community Emergency Response Team (CERT)', 'Become a certified CERT member', 'Local Emergency Management', 'Volunteer Program', 'All Levels', '2025-12-01', '18:00-21:00', 'Training Center, 321 Pine Rd', 'Multiple Instructors', 25, true, true),
  ('First Aid for Pet Owners', 'Emergency care for your pets', 'Veterinary Association', 'Specialized', 'Beginner', '2025-12-05', '13:00-15:00', 'Animal Clinic, 654 Birch Ln', 'Dr. Emily Chen', 20, false, false);
```

## 4. Get your API credentials

1. Go to Project Settings > API
2. Copy your project URL and anon key
3. Add them to your `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 5. Test the connection

Run your Next.js app and try signing up/logging in.
