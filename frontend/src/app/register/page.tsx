'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const NAVY = '#1a1f3a';
const RED  = '#E02020';

export default function RegisterPage() {
  const params = useSearchParams();
  const router = useRouter();
  const plan = params.get('plan') || 'business';

  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: any) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password || !form.company) {
      setError('All fields are required'); return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.detail || 'Registration failed'); return; }
      localStorage.setItem('access_token', data.access_token);
      router.push('/onboarding');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  }

  const planNames: Record<string, string> = { starter: 'Starter $49/mo', business: 'Business $99/mo', enterprise: 'Enterprise' };

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fc', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: NAVY, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>clea<span style={{ color: RED }}>RED</span>iq</span>
        </Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 440, border: '0.5px solid #e5e7eb' }}>

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Start your free trial</h1>
            <div style={{ display: 'inline-block', background: '#fff5f5', border: `1px solid ${RED}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, color: RED, fontWeight: 600 }}>
              {planNames[plan] || 'Business'} · 14 days free
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Full name</label>
              <input style={inputStyle} placeholder="Alex Johnson" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Work email</label>
              <input style={inputStyle} type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Company name</label>
              <input style={inputStyle} placeholder="Acme Corporation" value={form.company} onChange={set('company')} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Password</label>
              <input style={inputStyle} type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ background: RED, color: '#fff', padding: '13px', borderRadius: 10, border: 'none', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 6, opacity: loading ? 0.8 : 1 }}
            >
              {loading ? 'Creating account...' : 'Start free trial →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
            No credit card required · Cancel anytime<br />
            By signing up you agree to our{' '}
            <a href="/terms" style={{ color: RED }}>Terms of Service</a> and{' '}
            <a href="/privacy" style={{ color: RED }}>Privacy Policy</a>
          </p>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 16 }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: RED, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
