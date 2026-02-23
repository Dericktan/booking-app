'use client';
import { useState, useEffect } from 'react';

interface Merchant {
  id: string;
  name: string;
  commission_percentage: string;
}

interface Service {
  id: string;
  name: string;
  base_price: string;
  dynamic_pricing_enabled: boolean;
  merchant_id: string;
}

interface Booking {
  id: string;
  service: { name: string };
  final_price_snapshot: string;
  platform_fee_snapshot: string;
  merchant_earning_snapshot: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<string>('');
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<'services' | 'bookings' | 'create'>('services');

  // Create merchant form
  const [newMerchantEmail, setNewMerchantEmail] = useState('');
  const [newMerchantName, setNewMerchantName] = useState('');
  const [newMerchantCommission, setNewMerchantCommission] = useState('10');

  // Create service form
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('60');
  const [newServiceDynamic, setNewServiceDynamic] = useState(false);

  const fetchMerchants = async () => {
    const res = await fetch('/api/merchants');
    const data = await res.json();
    setMerchants(data);
  };

  const fetchServices = async (merchantId: string) => {
    const res = await fetch(`/api/services?merchant_id=${merchantId}`);
    const data = await res.json();
    setServices(data);
  };

  const fetchBookings = async (merchantId: string) => {
    const res = await fetch(`/api/bookings?merchant_id=${merchantId}`);
    const data = await res.json();
    setBookings(data);
  };

  useEffect(() => { fetchMerchants(); }, []);

  useEffect(() => {
    if (selectedMerchant) {
      fetchServices(selectedMerchant);
      fetchBookings(selectedMerchant);
    }
  }, [selectedMerchant]);

