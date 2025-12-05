'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, Eye, EyeOff, Check, X, AlertCircle, Mail } from 'lucide-react';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  onShowTerms: () => void;
  hasReadTerms?: boolean;
}

export default function RegisterPage({ onSwitchToLogin, onShowTerms, hasReadTerms = false }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Password validation
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const passwordLongEnough = password.length >= 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const isPasswordValid = passwordLongEnough && hasUpperCase && hasLowerCase && hasNumber;

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must contain uppercase, lowercase, and a number');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue');
      return;
    }

    setLoading(true);

    try {
      // First, check if email already exists in the profiles table
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is what we want
        throw checkError;
      }

      if (existingProfile) {
        setError('This email is already registered. Please sign in instead.');
        setLoading(false);
        return;
      }

      // Proceed with signup
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        // Handle specific Supabase auth errors
        if (error.message.includes('User already registered')) {
          throw new Error('This email is already registered. Please sign in instead.');
        } else if (error.message.includes('already registered')) {
          throw new Error('This email is already registered. Please sign in instead.');
        } else if (error.message.includes('invalid email')) {
          throw new Error('Please enter a valid email address.');
        } else if (error.message.includes('Password should be')) {
          throw new Error('Password does not meet requirements.');
        } else {
          throw error;
        }
      }

      if (data.user) {
        // Check if the user needs to confirm their email
        if (data.user.identities && data.user.identities.length === 0) {
          // This means the email already exists but user tried to sign up again
          setError('This email is already registered. Please sign in instead.');
          setLoading(false);
          return;
        }
        
        setRegistrationSuccess(true);
      }

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
              <Mail className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-gray-800">Check Your Email!</h2>
            <p className="text-gray-600 mb-6">
              We've sent a verification link to <strong>{email}</strong>
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>Open your email inbox</li>
                <li>Click the verification link in the email from LifeCraft</li>
                <li>You'll be redirected back to the sign-in page</li>
                <li>Sign in with your credentials to access your dashboard</li>
              </ol>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Didn't receive the email? Check your spam folder or request a new verification email.
            </p>
            <Button
              onClick={onSwitchToLogin}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
            LifeCraft
          </h1>
          <p className="text-gray-600">Start Your Preparedness Journey</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Create Account</h2>
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <span>{error}</span>
                {error.includes('already registered') && (
                  <button
                    onClick={onSwitchToLogin}
                    className="block mt-2 text-emerald-600 hover:text-emerald-700 font-medium underline"
                  >
                    Go to Sign In
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-gray-700 font-medium">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                disabled={loading}
                className="mt-1.5 h-11"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-700 font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                disabled={loading}
                className="mt-1.5 h-11"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={loading}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  <div className={`flex items-center gap-2 ${passwordLongEnough ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {passwordLongEnough ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>At least 6 characters</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasUpperCase ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {hasUpperCase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>One uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasLowerCase ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {hasLowerCase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>One lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasNumber ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>One number</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                Confirm Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={loading}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <div className={`mt-2 flex items-center gap-2 text-xs ${passwordsMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                  {passwordsMatch ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 text-sm pt-2">
              <input 
                type="checkbox" 
                id="terms-checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  if (!hasReadTerms) {
                    e.preventDefault();
                    onShowTerms();
                  } else {
                    setAgreedToTerms(e.target.checked);
                  }
                }}
                onClick={(e) => {
                  if (!hasReadTerms) {
                    e.preventDefault();
                    onShowTerms();
                  }
                }}
                className="mt-1 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={loading} 
              />
              <label htmlFor="terms-checkbox" className="text-gray-600">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onShowTerms();
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-medium underline"
                >
                  Terms of Service
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onShowTerms();
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-medium underline"
                >
                  Privacy Policy
                </button>
              </label>
            </div>

            {!hasReadTerms && (
              <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Please read the Terms and Conditions before agreeing.</span>
              </div>
            )}

            {!agreedToTerms && hasReadTerms && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>You must agree to the Terms and Conditions to create an account.</span>
              </div>
            )}

            <Button 
              onClick={handleSubmit}
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !agreedToTerms}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </div>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <button
              onClick={onSwitchToLogin}
              className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              disabled={loading}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}