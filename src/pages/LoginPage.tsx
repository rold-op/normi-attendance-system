import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { NormiLogo } from '../components/NormiLogo';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export function LoginPage() {
  const {
    isAuthenticated,
    isLoading,
    setupRequired,
    defaultSuperAdminEmail,
    setupSuperAdmin,
    login,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState('NORMI Super Admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const shakeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (setupRequired && !email && defaultSuperAdminEmail) {
      setEmail(defaultSuperAdminEmail);
    }
  }, [setupRequired, defaultSuperAdminEmail, email]);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) {
        window.clearTimeout(shakeTimerRef.current);
      }
    };
  }, []);

  const triggerShake = () => {
    setIsShaking(false);
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
    }
    window.requestAnimationFrame(() => {
      setIsShaking(true);
      shakeTimerRef.current = window.setTimeout(() => setIsShaking(false), 400);
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F4]">
        <p className="text-xs font-medium text-[#64748B]">Verifying session...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    const redirectTo =
      (location.state as { from?: string } | null)?.from ?? '/dashboard/monitoring';
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (setupRequired) {
      if (password.length < 8) {
        setError('Super Admin password must be at least 8 characters long.');
        triggerShake();
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        triggerShake();
        return;
      }
      setSubmitting(true);
      const result = await setupSuperAdmin(fullName, email, password);
      setSubmitting(false);
      if (!result.success) {
        setError(result.error ?? 'Failed to initialize Super Admin account.');
        triggerShake();
        return;
      }
      navigate('/dashboard/monitoring', { replace: true });
      return;
    }

    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? 'Invalid email address or password.');
      triggerShake();
      return;
    }

    const redirectTo =
      (location.state as { from?: string } | null)?.from ?? '/dashboard/monitoring';
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F4F6F4] px-4 py-10 antialiased selection:bg-[#1E5628] selection:text-white">
      <div
        className={cn(
          'w-full max-w-[420px] overflow-hidden normi-card border border-black/[0.06] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_12px_36px_-6px_rgba(30,86,40,0.06)]',
          isShaking && 'animate-login-shake'
        )}
      >
        {/* Forest Green top accent bar */}
        <div className="h-1.5 w-full bg-[#1E5628]" />

        <div className="p-7 sm:p-9">
          {/* Official NORMI Institutional Seal & Brand Lockup */}
          <div className="mb-7 flex flex-col items-center text-center">
            <NormiLogo size="login" className="mb-4 shadow-sm" />
            <h1 className="text-2xl sm:text-[26px] font-bold uppercase tracking-tight text-[#0F172A] leading-none">
              NORMI
            </h1>
            <p className="mt-1.5 text-xs font-semibold tracking-wider uppercase text-[#1E5628]">
              Attendance Management System
            </p>
            <p className="mt-1.5 text-xs text-[#64748B] tracking-tight">
              Northern Mindanao Colleges, Inc. &middot; Campus RFID Platform
            </p>
          </div>

          {setupRequired && (
            <div className="mb-5 rounded-xl border border-[#1E5628]/25 bg-[#EAF2EC]/70 px-3.5 py-3 flex items-start gap-2.5 text-xs text-[#1E5628]">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">First-Time Super Admin Setup</p>
                <p className="mt-0.5 text-[#16421E]/90 leading-relaxed">
                  Create the primary Super Admin account to unlock User Management and provision Dean &amp; Instructor accounts.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {setupRequired && (
              <div>
                <label
                  htmlFor="normi-setup-name"
                  className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Super Admin Full Name
                </label>
                <input
                  id="normi-setup-name"
                  type="text"
                  required
                  disabled={submitting}
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Dr. Elena R. Navarro"
                  className="h-11 w-full rounded-xl border border-[#1E5628]/35 bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:ring-2 focus:ring-[#1E5628]/15 focus:outline-none disabled:bg-[#F8FAFC] transition-colors"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="normi-login-email"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="normi-login-email"
                type="email"
                autoComplete="email"
                autoFocus={!setupRequired}
                required
                disabled={submitting}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="admin@normi.edu.ph"
                aria-invalid={Boolean(error)}
                className="h-11 w-full rounded-xl border border-[#1E5628]/35 bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:ring-2 focus:ring-[#1E5628]/15 focus:outline-none disabled:bg-[#F8FAFC] transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="normi-login-password"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                {setupRequired ? 'Create Password (min. 8 characters)' : 'Password'}
              </label>
              <div className="relative">
                <input
                  id="normi-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={setupRequired ? 'new-password' : 'current-password'}
                  required
                  disabled={submitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={setupRequired ? 'Enter a strong password' : 'Enter your password'}
                  aria-invalid={Boolean(error)}
                  className="h-11 w-full rounded-xl border border-[#1E5628]/35 bg-white pl-3.5 pr-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:ring-2 focus:ring-[#1E5628]/15 focus:outline-none disabled:bg-[#F8FAFC] transition-colors"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] hover:text-[#1E5628] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5628] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {setupRequired && (
              <div>
                <label
                  htmlFor="normi-setup-confirm"
                  className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="normi-setup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  disabled={submitting}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Re-enter your password"
                  className="h-11 w-full rounded-xl border border-[#1E5628]/35 bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:ring-2 focus:ring-[#1E5628]/15 focus:outline-none disabled:bg-[#F8FAFC] transition-colors"
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#DC2626]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting}
              className="w-full h-11 bg-[#1E5628] hover:bg-[#16421E] text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{setupRequired ? 'Initializing Account...' : 'Signing In...'}</span>
                </>
              ) : setupRequired ? (
                'Create Super Admin & Enter'
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {!setupRequired && (
            <p className="mt-5 pt-4 border-t border-[#1E5628]/18 text-center text-[11px] text-[#64748B]">
              Sign in with your assigned <strong className="text-[#0F172A]">Super Admin</strong>,{' '}
              <strong className="text-[#0F172A]">Dean</strong>, or{' '}
              <strong className="text-[#0F172A]">Instructor</strong> account.
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-[11px] text-[#64748B]">
        Northern Mindanao Colleges, Inc. &middot; Local LAN Attendance Infrastructure
      </p>
    </div>
  );
}
