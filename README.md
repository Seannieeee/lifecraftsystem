# PrepareReady - Disaster Preparedness Training Platform

A comprehensive disaster preparedness training platform built with **Next.js 15**, **TypeScript**, **Supabase**, and **AI-powered recommendations**.

## 🚀 Features

- 📚 **Interactive Learning Modules** - Step-by-step disaster preparedness courses
- 🎯 **Emergency Response Drills** - Virtual and physical training simulations
- 🏥 **First Aid Tutorials** - Life-saving techniques and guides
- 👥 **Community Training** - Local sessions and volunteer programs
- 🤖 **AI-Powered Recommendations** - Personalized learning paths
- 🎮 **Gamification** - Points, ranks, and progress tracking
- 👨‍💼 **Admin Portal** - Manage drills and community sessions
- 🔐 **Authentication** - Secure user accounts with Supabase Auth

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0
- **Database**: Supabase (PostgreSQL)
- **AI Service**: Node.js/Express
- **Authentication**: Supabase Auth
- **Linting**: ESLint

## 📋 Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier is fine)
- Git

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd disaster-preparedness-platform
```

### 2. Install Dependencies

```bash
# Install Next.js dependencies
npm install

# Install AI service dependencies
cd ai-service
npm install
cd ..
```

### 3. Set Up Supabase Database

1. Create a new project at [https://app.supabase.com](https://app.supabase.com)

2. Go to the SQL Editor and run the entire SQL script from `SUPABASE_SETUP.md`
   - This creates all tables, policies, and sample data

3. Get your API credentials:
   - Go to Project Settings → API
   - Copy your Project URL and anon/public key

### 4. Configure Environment Variables

#### Next.js App (.env.local)

Create `.env.local` in the root directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
# ⚠️ REQUIRED: Supabase Configuration
# Get these from: https://app.supabase.com/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ⚠️ REQUIRED: AI Service URL
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:3001

# Optional: For production
AI_SERVICE_API_KEY=your_secret_api_key_here
```

#### AI Service (.env)

Create `.env` in the `ai-service` directory:

```bash
cd ai-service
cp .env.example .env
```

Edit `ai-service/.env`:

```env
PORT=3001
API_KEY=your_secret_api_key_here
NODE_ENV=development
```

### 5. Run the Application

You need to run TWO services:

#### Terminal 1: Next.js App

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

#### Terminal 2: AI Recommendation Service

```bash
cd ai-service
npm run dev
```

The AI service will be available at [http://localhost:3001](http://localhost:3001)

### 6. Create Your First Account

1. Go to [http://localhost:3000](http://localhost:3000)
2. Click "Sign up"
3. Create an account
4. Start learning!

## 🔑 Where to Add API Keys

### Supabase API Keys

**File**: `.env.local` (root directory)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
```

Get these from: Supabase Dashboard → Project Settings → API

### AI Service Configuration

**File**: `ai-service/.env`

```env
PORT=3001
API_KEY=create_your_own_secret_key_here
```

The AI service is called from: `app/api/ai-recommendations/route.ts`

## 📁 Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   └── ai-recommendations/   # AI recommendations endpoint
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page (auth gate)
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── auth/                     # Login/Register
│   ├── layout/                   # Dashboard layout
│   ├── dashboard/                # User dashboard pages
│   ├── admin/                    # Admin portal
│   └── ui/                       # Reusable UI components (shadcn)
├── lib/                          # Utilities
│   └── supabase.ts              # Supabase client & types
├── ai-service/                   # AI Recommendation Service
│   ├── server.js                 # Express server
│   ├── package.json
│   └── README.md
├── .env.local.example            # Environment template
├── SUPABASE_SETUP.md            # Database setup guide
└── README.md                     # This file
```

## 🎨 Admin Features

Admins can:
- ✅ Create, edit, and delete drills (both virtual and physical)
- ✅ Create, edit, and delete community training sessions
- ✅ View all participants and their progress
- ✅ Generate reports on drill participation
- ✅ Manage registrations for events

**Note**: AI recommendations and badges are removed from admin view as requested.

## 🤖 AI Recommendation System

The AI service analyzes:
- User's completed modules
- Performance scores
- Learning difficulty progression
- Category preferences
- Learning pace

**Algorithm considers**:
1. Difficulty matching (recommends next level up)
2. Category relevance (related topics)
3. Performance-based suggestions
4. Module comprehensiveness (points value)
5. Diversity in learning

## 🗄️ Database Schema

### Main Tables

- **profiles** - User information and progress
- **modules** - Learning modules
- **user_modules** - User progress on modules
- **drills** - Training drills (virtual & physical)
- **user_drills** - User drill registrations
- **community_sessions** - Community training events
- **user_community_sessions** - Event registrations
- **first_aid_tutorials** - First aid guides
- **activity_log** - User activity tracking

See `SUPABASE_SETUP.md` for complete schema.

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Admins have elevated permissions
- API routes validate user authentication
- Environment variables for sensitive data

## 📊 User Roles

- **Student**: Access to all learning features
- **Instructor**: Admin privileges + teaching capabilities
- **Admin**: Full system management

To make a user an admin, update their role in Supabase:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com';
```

## 🚀 Deployment

### Deploy Next.js App

#### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

#### Other Platforms

Works with any Next.js-compatible host (Netlify, Railway, etc.)

### Deploy AI Service

#### Option 1: Railway

1. Create new project in Railway
2. Add Node.js service
3. Set environment variables
4. Deploy

#### Option 2: Heroku

```bash
cd ai-service
heroku create your-app-name
git push heroku main
```

#### Option 3: VPS (Digital Ocean, AWS, etc.)

```bash
cd ai-service
npm install
npm install -g pm2
pm2 start server.js --name ai-service
```

### Production Environment Variables

Update `NEXT_PUBLIC_AI_SERVICE_URL` in your Next.js app to point to your deployed AI service URL.

## 🧪 Testing

### Test Supabase Connection

```typescript
// In browser console
const { data, error } = await supabase.from('modules').select('*');
console.log(data);
```

### Test AI Service

```bash
curl -X POST http://localhost:3001/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"userProfile":{"points":100},"completedModules":[],"availableModules":[...]}'
```

## 📝 Common Issues

### Issue: "Missing Supabase environment variables"

**Solution**: Make sure `.env.local` exists with valid Supabase credentials

### Issue: AI recommendations not loading

**Solution**: Ensure AI service is running on port 3001

```bash
cd ai-service
npm run dev
```

### Issue: Database tables don't exist

**Solution**: Run the SQL script from `SUPABASE_SETUP.md` in Supabase SQL Editor

### Issue: ESLint errors

**Solution**: Run the linter:

```bash
npm run lint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 📧 Support

For issues and questions:
- Check the `SUPABASE_SETUP.md` for database setup
- Check the `ai-service/README.md` for AI service details
- Review the `.env.local.example` for required environment variables

## 🎯 Next Steps

After setup, you can:
1. Customize the modules and drills in Supabase
2. Add your own first aid tutorials
3. Configure community training sessions
4. Adjust the AI recommendation algorithm
5. Customize the UI theme in `app/globals.css`

Happy coding! 🚀
