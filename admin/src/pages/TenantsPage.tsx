import { useState, useEffect } from 'react';
import { adminFetch } from '../api/http';
import { NewTenantWizard } from '../components/NewTenantWizard';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactEmail: string;
  userCount: number;
  seasonCount: number;
  createdAt: string;
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selected, setSelected] = useState<Tenant | null>(null);

  async function loadTenants() {
    setLoading(true);
    try {
      const data = await adminFetch('/admin/tenants');
      setTenants(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTenants(); }, []);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = { active: '#166534', onboarding: '#92400E', suspended: '#991B1B' };
    const bg: Record<string, string> = { active: '#F0FDF4', onboarding: '#FFFBEB', suspended: '#FEF2F2' };
    return (
      <span style={{ background: bg[status] || '#F1F5F9', color: colors[status] || '#1B2A4A', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' as const }}>
        {status}
      </span>
    );
  };

  return (
    <div style={{ padding: 32, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B2A4A', margin: 0 }}>Tenants</h1>
          <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: 14 }}>{tenants.length} companies on the platform</p>
        </div>
        <button onClick={() => setShowWizard(true)}
          style={{ background: '#2563EB', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          + New Tenant
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#6B7280', padding: 40, textAlign: 'center' }}>Loading tenants...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead style={{ background: '#1B2A4A' }}>
            <tr>
              {['Company', 'Slug', 'Status', 'Contact Email', 'Users', 'Seasons', 'Created'].map(h => (
                <th key={h} style={{ padding: '12px 16px', color: 'white', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t, i) => (
              <tr key={t.id} onClick={() => setSelected(t)}
                style={{ background: i % 2 === 0 ? 'white' : '#F9FAFB', cursor: 'pointer', borderBottom: '1px solid #E5E7EB' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1B2A4A' }}>{t.name}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#2563EB', fontSize: 13 }}>{t.slug}</td>
                <td style={{ padding: '12px 16px' }}>{statusBadge(t.status)}</td>
                <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: 13 }}>{t.contactEmail || '\u2014'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#374151' }}>{t.userCount}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#374151' }}>{t.seasonCount}</td>
                <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: 13 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showWizard && (
        <NewTenantWizard
          onClose={() => setShowWizard(false)}
          onComplete={() => { setShowWizard(false); loadTenants(); }}
        />
      )}

      {selected && (
        <TenantDetailModal tenant={selected} onClose={() => { setSelected(null); loadTenants(); }} />
      )}
    </div>
  );
}

function TenantDetailModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'owner' });
  const [createdUser, setCreatedUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetch(`/admin/tenants/${tenant.slug}`).then(d => setDetail(d.data)).catch(console.error);
  }, [tenant.slug]);

  async function handleActivate() {
    await adminFetch(`/admin/tenants/${tenant.slug}/activate`, { method: 'POST' });
    onClose();
  }

  async function handleSuspend() {
    if (!confirm(`Suspend ${tenant.name}? All their users will be locked out.`)) return;
    await adminFetch(`/admin/tenants/${tenant.slug}/suspend`, { method: 'POST', body: JSON.stringify({ reason: 'Admin action' }) });
    onClose();
  }

  async function handleCreateUser() {
    setSaving(true);
    try {
      const result = await adminFetch(`/admin/tenants/${tenant.slug}/users`, {
        method: 'POST', body: JSON.stringify(newUser)
      });
      setCreatedUser(result.data);
      setNewUser({ name: '', email: '', role: 'owner' });
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'Arial' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, background: 'white' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#1B2A4A' }}>{tenant.name}</div>
            <div style={{ color: '#6B7280', fontSize: 13, fontFamily: 'monospace' }}>{tenant.slug}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>&times;</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {tenant.status !== 'active' && (
              <button onClick={handleActivate} style={{ background: '#166534', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Activate
              </button>
            )}
            {tenant.status === 'active' && (
              <button onClick={handleSuspend} style={{ background: '#991B1B', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Suspend
              </button>
            )}
          </div>

          {detail?.costConfig && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1B2A4A', marginBottom: 8 }}>Cost Configuration</div>
              <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, fontSize: 13, color: '#374151', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <span>Labor Rate: <strong>${detail.costConfig.labor_rate}/hr x {detail.costConfig.crew_size} crew</strong></span>
                <span>Fuel: <strong>${detail.costConfig.fuel_cost_per_mile}/mi</strong></span>
                <span>Equipment: <strong>${detail.costConfig.equipment_cost_per_hour}/hr</strong></span>
                <span>Overhead: <strong>{detail.costConfig.overhead_rate_percent}%</strong></span>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1B2A4A', marginBottom: 8 }}>Users ({detail?.users?.length || 0})</div>
            {detail?.users?.map((u: any) => (
              <div key={u.id} style={{ padding: '8px 12px', background: '#F9FAFB', borderRadius: 6, marginBottom: 4, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span><strong>{u.name}</strong> &mdash; {u.email}</span>
                <span style={{ color: '#2563EB', fontWeight: 600 }}>{u.role}</span>
              </div>
            ))}

            <div style={{ marginTop: 12, padding: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>Add New User</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input placeholder="Full Name" value={newUser.name} onChange={e => setNewUser(p => ({...p, name: e.target.value}))}
                  style={{ border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
                <input placeholder="Email" value={newUser.email} onChange={e => setNewUser(p => ({...p, email: e.target.value}))}
                  style={{ border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 10px', fontSize: 13 }} />
              </div>
              <select value={newUser.role} onChange={e => setNewUser(p => ({...p, role: e.target.value}))}
                style={{ border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 10px', fontSize: 13, marginBottom: 8, width: '100%' }}>
                <option value="owner">Owner</option>
                <option value="coordinator">Coordinator</option>
                <option value="division_manager">Division Manager</option>
              </select>
              <button onClick={handleCreateUser} disabled={saving || !newUser.name || !newUser.email}
                style={{ background: '#2563EB', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </div>

            {createdUser && (
              <div style={{ marginTop: 12, padding: 16, background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: 8 }}>User created &mdash; Save this password now!</div>
                <div style={{ marginBottom: 4 }}>Email: <strong>{createdUser.user.email}</strong></div>
                <div style={{ background: '#1B2A4A', color: '#4ADE80', padding: '8px 12px', borderRadius: 6, fontFamily: 'monospace', fontSize: 15, letterSpacing: 1 }}>
                  {createdUser.tempPassword}
                </div>
                <div style={{ color: '#6B7280', marginTop: 6, fontSize: 12 }}>This password is shown only once. The user must change it on first login.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
