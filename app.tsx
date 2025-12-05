import { useState } from 'react';
import { Login } from '@/components/Login';
import { Register } from '@/components/Register';
import { Dashboard } from '@/components/Dashboard';
import { ModulesPage } from '@/components/ModulesPage';
import { DrillsPage } from '@/components/DrillsPage';
import { FirstAidPage } from '@/components/FirstAidPage';
import { CommunityTraining } from '@/components/CommunityTraining';
import { AdminPortal } from '@/components/AdminPortal';



type Page = 'login' | 'register' | 'dashboard' | 'modules' | 'drills' | 'firstaid' | 'community' | 'admin';

interface User {
  name: string;
  email: string;
  role: 'student' | 'admin' | 'instructor';
  points: number;
  rank: string;
  completedModules: string[];
  badges: string[];
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (email: string, password: string) => {
    // Mock login - in real app, this would authenticate with backend
    const mockUser: User = {
      name: email.split('@')[0],
      email: email,
      role: email.includes('admin') ? 'admin' : 'student',
      points: 1250,
      rank: 'Emergency Responder',
      completedModules: ['fire-safety', 'earthquake-prep', 'first-aid-basics'],
      badges: ['First Responder', 'Fire Safety Expert', 'Quick Learner']
    };
    setUser(mockUser);
    setCurrentPage('dashboard');
  };

  const handleRegister = (name: string, email: string, password: string) => {
    // Mock registration
    const newUser: User = {
      name: name,
      email: email,
      role: 'student',
      points: 0,
      rank: 'Beginner',
      completedModules: [],
      badges: []
    };
    setUser(newUser);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('login');
  };

  if (!user) {
    return (
      <>
        {currentPage === 'login' && (
          <Login 
            onLogin={handleLogin}
            onSwitchToRegister={() => setCurrentPage('register')}
          />
        )}
        {currentPage === 'register' && (
          <Register 
            onRegister={handleRegister}
            onSwitchToLogin={() => setCurrentPage('login')}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white">
                  🚨
                </div>
                <span className="text-xl">PrepareReady</span>
              </div>
              
              <div className="hidden md:flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage('dashboard')}
                  className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 'dashboard' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => setCurrentPage('modules')}
                  className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 'modules' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  Modules
                </button>
                <button 
                  onClick={() => setCurrentPage('drills')}
                  className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 'drills' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  Drills
                </button>
                <button 
                  onClick={() => setCurrentPage('firstaid')}
                  className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 'firstaid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  First Aid
                </button>
                <button 
                  onClick={() => setCurrentPage('community')}
                  className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 'community' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  Community
                </button>
                {user.role === 'admin' && (
                  <button 
                    onClick={() => setCurrentPage('admin')}
                    className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 'admin' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    Admin
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <span>⭐</span>
                <span>{user.points} pts</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div>{user.name}</div>
                  <div className="text-sm text-gray-600">{user.rank}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {currentPage === 'dashboard' && <Dashboard user={user} />}
        {currentPage === 'modules' && <ModulesPage user={user} />}
        {currentPage === 'drills' && <DrillsPage user={user} />}
        {currentPage === 'firstaid' && <FirstAidPage />}
        {currentPage === 'community' && <CommunityTraining />}
        {currentPage === 'admin' && <AdminPortal />}
      </main>
    </div>
  );
}
