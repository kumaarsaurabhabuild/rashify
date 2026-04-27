export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div style={{ textAlign: 'center' }}>
        <span className="eyebrow">A reading is being prepared</span>
        <div
          style={{
            marginTop: 18,
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 28,
            color: 'var(--parchment-dim)',
          }}
        >
          Reading your stars
          <span className="ellipsis-anim">…</span>
        </div>
      </div>
    </main>
  );
}
