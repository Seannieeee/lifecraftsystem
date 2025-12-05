'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import LoginPage from '@/components/auth/LoginPage';
import RegisterPage from '@/components/auth/RegisterPage';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Heart, Shield, Award, BookOpen, Target, ArrowRight, X } from 'lucide-react';

type AuthPage = 'landing' | 'login' | 'register';

// Terms and Conditions Modal Component
function TermsModal({ isOpen, onClose, onTermsRead }: { isOpen: boolean; onClose: () => void; onTermsRead: () => void }) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
    if (scrolledToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleClose = () => {
    if (hasScrolledToBottom) {
      onTermsRead();
    }
    onClose();
  };

  // Reset scroll state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasScrolledToBottom(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Terms and Conditions</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div 
          className="overflow-y-auto p-6 space-y-4 text-sm text-gray-700"
          onScroll={handleScroll}
        >
          <p className="text-xs text-gray-500 italic">
            Note: This Terms and Conditions document is adapted from standard open-source templates and customized for LifeCraft's emergency preparedness training platform.
          </p>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h3>
            <p>
              By accessing and using LifeCraft ("the Platform"), you accept and agree to be bound by these Terms and Conditions. 
              If you do not agree to these terms, please do not use the Platform.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Platform Purpose</h3>
            <p>
              LifeCraft is an educational platform designed to provide emergency preparedness training, first aid education, 
              and disaster response skills. The content is for educational purposes only and should not replace professional 
              emergency services, medical advice, or official emergency response training.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">3. User Responsibilities</h3>
            <p className="mb-2">As a user, you agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Use the Platform only for lawful educational purposes</li>
              <li>Not share, sell, or distribute course content without permission</li>
              <li>Report any security vulnerabilities or unauthorized access</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">4. Educational Content Disclaimer</h3>
            <p>
              While we strive to provide accurate and up-to-date emergency preparedness information, the Platform's content 
              is for educational purposes only. Users should:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Always call emergency services (911 or local equivalent) in actual emergencies</li>
              <li>Seek professional medical training for official certification</li>
              <li>Verify local emergency procedures and regulations</li>
              <li>Not rely solely on Platform content for emergency response</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">5. Limitation of Liability</h3>
            <p>
              LifeCraft, its creators, and contributors are not liable for any injuries, damages, or losses resulting 
              from the use or misuse of information provided on the Platform. Emergency preparedness training should be 
              supplemented with professional instruction and practice.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">6. Intellectual Property</h3>
            <p>
              All content on LifeCraft, including text, graphics, videos, logos, and course materials, is protected 
              by intellectual property laws. Users may not reproduce, distribute, or create derivative works without 
              explicit permission.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">7. User Data and Privacy</h3>
            <p>
              We collect and process user data as described in our Privacy Policy. By using LifeCraft, you consent to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Collection of account information and learning progress</li>
              <li>Use of cookies and analytics for Platform improvement</li>
              <li>Storage of completion records and certifications</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">8. Account Termination</h3>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent 
              activity, or misuse the Platform. Users may delete their accounts at any time through account settings.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">9. Modifications to Terms</h3>
            <p>
              LifeCraft reserves the right to modify these Terms and Conditions at any time. Users will be notified 
              of significant changes via email or Platform notification. Continued use after modifications constitutes 
              acceptance of updated terms.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">10. Certification and Credentials</h3>
            <p>
              Certificates issued by LifeCraft indicate completion of educational modules but may not substitute 
              for official certifications required by employers or regulatory bodies. Users should verify acceptance 
              of LifeCraft certificates with relevant authorities.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">11. Contact Information</h3>
            <p>
              For questions about these Terms and Conditions, please contact us at lifecraftauthentication@gmail.com
            </p>
          </section>

          <section className="pt-4 border-t">
            <p className="text-xs text-gray-500">
              Last Updated: December 4, 2025
            </p>
            <p className="text-xs text-gray-500 mt-2">
              <strong>Attribution:</strong> This Terms and Conditions document is based on standard open-source legal templates 
              commonly used for educational platforms and has been customized for LifeCraft's specific services and requirements.
            </p>
          </section>
        </div>

        <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
          {!hasScrolledToBottom && (
            <div className="mb-4 text-center text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Please scroll to the bottom to continue
            </div>
          )}
          <button
            onClick={handleClose}
            disabled={!hasScrolledToBottom}
            className={`w-full px-6 py-3 font-medium rounded-xl transition-all ${
              hasScrolledToBottom
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {hasScrolledToBottom ? 'I Have Read the Terms' : 'Scroll to Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<AuthPage>('landing');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is logged in, show dashboard
  if (user) {
    return <DashboardLayout user={user} />;
  }

  // Show landing page by default
  if (currentPage === 'landing') {
    return (
      <>
        <TermsModal 
          isOpen={showTermsModal} 
          onClose={() => setShowTermsModal(false)} 
          onTermsRead={() => setHasReadTerms(true)}
        />
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl"></div>
        </div>

        {/* Navigation */}
        <nav className="relative bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Heart className="w-5 h-5 fill-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  LifeCraft
                </span>
              </div>

              {/* Auth Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage('login')}
                  className="px-5 py-2 text-gray-700 hover:text-emerald-600 font-medium transition-all hover:bg-gray-50 rounded-lg"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setCurrentPage('register')}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-xl"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-tight">
                Master Life-Saving
                <span className="block bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Skills Today
                </span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
                Interactive emergency response training that prepares you for real-world situations. 
                Learn, practice, and become certified in first aid and emergency procedures.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setCurrentPage('register')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-lg font-semibold rounded-xl transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 group"
              >
                Start Training Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 text-lg font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Save Lives
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comprehensive training platform with interactive modules, practice drills, and real-world scenarios
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: BookOpen,
                title: 'Interactive Modules',
                description: 'Engaging video lessons and step-by-step guides covering essential emergency skills',
                color: 'from-blue-500 to-blue-600'
              },
              {
                icon: Target,
                title: 'Practice Drills',
                description: 'Realistic scenario-based drills to test your knowledge and build confidence',
                color: 'from-purple-500 to-purple-600'
              },
              {
                icon: Shield,
                title: 'First Aid Training',
                description: 'Complete first aid certification courses from basic to advanced techniques',
                color: 'from-red-500 to-red-600'
              },
              {
                icon: Award,
                title: 'Earn Certificates',
                description: 'Get recognized certifications upon completing courses and assessments',
                color: 'from-amber-500 to-amber-600'
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl shadow-2xl p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Ready to Make a Difference?</h2>
            <p className="text-xl mb-8 text-emerald-50 max-w-2xl mx-auto">
              Join thousands of students learning life-saving skills. Start your journey today.
            </p>
            <button
              onClick={() => setCurrentPage('register')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-600 hover:bg-gray-50 text-lg font-semibold rounded-xl transition-all shadow-xl hover:shadow-2xl group"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative bg-white/80 backdrop-blur-lg border-t border-gray-200 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white fill-white" />
                </div>
                <span className="font-bold text-gray-900">LifeCraft</span>
              </div>
              <p className="text-gray-600 text-sm">
                © 2025 LifeCraft. Empowering people to save lives.
              </p>
            </div>
          </div>
        </footer>
      </div>
      </>
    );
  }

  // Show login page
  if (currentPage === 'login') {
    return (
      <>
        <TermsModal 
          isOpen={showTermsModal} 
          onClose={() => setShowTermsModal(false)} 
          onTermsRead={() => setHasReadTerms(true)}
        />
        <LoginPage onSwitchToRegister={() => setCurrentPage('register')} />
      </>
    );
  }

  // Show register page
  return (
    <>
      <TermsModal 
        isOpen={showTermsModal} 
        onClose={() => setShowTermsModal(false)} 
        onTermsRead={() => setHasReadTerms(true)}
      />
      <RegisterPage 
        onSwitchToLogin={() => setCurrentPage('login')} 
        onShowTerms={() => setShowTermsModal(true)}
        hasReadTerms={hasReadTerms}
      />
    </>
  );
}