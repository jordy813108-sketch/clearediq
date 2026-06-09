'use client';
import { useState } from 'react';
import Link from 'next/link';

const NAVY = '#1a1f3a';
const RED  = '#E02020';

const plans = [
  { id: 'starter',    name: 'Starter',    price: 49,  receipts: '200/mo',   users: '1 admin' },
  { id: 'business',   name: 'Business',   price: 99,  receipts: '1,000/mo', users: 'Up to 10' },
  { id: 'enterprise', name: 'Enterprise', price: null, receipts: 'Unlimited', users: 'Unlimited' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const currentPlan = 'business';

  async function handleUpgrade(planId: string) {
    if (planId === 'enterprise') { window.location.href = 'mailto:hello@clearediq.com?subject=Enterprise Plan'; return; }
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/create-checkout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await r.json();
      if (data.checkout_url) window.location.href = data.checkout_url;
    } catch {} finally { setLoading(false); }
  }

  async function handlePortal() {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/portal`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.portal_url) window.location.href = data.portal_url;
    } catch {} finally { setLoading(false); }
  }

  const sectionStyle = { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 20 };
  const labelStyle = { fontSize: 13, fontWeight: 600 as const, color: NAVY, display: 'block' as const, marginBottom: 6 };
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' as const };

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: '#6b7280', marginBottom: 32, fontSize: 14 }}>Manage your plan, alerts, and account preferences.</p>

      {/* Plan */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          💳 Subscription
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          {plans.map(plan => (
            <div key={plan.id} style={{ padding: 16, borderRadius: 10, border: `${plan.id === currentPlan ? '2px' : '0.5px'} solid ${plan.id === currentPlan ? RED : '#e5e7eb'}`, background: plan.id === currentPlan ? '#fff5f5' : '#fff', position: 'relative' }}>
              {plan.id === currentPlan && <div style={{ position: 'absolute', top: -10, left: 12, background: RED, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>CURRENT</div>}
              <div style={{ fontSize: 12, fontWeight: 700, color: RED }}>{plan.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: '4px 0' }}>{plan.price ? `$${plan.price}/mo` : 'Custom'}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{plan.receipts} · {plan.users}</div>
              {plan.id !== currentPlan && (
                <button onClick={() => handleUpgrade(plan.id)} disabled={loading}
                  style={{ width: '100%', marginTop: 10, padding: '7px', background: RED, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {plan.price ? 'Upgrade' : 'Contact us'}
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={handlePortal} disabled={loading}
          style={{ padding: '8px 16px', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: NAVY }}>
          📄 Manage billing and invoices
        </button>
      </div>

      {/* Fraud thresholds */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>🎯 Fraud detection thresholds</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[['Auto-approve below score', '30'], ['Manager review above score', '30'], ['Auto-block above score', '75'], ['Max meal per person ($)', '75'], ['Max receipt age (days)', '30']].map(([label, def]) => (
            <div key={label}>
              <label style={labelStyle}>{label}</label>
              <input style={inputStyle} type="number" defaultValue={def} />
            </div>
          ))}
          <div>
            <label style={labelStyle}>Alcohol policy</label>
            <select style={{ ...inputStyle, height: 42 }}>
              <option value="allow">Allow</option>
              <option value="flag" selected>Flag for review</option>
              <option value="block">Block automatically</option>
            </select>
          </div>
        </div>
        <button onClick={() => setSaved(true)} style={{ marginTop: 20, padding: '10px 24px', background: RED, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      {/* Alerts */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>🔔 Alert settings</h2>
        {[
          ['Email me when a HIGH risk receipt is submitted', true],
          ['Email me when a CRITICAL risk receipt is submitted', true],
          ['Daily fraud digest', false],
          ['Weekly analytics report', true],
        ].map(([label, def]) => (
          <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #f9fafb' }}>
            <span style={{ fontSize: 14, color: '#374151' }}>{label as string}</span>
            <input type="checkbox" defaultChecked={def as boolean} style={{ width: 16, height: 16, accentColor: RED }} />
          </div>
        ))}
      </div>

      {/* Account */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>👤 Account</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><label style={labelStyle}>Full name</label><input style={inputStyle} defaultValue="Jordan" /></div>
          <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" defaultValue="jordan@company.com" /></div>
        </div>
        <button style={{ marginTop: 16, padding: '8px 20px', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: NAVY }}>
          Change password
        </button>
      </div>

    </div>
  );
}
