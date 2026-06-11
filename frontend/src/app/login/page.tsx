'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { access_token, refresh_token } = res.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: 'DM Sans', sans-serif;
          background: #1a1f3a;
          overflow: hidden;
        }

        /* ── Left panel ─────────────────────────────── */
        .left-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          background: #1a1f3a;
          overflow: hidden;
        }

        .left-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 80%, rgba(224,32,32,0.16) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 80% 20%, rgba(255,255,255,0.05) 0%, transparent 50%);
          pointer-events: none;
        }

        /* Animated grid */
        .grid-lines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at 30% 70%, black 20%, transparent 70%);
          pointer-events: none;
        }

        /* Floating orb */
        .orb {
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(224,32,32,0.22) 0%, transparent 70%);
          bottom: -80px;
          left: -60px;
          filter: blur(40px);
          animation: pulse 6s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        .left-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
          z-index: 1;
        }
        .logo-chip {
          display: inline-flex;
          align-items: center;
          background: #fff;
          border-radius: 12px;
          padding: 8px 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        }

        .left-content {
          position: relative;
          z-index: 1;
        }
        .left-headline {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(36px, 3.5vw, 52px);
          line-height: 1.1;
          color: #fff;
          margin-bottom: 20px;
          letter-spacing: -1px;
        }
        .left-headline em {
          font-style: italic;
          color: #E02020;
        }
        .left-sub {
          font-size: 15px;
          color: #71717a;
          line-height: 1.6;
          max-width: 340px;
          font-weight: 300;
        }

        .stats-row {
          display: flex;
          gap: 32px;
          margin-top: 48px;
        }
        .stat-item {}
        .stat-num {
          font-family: 'DM Mono', monospace;
          font-size: 28px;
          font-weight: 500;
          color: #fff;
          letter-spacing: -1px;
        }
        .stat-label {
          font-size: 12px;
          color: #52525b;
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .left-footer {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .trust-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 11px;
          color: #71717a;
          font-weight: 500;
        }
        .trust-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 6px rgba(34,197,94,0.6);
        }

        /* ── Right panel ─────────────────────────────── */
        .right-panel {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 48px 64px;
          background: #fafafa;
          position: relative;
        }

        .right-panel::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(224,32,32,0.3) 40%, rgba(224,32,32,0.3) 60%, transparent);
        }

        .form-container {
          width: 100%;
          max-width: 380px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .form-container.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        .form-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          color: #E02020;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 12px;
        }
        .form-title {
          font-family: 'DM Serif Display', serif;
          font-size: 32px;
          color: #1a1f3a;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
          line-height: 1.15;
        }
        .form-sub {
          font-size: 14px;
          color: #71717a;
          margin-bottom: 36px;
          font-weight: 300;
        }

        .field-group {
          margin-bottom: 16px;
        }
        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #3f3f46;
          margin-bottom: 6px;
          letter-spacing: 0.02em;
        }
        .field-input-wrap {
          position: relative;
        }
        .field-input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #e4e4e7;
          border-radius: 10px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: #09090b;
          background: #fff;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          appearance: none;
        }
        .field-input:focus {
          border-color: #E02020;
          box-shadow: 0 0 0 3px rgba(224,32,32,0.12);
        }
        .field-input::placeholder { color: #a1a1aa; }
        .field-input.has-toggle { padding-right: 44px; }

        .toggle-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #a1a1aa;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
        }
        .toggle-btn:hover { color: #E02020; }

        .field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .forgot-link {
          font-size: 12px;
          color: #E02020;
          text-decoration: none;
          font-weight: 500;
        }
        .forgot-link:hover { text-decoration: underline; }

        .error-box {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 16px;
          font-size: 13px;
          color: #991b1b;
          line-height: 1.4;
        }

        .submit-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          margin-top: 8px;
          position: relative;
          overflow: hidden;
        }
        .submit-btn:not(:disabled) {
          background: #E02020;
          color: #fff;
          box-shadow: 0 4px 16px rgba(224,32,32,0.35);
        }
        .submit-btn:not(:disabled):hover {
          background: #c81a1a;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(224,32,32,0.45);
        }
        .submit-btn:not(:disabled):active {
          transform: translateY(0);
        }
        .submit-btn:disabled {
          background: #e4e4e7;
          color: #a1a1aa;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0;
          color: #d4d4d8;
          font-size: 12px;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e4e4e7;
        }

        .register-link {
          text-align: center;
          font-size: 13px;
          color: #71717a;
        }
        .register-link a {
          color: #E02020;
          font-weight: 600;
          text-decoration: none;
        }
        .register-link a:hover { text-decoration: underline; }

        .demo-btn {
          width: 100%;
          padding: 11px;
          border-radius: 10px;
          border: 1.5px solid #e4e4e7;
          background: #fff;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #3f3f46;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .demo-btn:hover {
          border-color: #E02020;
          color: #E02020;
          background: #fff5f5;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .login-root { grid-template-columns: 1fr; }
          .left-panel { display: none; }
          .right-panel { padding: 32px 24px; background: #1a1f3a; }
          .form-title { color: #fff; }
          .form-sub { color: #71717a; }
          .form-eyebrow { color: #E02020; }
          .field-label { color: #a1a1aa; }
          .field-input { background: #18181b; border-color: #27272a; color: #fff; }
          .field-input:focus { border-color: #E02020; }
          .field-input::placeholder { color: #52525b; }
          .register-link { color: #52525b; }
          .right-panel::before { display: none; }
          .demo-btn { background: #18181b; border-color: #27272a; color: #a1a1aa; }
          .demo-btn:hover { background: #1a1f3a; border-color: #E02020; color: #E02020; }
          .error-box { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
        }
      `}</style>

      <div className="login-root">
        {/* Left panel */}
        <div className="left-panel">
          <div className="left-bg" />
          <div className="grid-lines" />
          <div className="orb" />

          <div className="left-logo">
            <span className="logo-chip">
              <Image src="/clearediq-logo.png" alt="cleaREDiq — AI Fraud Detection" width={150} height={45} style={{ objectFit: 'contain', display: 'block' }} />
            </span>
          </div>

          <div className="left-content">
            <h1 className="left-headline">
              Stop expense<br />fraud <em>before</em><br />it costs you.
            </h1>
            <p className="left-sub">
              AI-powered receipt verification that flags manipulated, forged, and AI-generated receipts automatically.
            </p>

            <div className="stats-row">
              <div className="stat-item">
                <div className="stat-num">98.4%</div>
                <div className="stat-label">Detection rate</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">&lt;3s</div>
                <div className="stat-label">Per receipt</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">6×</div>
                <div className="stat-label">Faster audits</div>
              </div>
            </div>
          </div>

          <div className="left-footer">
            <div className="trust-badge">
              <span className="trust-dot" />
              SOC2 ready
            </div>
            <div className="trust-badge">
              <span className="trust-dot" />
              GDPR aware
            </div>
            <div className="trust-badge">
              <span className="trust-dot" />
              256-bit encrypted
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="right-panel">
          <div className={`form-container ${mounted ? 'mounted' : ''}`}>
            <p className="form-eyebrow">Welcome back</p>
            <h2 className="form-title">Sign in to your workspace</h2>
            <p className="form-sub">Enter your credentials to continue</p>

            {error && (
              <div className="error-box">
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="email">Work email</label>
                <input
                  id="email"
                  type="email"
                  className="field-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="field-group">
                <div className="field-row">
                  <label className="field-label" htmlFor="password" style={{ margin: 0 }}>Password</label>
                  <Link href="/forgot-password" className="forgot-link">Forgot password?</Link>
                </div>
                <div className="field-input-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="field-input has-toggle"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setShowPassword(s => !s)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div className="divider">or</div>

            <button
              type="button"
              className="demo-btn"
              onClick={() => {
                setEmail('demo@clearediq.com');
                setPassword('demo1234');
              }}
            >
              <ShieldCheck size={14} />
              Fill demo credentials
            </button>

            <div className="register-link" style={{ marginTop: 24 }}>
              No account yet?{' '}
              <Link href="/register">Start your free trial</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
