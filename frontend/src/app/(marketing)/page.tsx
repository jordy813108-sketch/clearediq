'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

/*
  cleaREDiq landing page — "forensic precision" direction.
  Display: system sans (tight, confident). Data/labels: ui-monospace — used for
  receipt fields, scores, and eyebrows so the page reads like verified machine
  output, tying it to the receipt/evidence world.

  All claims are limited to what the product does TODAY. Features not yet built
  (GPS, behavior, integrations, IRS export) are NOT sold as live — they live in a
  single honest "coming soon" line. Re-add to a plan only once shipped.
*/

const NAVY = '#14172b';
const INK  = '#2f3347';
const MUTE = '#7c8096';
const FAINT= '#a7aaba';
const RED  = '#E02020';
const LINE = 'rgba(20,23,43,0.09)';
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export default function LandingPage() {
  const [annual, setAnnual] = useState(false);

  const plans = [
    { id: 'starter', name: 'Starter', monthly: 49, annual: 39,
      receipts: '200 receipts / mo', users: '1 admin user',
      features: ['Receipt OCR + extraction','Merchant verification','Math & tax validation','AI authenticity check','Email alerts'] },
    { id: 'business', name: 'Business', monthly: 99, annual: 79,
      receipts: '1,000 receipts / mo', users: 'Up to 10 users',
      features: ['Everything in Starter','Business-type flagging','Image edit forensics','AI-origin (C2PA) detection','Duplicate detection','PDF fraud reports','Priority support'],
      highlight: true },
    { id: 'enterprise', name: 'Enterprise', monthly: null, annual: null,
      receipts: 'Unlimited receipts', users: 'Unlimited users',
      features: ['Everything in Business','Custom policy rules','Dedicated onboarding','Custom contracts'] },
  ];

  const stats = [
    { num: '0 → 14%', label: 'share of fraudulent receipts that are AI-generated, in one year (FT, 2025)' },
    { num: '$141K', label: 'median loss per fraud case, companies under 100 staff (ACFE, 2024)' },
    { num: '~70%', label: 'of CFOs believe employees use AI to falsify expenses (SAP, 2025)' },
  ];

  const steps = [
    { n: '01', t: 'Submit', d: 'Upload or photograph a receipt. No workflow change for your team.' },
    { n: '02', t: 'Cross-check', d: 'OCR reads it, then every claim is verified against the real world — merchant, math, tax, business type, image origin.' },
    { n: '03', t: 'Score', d: 'A 0–100 risk score with each flag explained. Clean clears; suspicious is held for a human — never auto-rejected.' },
  ];

  const checks = [
    { t: 'Real merchant', d: 'Confirms the business exists, with matching address and details.' },
    { t: 'Math & tax', d: 'Reconciles subtotal, tax, tip and total. The arithmetic has to hold.' },
    { t: 'Business type', d: 'Flags spend that does not fit — a bar tab billed as a client meal.' },
    { t: 'Image origin', d: 'Detects re-saved or edited images and AI provenance (C2PA) signatures.' },
    { t: 'Duplicates', d: 'Catches the same receipt twice, even renamed or lightly cropped.' },
    { t: 'Human review', d: 'Anything suspicious routes to a person. Nothing is auto-rejected.' },
  ];

  const orig = [['merchant','Red Oak Cafe'],['address','6011 W Main, League City TX'],['phone','832-905-3150'],['total','$26.74']];
  const fake = [['merchant','Red Oak Cafe'],['address','123 Main St, Houston TX'],['phone','713-555-0123'],['total','$42.98']];

  return (
    <div style={{ fontFamily: SANS, color: INK, WebkitFontSmoothing: 'antialiased', overflowX: 'hidden' }}>

      {/* NAV */}
      <nav style={{ background: NAVY, padding: '0 32px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ background: '#fff', borderRadius: 7, padding: '5px 12px', display: 'inline-flex', alignItems: 'center' }}>
          <Image src="/clearediq-logo.png" alt="cleaREDiq" width={128} height={38} style={{ objectFit: 'contain', display: 'block' }} />
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <a href="#proof" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13.5 }}>Proof</a>
          <a href="#how" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13.5 }}>How it works</a>
          <a href="#pricing" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13.5 }}>Pricing</a>
          <Link href="/login" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13.5 }}>Sign in</Link>
          <Link href="/register" style={{ background: RED, color: '#fff', padding: '7px 15px', borderRadius: 7, textDecoration: 'none', fontSize: 13.5, fontWeight: 500 }}>Start free trial</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: NAVY, padding: '116px 32px 124px', textAlign: 'center', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 100, padding: '5px 15px', marginBottom: 34 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: RED, display: 'inline-block' }} />
          <span style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: '0.01em' }}>AI fake receipts: 0% → 14% of fraud in one year</span>
        </div>
        <h1 style={{ fontSize: 62, fontWeight: 600, color: '#fff', lineHeight: 1.04, letterSpacing: '-0.025em', maxWidth: 740, margin: '0 auto 26px' }}>
          Every receipt,<br />checked against reality.
        </h1>
        <p style={{ fontSize: 19, color: 'rgba(255,255,255,0.52)', maxWidth: 540, margin: '0 auto 44px', lineHeight: 1.6 }}>
          cleaREDiq catches inflated amounts, fake merchants and manipulated documents that sail past a human glance — and past the expense tools you already use.
        </p>
        <div style={{ display: 'flex', gap: 13, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ background: RED, color: '#fff', padding: '13px 26px', borderRadius: 8, textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>Start 14-day free trial →</Link>
          <a href="#proof" style={{ background: 'transparent', color: '#fff', padding: '13px 26px', borderRadius: 8, textDecoration: 'none', fontSize: 15, fontWeight: 500, border: '1px solid rgba(255,255,255,0.18)' }}>See it catch a fake</a>
        </div>
        <p style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 26 }}>no card required · cancel anytime</p>
      </section>

      {/* STATS */}
      <section style={{ padding: '60px 32px', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 940, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 44 }}>
          {stats.map(s => (
            <div key={s.num} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 500, color: NAVY, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.num}</div>
              <div style={{ fontSize: 13, color: MUTE, marginTop: 14, lineHeight: 1.55 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PROOF */}
      <section id="proof" style={{ padding: '100px 32px', maxWidth: 940, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: RED, letterSpacing: '0.1em', marginBottom: 18 }}>CASE FILE · 001</div>
          <h2 style={{ fontSize: 33, fontWeight: 600, color: NAVY, letterSpacing: '-0.02em', marginBottom: 16 }}>We faked a real receipt with a free phone app</h2>
          <p style={{ fontSize: 16, color: MUTE, maxWidth: 580, margin: '0 auto', lineHeight: 1.65 }}>
            We inflated the prices, changed the address and dropped in a fake phone number. The math still balanced — and a major expense platform approved it without a flag. cleaREDiq did not.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
          {[
            { tag: 'ORIGINAL', accent: '#1a8a4a', rows: orig, alt: false },
            { tag: 'MANIPULATED', accent: RED, rows: fake, alt: true },
          ].map(card => (
            <div key={card.tag} style={{ background: '#fff', border: `1px solid ${LINE}`, borderTop: `2px solid ${card.accent}`, borderRadius: 10, padding: '22px 24px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: card.accent, letterSpacing: '0.12em', marginBottom: 18 }}>{card.tag}</div>
              {card.rows.map(([k,v],i) => {
                const changed = card.alt && (orig[i][1] !== v);
                return (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
                    <span style={{ fontFamily: MONO, color: FAINT, fontSize: 11, letterSpacing: '0.04em' }}>{k}</span>
                    <span style={{ fontFamily: MONO, fontWeight: 500, color: changed ? RED : NAVY, textAlign: 'right' }}>{v}{changed && ' ◂'}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ background: NAVY, borderRadius: 10, padding: '26px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 6 }}>CLEAREDIQ VERDICT</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, maxWidth: 420 }}>Wrong city · fake 555 number · round-number inflation · image manipulation detected</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 500, color: '#ff5a5a', lineHeight: 1 }}>94<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>/100</span></div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: '#ff8a8a', letterSpacing: '0.08em', marginTop: 6 }}>FLAGGED FOR REVIEW</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ background: '#fafafb', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: '100px 32px' }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: RED, letterSpacing: '0.1em', textAlign: 'center', marginBottom: 16 }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: 33, fontWeight: 600, color: NAVY, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 64 }}>Three steps. No workflow change.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 44 }}>
            {steps.map(s => (
              <div key={s.n} style={{ borderTop: `2px solid ${NAVY}`, paddingTop: 20 }}>
                <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: RED, letterSpacing: '0.06em', marginBottom: 14 }}>{s.n}</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: NAVY, marginBottom: 10 }}>{s.t}</h3>
                <p style={{ color: MUTE, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT WE CHECK */}
      <section style={{ padding: '100px 32px', maxWidth: 940, margin: '0 auto' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, color: RED, letterSpacing: '0.1em', textAlign: 'center', marginBottom: 16 }}>THE METHOD</div>
        <h2 style={{ fontSize: 33, fontWeight: 600, color: NAVY, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 16 }}>What every receipt is checked against</h2>
        <p style={{ textAlign: 'center', color: MUTE, marginBottom: 52, fontSize: 16, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
          Anyone can generate a convincing fake image. It is far harder to fake a receipt where every detail still holds up against the real world.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1, background: LINE, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
          {checks.map((g, i) => (
            <div key={g.t} style={{ background: '#fff', padding: '26px 26px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, marginBottom: 12 }}>{String(i+1).padStart(2,'0')}</div>
              <div style={{ fontSize: 15.5, fontWeight: 600, color: NAVY, marginBottom: 8 }}>{g.t}</div>
              <div style={{ fontSize: 13.5, color: MUTE, lineHeight: 1.6 }}>{g.d}</div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: MONO, textAlign: 'center', color: FAINT, fontSize: 12, marginTop: 30, letterSpacing: '0.02em' }}>
          coming soon — GPS location · per-employee behavior patterns · accounting integrations
        </p>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background: '#fafafb', borderTop: `1px solid ${LINE}`, padding: '100px 32px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: RED, letterSpacing: '0.1em', textAlign: 'center', marginBottom: 16 }}>PRICING</div>
          <h2 style={{ fontSize: 33, fontWeight: 600, color: NAVY, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 12 }}>Simple, transparent pricing</h2>
          <p style={{ textAlign: 'center', color: MUTE, marginBottom: 36, fontSize: 16 }}>No per-scan fees. Cancel anytime.</p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <span style={{ fontSize: 14, color: annual ? MUTE : NAVY, fontWeight: annual ? 400 : 500 }}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} aria-label="Toggle annual pricing" style={{ width: 42, height: 23, borderRadius: 12, background: annual ? RED : '#d3d4dc', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
              <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: annual ? 22 : 3, transition: 'left .2s' }} />
            </button>
            <span style={{ fontSize: 14, color: annual ? NAVY : MUTE, fontWeight: annual ? 500 : 400 }}>Annual <span style={{ fontFamily: MONO, color: RED, fontSize: 13 }}>−20%</span></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 18 }}>
            {plans.map(plan => (
              <div key={plan.id} style={{ background: '#fff', borderRadius: 13, padding: '30px 28px', border: plan.highlight ? `1.5px solid ${RED}` : `1px solid ${LINE}`, position: 'relative' }}>
                {plan.highlight && (
                  <div style={{ fontFamily: MONO, position: 'absolute', top: -10, left: 26, background: RED, color: '#fff', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', padding: '3px 11px', borderRadius: 100 }}>MOST POPULAR</div>
                )}
                <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 14 }}>{plan.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 500, color: NAVY, marginBottom: 4, letterSpacing: '-0.02em' }}>
                  {plan.monthly ? `$${annual ? plan.annual : plan.monthly}` : 'Custom'}
                  {plan.monthly && <span style={{ fontSize: 13, fontWeight: 400, color: MUTE }}> /mo</span>}
                </div>
                {annual && plan.monthly
                  ? <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#1a8a4a', marginBottom: 18, height: 15 }}>save ${((plan.monthly - (plan.annual ?? 0)) * 12).toFixed(0)}/yr</div>
                  : <div style={{ height: 15, marginBottom: 18 }} />}
                <div style={{ fontSize: 13, color: MUTE, marginBottom: 6 }}>{plan.receipts}</div>
                <div style={{ fontSize: 13, color: MUTE, marginBottom: 22 }}>{plan.users}</div>
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 20, marginBottom: 24 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 11, fontSize: 13.5 }}>
                      <span style={{ color: RED, fontWeight: 600, lineHeight: 1.4 }}>✓</span>
                      <span style={{ color: INK, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href={plan.monthly ? `/register?plan=${plan.id}` : 'mailto:hello@clearediq.com'}
                  style={{ display: 'block', textAlign: 'center', background: plan.highlight ? RED : '#fff', color: plan.highlight ? '#fff' : NAVY, padding: '11px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500, border: plan.highlight ? 'none' : `1px solid ${LINE}` }}>
                  {plan.monthly ? 'Start free trial' : 'Contact sales'}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: MUTE, fontSize: 13, marginTop: 28 }}>All plans include a 14-day free trial · No credit card required</p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: NAVY, padding: '104px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 40, fontWeight: 600, color: '#fff', letterSpacing: '-0.025em', marginBottom: 18 }}>Catch the next fake receipt</h2>
        <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 16, marginBottom: 36, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>Start free for 14 days. Throw your messiest receipts at it and see what it finds.</p>
        <Link href="/register" style={{ background: RED, color: '#fff', padding: '14px 32px', borderRadius: 8, textDecoration: 'none', fontSize: 16, fontWeight: 500 }}>Start your free trial →</Link>
        <p style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 22 }}>no card required · cancel anytime</p>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#0e1120', padding: '34px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>clea<span style={{ color: RED }}>RED</span>iq</span>
        <div style={{ display: 'flex', gap: 26 }}>
          <Link href="/privacy" style={{ color: MUTE, textDecoration: 'none', fontSize: 13 }}>Privacy</Link>
          <Link href="/terms" style={{ color: MUTE, textDecoration: 'none', fontSize: 13 }}>Terms</Link>
          <a href="mailto:hello@clearediq.com" style={{ color: MUTE, textDecoration: 'none', fontSize: 13 }}>Contact</a>
        </div>
        <span style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.25)', fontSize: 11.5 }}>© 2026 cleaREDiq LLC</span>
      </footer>

    </div>
  );
}