  const createMerchant = async () => {
    // First create a user for this merchant
    const userRes = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newMerchantEmail, password: 'password123', role: 'MERCHANT' }),
    });
    const user = await userRes.json();

    await fetch('/api/merchants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_user_id: user.id,
        name: newMerchantName,
        commission_percentage: Number(newMerchantCommission),
      }),
    });
    setNewMerchantEmail('');
    setNewMerchantName('');
    setNewMerchantCommission('10');
    await fetchMerchants();
  };

  const createService = async () => {
    await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: selectedMerchant,
        name: newServiceName,
        base_price: Number(newServicePrice),
        duration_minutes: Number(newServiceDuration),
        dynamic_pricing_enabled: newServiceDynamic,
      }),
    });
    setNewServiceName('');
    setNewServicePrice('');
    await fetchServices(selectedMerchant);
  };

  const toggleDynamic = async (serviceId: string, current: boolean) => {
    await fetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dynamic_pricing_enabled: !current }),
    });
    await fetchServices(selectedMerchant);
  };

  const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.final_price_snapshot), 0);
  const totalFees = bookings.reduce((sum, b) => sum + Number(b.platform_fee_snapshot), 0);
  const netRevenue = bookings.reduce((sum, b) => sum + Number(b.merchant_earning_snapshot), 0);

  const s: Record<string, React.CSSProperties> = {
    container: { fontFamily: 'sans-serif', maxWidth: 1000, margin: '0 auto', padding: '2rem' },
    row: { display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' },
    input: { padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.95rem' },
    btn: { padding: '0.4rem 0.8rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
    tab: { padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '2px solid transparent' },
    activeTab: { padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '2px solid #0070f3', fontWeight: 'bold' },
    table: { width: '100%', borderCollapse: 'collapse' as const, marginTop: '1rem' },
    th: { textAlign: 'left' as const, padding: '0.5rem', borderBottom: '1px solid #ccc', background: '#f5f5f5' },
    td: { padding: '0.5rem', borderBottom: '1px solid #eee' },
    summary: { display: 'flex', gap: '2rem', marginBottom: '1rem' },
    card: { background: '#f5f5f5', padding: '1rem', borderRadius: 8, flex: 1 },
  };

  return (
    <div style={s.container}>
      <h1>Merchant Dashboard</h1>

      {/* Merchant setup */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>Create Merchant</h2>
        <div style={s.row}>
          <input style={s.input} placeholder="Email" value={newMerchantEmail} onChange={e => setNewMerchantEmail(e.target.value)} />
          <input style={s.input} placeholder="Merchant name" value={newMerchantName} onChange={e => setNewMerchantName(e.target.value)} />
          <input style={s.input} placeholder="Commission %" type="number" value={newMerchantCommission} onChange={e => setNewMerchantCommission(e.target.value)} />
          <button style={s.btn} onClick={createMerchant}>Create</button>
        </div>

        <h2>Select Merchant</h2>
        <select style={s.input} value={selectedMerchant} onChange={e => setSelectedMerchant(e.target.value)}>
          <option value="">-- Select --</option>
          {merchants.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.commission_percentage}% commission)</option>
          ))}
        </select>
      </section>

      {selectedMerchant && (
        <>
          {/* Summary */}
          <div style={s.summary}>
            <div style={s.card}><strong>Total Bookings</strong><br />{bookings.length}</div>
            <div style={s.card}><strong>Gross Revenue</strong><br />{totalRevenue.toLocaleString()}</div>
            <div style={s.card}><strong>Platform Fees</strong><br />{totalFees.toLocaleString()}</div>
            <div style={s.card}><strong>Net Revenue</strong><br />{netRevenue.toLocaleString()}</div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #ccc', marginBottom: '1rem' }}>
            <span style={tab === 'services' ? s.activeTab : s.tab} onClick={() => setTab('services')}>Services</span>
            <span style={tab === 'bookings' ? s.activeTab : s.tab} onClick={() => setTab('bookings')}>Bookings</span>
            <span style={tab === 'create' ? s.activeTab : s.tab} onClick={() => setTab('create')}>Create Service</span>
          </div>

          {tab === 'create' && (
            <section>
              <h3>New Service</h3>
              <div style={s.row}>
                <input style={s.input} placeholder="Service name" value={newServiceName} onChange={e => setNewServiceName(e.target.value)} />
                <input style={s.input} placeholder="Base price" type="number" value={newServicePrice} onChange={e => setNewServicePrice(e.target.value)} />
                <input style={s.input} placeholder="Duration (min)" type="number" value={newServiceDuration} onChange={e => setNewServiceDuration(e.target.value)} />
                <label>
                  <input type="checkbox" checked={newServiceDynamic} onChange={e => setNewServiceDynamic(e.target.checked)} />
                  {' '}Dynamic pricing
                </label>
                <button style={s.btn} onClick={createService}>Create Service</button>
              </div>
            </section>
          )}

          {tab === 'services' && (
            <section>
              <h3>Services</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Base Price</th>
                    <th style={s.th}>Dynamic Pricing</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(svc => (
                    <tr key={svc.id}>
                      <td style={s.td}>{svc.name}</td>
                      <td style={s.td}>{Number(svc.base_price).toLocaleString()}</td>
                      <td style={s.td}>{svc.dynamic_pricing_enabled ? '✅ On' : '❌ Off'}</td>
                      <td style={s.td}>
                        <button style={s.btn} onClick={() => toggleDynamic(svc.id, svc.dynamic_pricing_enabled)}>
                          {svc.dynamic_pricing_enabled ? 'Disable' : 'Enable'} Dynamic
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === 'bookings' && (
            <section>
              <h3>Bookings</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Service</th>
                    <th style={s.th}>Final Price</th>
                    <th style={s.th}>Platform Fee</th>
                    <th style={s.th}>Merchant Earning</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td style={s.td}>{b.service.name}</td>
                      <td style={s.td}>{Number(b.final_price_snapshot).toLocaleString()}</td>
                      <td style={s.td}>{Number(b.platform_fee_snapshot).toLocaleString()}</td>
                      <td style={s.td}>{Number(b.merchant_earning_snapshot).toLocaleString()}</td>
                      <td style={s.td}>{b.status}</td>
                      <td style={s.td}>{new Date(b.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
