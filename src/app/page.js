import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <h1
            className="text-5xl font-black mb-3"
            style={{ color: '#f1f5f9', letterSpacing: '-0.03em' }}
          >
            MY-AI
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '17px' }}>TMap 실지도 기반 러닝 시뮬레이터</p>
        </div>

        <div className="grid gap-6">
          {/* RunCraft */}
          <Link
            href="/runcraft"
            className="group block transition-all duration-300 hover:scale-[1.01]"
            style={{
              borderRadius: '22px',
              padding: '30px',
              background: 'rgba(22, 30, 49, 0.7)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 24px 60px -24px rgba(0,0,0,0.75)',
            }}
          >
            <div className="flex items-center gap-5">
              <div
                className="flex items-center justify-center"
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '18px',
                  fontSize: '28px',
                  background: 'rgba(255,75,114,0.14)',
                  border: '1px solid rgba(255,75,114,0.22)',
                }}
              >
                🏃
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-extrabold" style={{ color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                  RUN<span style={{ color: '#ff4b72' }}>CRAFT</span>
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
                  실제 도로·보행로 경로 · 턴바이턴 음성 안내 · 실시간 봇 레이스
                </p>
              </div>
              <div
                className="transition-all group-hover:translate-x-1"
                style={{ color: '#64748b' }}
              >
                →
              </div>
            </div>
          </Link>
        </div>

        <footer className="text-center mt-12" style={{ color: '#64748b', fontSize: '13px' }}>
          © 2026 MY-AI — Built with Next.js
        </footer>
      </div>
    </main>
  );
}
