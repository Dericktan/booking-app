import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1>Booking Platform POC</h1>
      <p>Multi-tenant SaaS booking platform with dynamic pricing validation.</p>
      <nav style={{ marginTop: '1rem' }}>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '1rem' }}>
          <li><Link href="/dashboard">Merchant Dashboard</Link></li>
        </ul>
      </nav>
    </main>
  );
}
