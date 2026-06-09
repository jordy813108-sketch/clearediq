'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const NAVY = '#1a1f3a';
const RED  = '#E02020';

const steps = ['Company setup', 'Approval rules', 'Invite team', 'Done'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    companySize: '',
    industry: '',
    mealLimit: '75',
    receiptAge: '30',
    autoApproveBelow: '30',
    alcoholPolicy: 'flag',
    emails: [''],
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: any) => setConfig(c => ({ ...c, [k]: v }));

  async function finish() {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/organizations/onboard`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch {}
    router.push('/dashboard');
  }

  const selStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, width: '100%', marginTop: 6 };
  const inpStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, width: '100%', marginTop: 6, boxSizing: 'border-box' as const };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fc', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: NAVY, height: 56, display: 'flex', alignItems: 'center', padding: '0 32px' }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>clea<span style={{ color: RED }}>RED</span>iq</span>
      </div>

      <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 2, background: i <= step ? RED : '#e5e7eb', marginBottom: 6 }} />
              <div style={{ fontSize: 11, color: i <= step ? RED : '#9ca3af', fontWeight: i === step ? 700 : 400 }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 36, border: '0.5px solid #e5e7eb' }}>

          {step === 0 && (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Tell us about your company</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>We use this to set smart defaults for your fraud detection rules.</p>

              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Company size</label>
              <select style={selStyle} value={config.companySize} onChange={e => set('companySize', e.target.value)}>
                <option value="">Select...</option>
                <option value="1-10">1–10 employees</option>
                <option value="11-50">11–50 employees</option>
                <option value="51-200">51–200 employees</option>
                <option value="200+">200+ employees</option>
              </select>

              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginTop: 16 }}>Industry</label>
              <select style={selStyle} value={config.industry} onChange={e => set('industry', e.target.value)}>
                <option value="">Select...</option>
                <option value="oil_gas">Oil and Gas / Energy</option>
                <option value="trucking">Trucking / Logistics</option>
                <option value="construction">Construction</option>
                <option value="healthcare">Healthcare</option>
                <option value="professional_services">Professional Services</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="real_estate">Real Estate</option>
                <option value="other">Other</option>
              </select>
            </>
          )}

          {step === 1 && (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Set your approval rules</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>These rules automatically enforce your expense policy on every receipt.</p>

              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Maximum meal amount per person ($)</label>
              <input style={inpStyle} type="number" value={config.mealLimit} onChange={e => set('mealLimit', e.target.value)} placeholder="75" />

              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginTop: 16 }}>Maximum receipt age (days)</label>
              <input style={inpStyle} type="number" value={config.receiptAge} onChange={e => set('receiptAge', e.target.value)} placeholder="30" />

              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginTop: 16 }}>Auto-approve receipts with fraud score below</label>
              <input style={inpStyle} type="number" value={config.autoApproveBelow} onChange={e => set('autoApproveBelow', e.target.value)} placeholder="30" />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Receipts scoring above this require manager review. Recommended: 30</div>

              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginTop: 16 }}>Alcohol on receipts</label>
              <select style={selStyle} value={config.alcoholPolicy} onChange={e => set('alcoholPolicy', e.target.value)}>
                <option value="allow">Allow</option>
                <option value="flag">Flag for review</option>
                <option value="block">Block automatically</option>
              </select>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Invite your team</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Add managers who should receive fraud alerts and review flagged receipts.</p>

              {config.emails.map((email, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    style={{ ...inpStyle, marginTop: 0, flex: 1 }}
                    type="email"
                    placeholder="manager@company.com"
                    value={email}
                    onChange={e => {
                      const emails = [...config.emails];
                      emails[i] = e.target.value;
                      set('emails', emails);
                    }}
                  />
                  {config.emails.length > 1 && (
                    <button onClick={() => set('emails', config.emails.filter((_, j) => j !== i))}
                      style={{ padding: '0 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', color: RED, fontWeight: 700 }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => set('emails', [...config.emails, ''])}
                style={{ fontSize: 13, color: RED, background: 'none', border: `1px dashed ${RED}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', marginTop: 4 }}
              >
                + Add another
              </button>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>You can skip this and add team members from Settings later.</p>
            </>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: 8 }}>You are all set!</h2>
              <p style={{ color: '#6b7280', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
                cleaREDiq is now protecting your company. Upload your first receipt to see it in action.
              </p>
              <div style={{ background: '#f8f9fc', borderRadius: 10, padding: 20, marginBottom: 24, textAlign: 'left' }}>
                {[
                  '✓ Fraud detection engine active',
                  '✓ Approval rules configured',
                  '✓ Email alerts ready',
                  '✓ 14-day free trial started',
                ].map(item => (
                  <div key={item} style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>{item}</div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
            {step > 0 && step < 3 ? (
              <button onClick={() => setStep(s => s - 1)}
                style={{ padding: '10px 20px', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: NAVY }}>
                Back
              </button>
            ) : <div />}

            {step < 2 && (
              <button onClick={() => setStep(s => s + 1)}
                style={{ padding: '10px 24px', background: RED, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                Continue →
              </button>
            )}
            {step === 2 && (
              <button onClick={() => setStep(3)}
                style={{ padding: '10px 24px', background: RED, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                Finish setup →
              </button>
            )}
            {step === 3 && (
              <button onClick={finish} disabled={loading}
                style={{ padding: '12px 32px', background: RED, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
                {loading ? 'Setting up...' : 'Go to dashboard →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
