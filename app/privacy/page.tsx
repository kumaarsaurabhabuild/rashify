export default function Privacy() {
  return (
    <main className="prose mx-auto px-6 py-12">
      <h1>Privacy Policy</h1>
      <p>Last updated: 2026-04-27.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Name, date/time/place of birth, WhatsApp phone number</li>
        <li>Hashed IP address (for abuse prevention)</li>
        <li>UTM + referrer for attribution</li>
      </ul>
      <h2>Why</h2>
      <p>To generate and deliver your Vedic archetype profile and to send your results on WhatsApp.</p>
      <h2>Third parties we share with</h2>
      <ul>
        <li>Prokerala (chart calculation)</li>
        <li>Google (Gemini, archetype writing)</li>
        <li>AiSensy + Meta (WhatsApp delivery)</li>
        <li>Supabase (storage)</li>
        <li>PostHog (analytics, phone is masked in recordings)</li>
      </ul>
      <h2>Retention</h2>
      <p>7 years, or until deletion requested.</p>
      <h2>Your rights (DPDP Act 2023)</h2>
      <p>You may request deletion of your data at <a href="/api/delete-me">/api/delete-me</a> or by replying STOP to any WhatsApp from us.</p>
      <h2>Contact</h2>
      <p>Email: privacy@rashify.in</p>
    </main>
  );
}
