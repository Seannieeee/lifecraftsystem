'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';
import { Dashboard } from '@/components/Dashboard';
import { ModulesPage } from '@/components/ModulesPage';
import { DrillsPage } from '@/components/DrillsPage';
import { FirstAidPage } from '@/components/FirstAidPage';
import { CommunityTraining } from '@/components/CommunityTraining';
import { AdminPortal } from '@/components/AdminPortal';

type Page = 'dashboard' | 'modules' | 'drills' | 'firstaid' | 'community' | 'admin';

interface DashboardLayoutProps {
  user: User;
}

// Navigation configuration
const NAV_ITEMS = {
  student: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', showFor: ['student'] },
    { id: 'modules', label: 'Modules', icon: '📚', showFor: ['student', 'admin', 'instructor'] },
    { id: 'drills', label: 'Drills', icon: '🎯', showFor: ['student', 'admin', 'instructor'] },
    { id: 'firstaid', label: 'First Aid', icon: '🏥', showFor: ['student', 'admin', 'instructor'] },
    { id: 'community', label: 'Community', icon: '👥', showFor: ['student', 'admin', 'instructor'] },
  ],
  admin: [
    { id: 'admin', label: 'Admin', icon: '⚙️', showFor: ['admin', 'instructor'] },
  ]
};

export default function DashboardLayout({ user }: DashboardLayoutProps) {
  // State management
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Load profile on mount and subscribe to changes
  useEffect(() => {
    loadProfile();

    const subscription = supabase
      .channel('profile_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user.id]);

  // Redirect admin/instructor users from dashboard to admin page
  useEffect(() => {
    if (profile && (profile.role === 'admin' || profile.role === 'instructor')) {
      if (currentPage === 'dashboard') {
        setCurrentPage('admin');
      }
    }
  }, [profile, currentPage]);

  const loadProfile = async () => {
    try {
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        // Create new profile if it doesn't exist
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || '',
              rank: 'Beginner',
              points: 0,
              role: 'student'
            }
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  // Get navigation items based on user role
  const getNavItems = () => {
    if (!profile) return [];
    const allItems = [...NAV_ITEMS.student, ...NAV_ITEMS.admin];
    return allItems.filter(item => item.showFor.includes(profile.role));
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-emerald-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-lg text-gray-700 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Unable to Load Profile</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              loadProfile();
            }}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isAdmin = profile.role === 'admin' || profile.role === 'instructor';
  const isStudent = profile.role === 'student';
  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in slide-in-from-bottom-4 duration-300">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full mb-6">
                <span className="text-4xl">👋</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Sign Out?
              </h2>
              <p className="text-gray-600 mb-8">
                Are you sure you want to sign out of your account?
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all disabled:opacity-50 hover:shadow-md"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                {loggingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Signing out...
                  </span>
                ) : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side - Logo and Navigation */}
            <div className="flex items-center gap-8">
              {/* Logo */}
              <div className="flex items-center gap-3 group cursor-pointer">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all group-hover:scale-105">
                  <Heart className="w-5 h-5 fill-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  LifeCraft
                </span>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-2">
                {navItems.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => handlePageChange(item.id as Page)}
                    className={`px-4 py-2 rounded-xl font-medium transition-all ${
                      currentPage === item.id 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="hidden xl:inline mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right side - User Info and Actions */}
            <div className="hidden md:flex items-center gap-4">
              {/* Points Badge (Students only) */}
              {isStudent && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl shadow-sm">
                  <span className="text-lg">⭐</span>
                  <div className="text-right">
                    <div className="text-xs text-amber-700 font-medium">Points</div>
                    <div className="text-sm font-bold text-amber-900">{profile.points}</div>
                  </div>
                </div>
              )}

              {/* User Profile */}
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl">
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">
                    {profile.full_name || user.email}
                  </div>
                  <div className="text-xs text-gray-600 font-medium">
                    {isAdmin ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : profile.rank}
                  </div>
                </div>
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:text-emerald-600 rounded-lg transition-all hover:shadow-sm"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Mobile menu button and points */}
            <div className="flex md:hidden items-center gap-3">
              {isStudent && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
                  <span>⭐</span>
                  <span className="text-sm font-bold text-amber-900">{profile.points}</span>
                </div>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-all"
                aria-label="Toggle menu"
              >
                <svg 
                  className="w-6 h-6 transition-transform duration-300" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  style={{ transform: mobileMenuOpen ? 'rotate(90deg)' : 'rotate(0)' }}
                >
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden border-t bg-white/95 backdrop-blur-lg overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="px-4 py-4 space-y-2">
            {/* User info */}
            <div className="pb-4 mb-4 border-b">
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                  {(profile.full_name || user.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900 truncate">
                    {profile.full_name || user.email}
                  </div>
                  <div className="text-xs text-gray-600 font-medium">
                    {isAdmin ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : profile.rank}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Navigation links */}
            {navItems.map((item) => (
              <button 
                key={item.id}
                onClick={() => handlePageChange(item.id as Page)}
                className={`w-full text-left px-5 py-3.5 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                  currentPage === item.id 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg font-semibold' 
                    : 'hover:bg-gray-50 text-gray-700 hover:translate-x-1'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
            
            {/* Logout button */}
            <div className="pt-4 mt-4 border-t">
              <button
                onClick={() => { 
                  setShowLogoutConfirm(true); 
                  setMobileMenuOpen(false); 
                }}
                className="w-full text-left px-5 py-3.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all duration-200 flex items-center gap-3 font-medium hover:translate-x-1"
              >
                <span className="text-xl">🚪</span>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pb-8">
        {currentPage === 'dashboard' && isStudent && <Dashboard profile={profile} />}
        {currentPage === 'modules' && <ModulesPage profile={profile} />}
        {currentPage === 'drills' && <DrillsPage profile={profile} />}
        {currentPage === 'firstaid' && <FirstAidPage profile={profile} />}
        {currentPage === 'community' && <CommunityTraining profile={profile} />}
        {currentPage === 'admin' && isAdmin && <AdminPortal profile={profile} />}
      </main>
    </div>
  );
}