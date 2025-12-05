'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Heart, CheckCircle, AlertCircle } from 'lucide-react';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash parameters from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('Auth callback type:', type);

        if (accessToken && refreshToken) {
          // Set the session with the tokens from the URL
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            throw sessionError;
          }

          if (data.session) {
            console.log('Session established for user:', data.session.user.email);
            
            // Check if profile exists, if not create it
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.session.user.id)
              .maybeSingle();

            if (profileError && profileError.code !== 'PGRST116') {
              console.error('Profile check error:', profileError);
            }

            // If no profile exists, create one
            if (!profile) {
              console.log('Creating profile for new user...');
              const { error: insertError } = await supabase
                .from('profiles')
                .insert([
                  {
                    id: data.session.user.id,
                    email: data.session.user.email,
                    full_name: data.session.user.user_metadata?.full_name || '',
                    rank: 'Beginner',
                    points: 0,
                    role: 'student'
                  }
                ]);

              if (insertError) {
                console.error('Error creating profile:', insertError);
                // Don't throw error, just log it - user can still proceed
              }
            }

            setStatus('success');
            
            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
              router.push('/');
            }, 2000);
          }
        } else {
          // Check if there's already an active session (direct navigation)
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            console.log('Existing session found, redirecting...');
            router.push('/');
          } else {
            throw new Error('No authentication data found. Please try signing in again.');
          }
        }
      } catch (err: any) {
        console.error('Callback error:', err);
        setError(err.message || 'An error occurred during authentication.');
        setStatus('error');
      }
    };

    handleCallback();
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-white fill-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Verifying your email...</h1>
          <p className="text-gray-600 mb-6">Please wait while we complete your registration</p>
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-gray-800">Email Verified!</h2>
            <p className="text-gray-600 mb-6">
              Your email has been successfully verified. Welcome to LifeCraft!
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-emerald-800">
                Redirecting you to your dashboard...
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-gray-800">Verification Failed</h2>
            <p className="text-gray-600 mb-6">
              {error || 'There was an error verifying your email. Please try again.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}