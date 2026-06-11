'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const NAVY = '#1a1f3a';
const RED  = '#E02020';

export default function LandingPage() {
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      id: 'starter', name: 'Starter', monthly: 49, annual: 39,
      receipts: '200 receipts/mo', users: '1 admin user',
      features: ['Five gate fraud detection','Address + phone verify','AI vision analysis','Email alerts','Basic reports'],
    },
    {
      id: 'business', name: 'Business', monthly: 99, annual: 79,
      receipts: '1,000 receipts/mo', users: 'Up to 10 users',
      features: ['Everything in Starter','GPS geolocation check','Fuel receipt verification','Custom policy rules','PDF fraud reports','IRS audit export','Priority support'],
      highlight: true,
    },
    {
      id: 'enterprise', name: 'Enterprise', monthly: null, annual: null,
      receipts: 'Unlimited receipts', users: 'Unlimited users',
      features: ['Everything in Business','Trucking vertical','QuickBooks integration','Cross-company fraud DB','Dedicated account manager','Custom contracts','SLA guarantee'],
    },
  ];

  const stats = [
    { num: '14%', label: 'of fraudulent receipts are now AI-generated — up from 0% last year' },
    { num: '$50K', label: 'median annual loss per company from expense fraud (ACFE 2024)' },
    { num: '18mo', label: 'average time before expense fraud is detected without tools' },
    { num: '3 sec', label: 'time for cleaREDiq to analyze and score any receipt' },
  ];

  const howItWorks = [
    { num: '1', title: 'Upload or photograph', desc: 'Employee submits a receipt via web upload, email forward, or mobile camera. No workflow change needed.' },
    { num: '2', title: 'Five gate analysis runs', desc: 'AI vision, address verification, phone check, GPS validation, and behavioral analysis all run simultaneously.' },
    { num: '3', title: 'Instant verdict', desc: 'Score 0-100 in 3-8 seconds. Auto-approved, manager review, or blocked — with full explanation of every flag.' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: NAVY }}>

      {/* NAV */}
      <nav style={{ background: NAVY, padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: '#fff', borderRadius: 10, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
            <Image src="/clearediq-logo.png" alt="cleaREDiq — AI Fraud Detection" width={156} height={47} style={{ objectFit: 'contain', display: 'block' }} />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#how-it-works" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>How it works</a>
          <a href="#pricing" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Pricing</a>
          <Link href="/login" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Sign in</Link>
          <Link href="/register" style={{ background: RED, color: '#fff', padding: '8px 18px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            Start free trial
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background: NAVY, padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(224,32,32,0.15)', border: '1px solid rgba(224,32,32,0.4)', borderRadius: 20, padding: '4px 14px', marginBottom: 20 }}>
          <span style={{ color: RED, fontSize: 12, fontWeight: 600 }}>NEW — AI receipt fraud up 14% in 90 days</span>
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1.1, maxWidth: 800, margin: '0 auto 20px' }}>
          Stop fake receipts<br /><span style={{ color: RED }}>before they cost you</span>
        </h1>
        <p style={{ fontSize: 20, color: '#9ca3af', maxWidth: 600, margin: '0 auto 36px', lineHeight: 1.6 }}>
          cleaREDiq analyzes every receipt in 3 seconds — catching AI-generated fakes, inflated amounts, and manipulated documents that human reviewers miss.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ background: RED, color: '#fff', padding: '14px 32px', borderRadius: 10, textDecoration: 'none', fontSize: 16, fontWeight: 700 }}>
            Start 14-day free trial →
          </Link>
          <a href="#how-it-works" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '14px 32px', borderRadius: 10, textDecoration: 'none', fontSize: 16, fontWeight: 600, border: '1px solid rgba(255,255,255,0.15)' }}>
            See how it works
          </a>
        </div>
        <p style={{ color: '#4b5563', fontSize: 13, marginTop: 16 }}>No credit card required · Setup in 5 minutes · Cancel anytime</p>
      </div>

      {/* STATS */}
      <div style={{ background: '#f8f9fc', padding: '48px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          {stats.map(s => (
            <div key={s.num} style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: RED, lineHeight: 1 }}>{s.num}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8, lineHeight: 1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PROOF — RED OAK CAFE */}
      <div style={{ padding: '72px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, color: NAVY, marginBottom: 12 }}>This is a real receipt we manipulated using a free AI tool</h2>
          <p style={{ fontSize: 16, color: '#6b7280', maxWidth: 600, margin: '0 auto' }}>
            We used a leading AI editing tool — available free online — to inflate prices, change the address, and swap in a fake phone number. The math recalculated perfectly. Leading expense management platforms approved it. cleaREDiq caught it in 3 seconds.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
          {[
            { label: 'ORIGINAL RECEIPT', color: '#16a34a', bg: '#f0fdf4', items: [['Address','6011 W Main, League City TX'],['Phone','832-905-3150'],['Power Bowl','$13.35'],['Club Salad','$13.35'],['Total','$26.74']] },
            { label: 'MANIPULATED — SUBMITTED FOR REIMBURSEMENT', color: RED, bg: '#fef2f2', items: [['Address','123 Main St, Houston TX ✗'],['Phone','713-555-0123 ✗ FAKE'],['Power Bowl','$23.35 (+$10)'],['Club Salad','$23.35 (+$10)'],['Total','$42.98 (+$16.24)']] },
          ].map(col => (
            <div key={col.label} style={{ background: col.bg, border: `2px solid ${col.color}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: col.color, marginBottom: 16, letterSpacing: '0.06em' }}>{col.label}</div>
              {col.items.map(([k,v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: col.color === RED ? RED : NAVY }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ background: '#1a1f3a', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: RED, marginBottom: 8 }}>Score: 94 / 100 — CRITICAL</div>
          <div style={{ fontSize: 15, color: '#9ca3af' }}>Wrong city · Fake 555 phone number · $10 round-number inflation on every item · AI pixel editing detected</div>
          <div style={{ fontSize: 13, color: '#4b5563', marginTop: 8 }}>The math was perfect. Leading expense platforms would have approved this. cleaREDiq blocked it.</div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div id="how-it-works" style={{ background: '#f8f9fc', padding: '72px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, textAlign: 'center', marginBottom: 12 }}>How it works</h2>
          <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 48, fontSize: 16 }}>Three steps. No workflow changes. Works with what you already use.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {howItWorks.map(s => (
              <div key={s.num} style={{ background: '#fff', borderRadius: 12, padding: 28, border: '0.5px solid #e5e7eb' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: RED, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>{s.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FIVE GATES */}
      <div style={{ padding: '72px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 38, fontWeight: 800, textAlign: 'center', marginBottom: 12 }}>The Five Gate process</h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 48, fontSize: 16 }}>Five simultaneous checks. One fraud score. Nothing gets through undetected.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { n:'1', title:'Capture', desc:'GPS · Device · Timestamp · Hash', color:'#E02020' },
            { n:'2', title:'Authenticity', desc:'AI vision · Edit detection · Pixel forensics', color:'#f97316' },
            { n:'3', title:'Data', desc:'Address · Phone · Math · Tax · Business hours', color:'#eab308' },
            { n:'4', title:'Behavior', desc:'Round numbers · Threshold fraud · Travel match', color:'#3b82f6' },
            { n:'5', title:'Policy', desc:'Meal limits · Category rules · Age limits', color:'#8b5cf6' },
          ].map(g => (
            <div key={g.n} style={{ background: NAVY, borderRadius: 12, padding: 20, border: `2px solid ${g.color}`, textAlign: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: g.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, margin: '0 auto 12px' }}>{g.n}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{g.title}</div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{g.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" style={{ background: '#f8f9fc', padding: '72px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, textAlign: 'center', marginBottom: 12 }}>Simple, transparent pricing</h2>
          <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 24, fontSize: 16 }}>No per-scan fees. No surprises. Cancel anytime.</p>

          {/* Toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <span style={{ fontSize: 14, color: annual ? '#6b7280' : NAVY, fontWeight: annual ? 400 : 600 }}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              style={{ width: 44, height: 24, borderRadius: 12, background: annual ? RED : '#d1d5db', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: annual ? 23 : 3, transition: 'left 0.2s' }} />
            </button>
            <span style={{ fontSize: 14, color: annual ? NAVY : '#6b7280', fontWeight: annual ? 600 : 400 }}>Annual <span style={{ color: RED, fontWeight: 700 }}>save 20%</span></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {plans.map(plan => (
              <div key={plan.id} style={{
                background: '#fff', borderRadius: 16, padding: 28,
                border: `${plan.highlight ? '2px' : '0.5px'} solid ${plan.highlight ? RED : '#e5e7eb'}`,
                position: 'relative',
                transform: plan.highlight ? 'scale(1.02)' : 'scale(1)',
              }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: RED, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 20 }}>
                    MOST POPULAR
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 8 }}>{plan.name}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: NAVY, marginBottom: 4 }}>
                  {plan.monthly ? `$${annual ? plan.annual : plan.monthly}` : 'Custom'}
                  {plan.monthly && <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>/mo</span>}
                </div>
                {annual && plan.monthly && (
                  <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 4 }}>billed annually · save ${((plan.monthly - (plan.annual ?? 0)) * 12).toFixed(0)}/year</div>
                )}
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>📄 {plan.receipts}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>👤 {plan.users}</div>
                <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 16, marginBottom: 20 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: RED, fontWeight: 700 }}>✓</span>
                      <span style={{ color: '#374151' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={plan.monthly ? `/register?plan=${plan.id}` : 'mailto:hello@clearediq.com'}
                  style={{ display: 'block', textAlign: 'center', background: plan.highlight ? RED : '#f9fafb', color: plan.highlight ? '#fff' : NAVY, padding: '12px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700, border: plan.highlight ? 'none' : `0.5px solid #e5e7eb` }}
                >
                  {plan.monthly ? 'Start free trial' : 'Contact sales'}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 24 }}>All plans include a 14-day free trial · No credit card required to start</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: NAVY, padding: '72px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 38, fontWeight: 900, color: '#fff', marginBottom: 16 }}>Stop the next fake receipt now</h2>
        <p style={{ color: '#9ca3af', fontSize: 16, marginBottom: 32 }}>Join companies protecting their bottom line with cleaREDiq.</p>
        <Link href="/register" style={{ background: RED, color: '#fff', padding: '16px 40px', borderRadius: 12, textDecoration: 'none', fontSize: 18, fontWeight: 700 }}>
          Start your free 14-day trial →
        </Link>
        <p style={{ color: '#4b5563', fontSize: 13, marginTop: 16 }}>No credit card · 5-minute setup · Cancel anytime</p>
      </div>

      {/* FOOTER */}
      <div style={{ background: '#0f1424', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>clea<span style={{ color: RED }}>RED</span>iq</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>Privacy Policy</a>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>Terms of Service</a>
          <a href="mailto:hello@clearediq.com" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>hello@clearediq.com</a>
        </div>
        <span style={{ color: '#374151', fontSize: 12 }}>© 2026 cleaREDiq LLC · AI Fraud Detection</span>
      </div>

    </div>
  );
}
