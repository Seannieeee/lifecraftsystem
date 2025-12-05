'use client';

import { useState } from 'react';
import { Heart, Shield, Award, BookOpen, Target, ArrowRight } from 'lucide-react';

export default function LifeCraftIndex() {
  const [showApp, setShowApp] = useState(false);
  const [startPage, setStartPage] = useState<'login' | 'register'>('login');

  // If user wants to access the app, we'll need to import and show App component
  // For now, we'll use window.location to navigate
  const handleNavigateToApp = (page: 'login' | 'register') => {
    // In a real Next.js app, you'd use router.push() here
    // For this demo, we'll set state to control what shows
    setStartPage(page);
    setShowApp(true);
  };

  return (
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
                PrepareReady
              </span>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleNavigateToApp('login')}
                className="px-5 py-2 text-gray-700 hover:text-emerald-600 font-medium transition-all hover:bg-gray-50 rounded-lg"
              >
                Sign In
              </button>
              <button
                onClick={() => handleNavigateToApp('register')}
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
              onClick={() => handleNavigateToApp('register')}
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
            onClick={() => handleNavigateToApp('register')}
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
              <span className="font-bold text-gray-900">PrepareReady</span>
            </div>
            <p className="text-gray-600 text-sm">
              © 2025 PrepareReady. Empowering people to save lives.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}