import { useState } from 'react';
import { adminFetch } from '../api/http';

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

export function NewTenantWizard({ onClose, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [createdSlug, setCreatedSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [profile, setProfile] = useState({ name: '', slug: '', contactEmail: '', contactPhone: '' });
  const [owner, setOwner] = useState({ name: '', email: '' });
  const [costConfig, setCostConfig] = useState({ laborRate: 18, crewSize: 2, fuelCostPerMile: 0.21, equipmentCostPerHour: 4.50, overheadRatePercent: 12 });
  const [createdOwner, setCreatedOwner] = useState<any>(null);

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleStep1() {
    setSaving(true); setError('');
    try {
      const result = await adminFetch('/admin/tenants', {
        method: 'POST',
        body: JSON.stringify({ ...profile, slug: profile.slug || autoSlug(profile.name) }),
      });
      setCreatedSlug(result.data.slug);
      setStep(2);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleStep2() {
    setSaving(true); setError('');
    try {
      const result = await adminFetch(`/admin/tenants/${createdSlug}/users`, {
        method: 'POST', body: JSON.stringify({ ...owner, role: 'owner' }),
      });
      setCreatedOwner(result.data);
      setStep(3);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleStep3() {
    setSaving(true); setError('');
    try {
      await adminFetch(`/admin/tenants/${createdSlug}/cost-config`, {
        method: 'POST', body: JSON.stringify(costConfig),
      });
      setStep(4);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleActivate() {
    setSaving(true); setError('');
    try {
      await adminFetch(`/admin/tenants/${createdSlug}/activate`, { method: 'POST' });
      onComplete();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  const inputStyle = { width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 12px', fontSize: 14, boxSizing: 'border-box' as const, marginBottom: 12 };
  const labelStyle = { fontSize: 13, color: '#374151', fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };
  const stepColors = ['#E5E7EB', '#E5E7EB', '#E5E7EB', '#E5E7EB'];
  for (let i = 0; i < step; i++) stepColors[i] = '#2563EB';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'Arial' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1B2A4A' }}>New Tenant</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>&times;</button>
        </div>

        <div style={{ display: 'flex', padding: '16px 24px', gap: 8 }}>
          {['Company', 'Owner', 'Cost Config', 'Activate'].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, background: stepColors[i], borderRadius: 2, marginBottom: 6 }} />
              <div style={{ fontSize: 11, color: i < step ? '#2563EB' : '#9CA3AF', fontWeight: i + 1 === step ? 700 : 400 }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {error && <div style={{ color: '#991B1B', background: '#FEF2F2', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}

          {step === 1 && (
            <div>
              <label style={labelStyle}>Company Name *</label>
              <input style={inputStyle} value={profile.name} onChange={e => setProfile(p => ({...p, name: e.target.value, slug: autoSlug(e.target.value)}))} placeholder="Aurora Lawn Services" />
              <label style={labelStyle}>Slug (auto-generated)</label>
              <input style={{...inputStyle, fontFamily: 'monospace', color: '#2563EB'}} value={profile.slug || autoSlug(profile.name)} onChange={e => setProfile(p => ({...p, slug: e.target.value}))} />
              <label style={labelStyle}>Contact Email</label>
              <input style={inputStyle} type="email" value={profile.contactEmail} onChange={e => setProfile(p => ({...p, contactEmail: e.target.value}))} placeholder="owner@company.com" />
              <label style={labelStyle}>Contact Phone</label>
              <input style={inputStyle} value={profile.contactPhone} onChange={e => setProfile(p => ({...p, contactPhone: e.target.value}))} placeholder="(630) 555-0100" />
              <button onClick={handleStep1} disabled={saving || !profile.name}
                style={{ width: '100%', background: '#2563EB', color: 'white', border: 'none', borderRadius: 8, padding: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Creating...' : 'Create Tenant \u2192'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ background: '#EFF6FF', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#1E40AF' }}>
                Tenant <strong>{createdSlug}</strong> created. Now create their owner account.
              </div>
              <label style={labelStyle}>Owner Full Name *</label>
              <input style={inputStyle} value={owner.name} onChange={e => setOwner(p => ({...p, name: e.target.value}))} placeholder="John Smith" />
              <label style={labelStyle}>Owner Email *</label>
              <input style={inputStyle} type="email" value={owner.email} onChange={e => setOwner(p => ({...p, email: e.target.value}))} placeholder="john@auroralawns.com" />
              <button onClick={handleStep2} disabled={saving || !owner.name || !owner.email}
                style={{ width: '100%', background: '#2563EB', color: 'white', border: 'none', borderRadius: 8, padding: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Creating...' : 'Create Owner Account \u2192'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              {createdOwner && (
                <div style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#166534', marginBottom: 6, fontSize: 13 }}>Owner account created &mdash; copy password now:</div>
                  <div style={{ background: '#1B2A4A', color: '#4ADE80', padding: '8px 12px', borderRadius: 6, fontFamily: 'monospace', fontSize: 15, letterSpacing: 1 }}>{createdOwner.tempPassword}</div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Labor Rate ($/hr)', key: 'laborRate', step: 0.5 },
                  { label: 'Crew Size', key: 'crewSize', step: 1 },
                  { label: 'Fuel ($/mile)', key: 'fuelCostPerMile', step: 0.01 },
                  { label: 'Equipment ($/hr)', key: 'equipmentCostPerHour', step: 0.25 },
                  { label: 'Overhead (%)', key: 'overheadRatePercent', step: 0.5 },
                ].map(f => (
                  <div key={f.key}>
                    <label style={labelStyle}>{f.label}</label>
                    <input type="number" step={f.step} style={{...inputStyle}}
                      value={costConfig[f.key as keyof typeof costConfig]}
                      onChange={e => setCostConfig(p => ({...p, [f.key]: parseFloat(e.target.value)}))} />
                  </div>
                ))}
              </div>
              <button onClick={handleStep3} disabled={saving}
                style={{ width: '100%', background: '#2563EB', color: 'white', border: 'none', borderRadius: 8, padding: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : 'Save Cost Config \u2192'}
              </button>
            </div>
          )}

          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#9989;</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1B2A4A', marginBottom: 8 }}>Ready to Activate</div>
              <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>
                All configuration is complete for <strong>{createdSlug}</strong>.<br/>
                Click Activate to allow the owner to log in.
              </div>
              <button onClick={handleActivate} disabled={saving}
                style={{ background: '#166534', color: 'white', border: 'none', borderRadius: 8, padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Activating...' : 'Activate Tenant'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
