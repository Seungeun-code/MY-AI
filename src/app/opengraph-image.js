import { ImageResponse } from 'next/og';

// edge 런타임에서 요청 시 생성 (빌드 시 정적 프리렌더를 하지 않아 경로 이슈 회피)
export const runtime = 'edge';

// 링크(카카오톡/트위터 등) 미리보기용 이미지 — 1200x630 PNG를 코드로 렌더링
export const alt = 'RUNCRAFT — 실지도 러닝 시뮬레이터';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          backgroundColor: '#04140d',
          backgroundImage:
            'radial-gradient(circle at 82% 18%, rgba(163,230,53,0.20), transparent 46%), linear-gradient(135deg, #04140d 0%, #0a2a1d 55%, #0f3a29 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 상단 배지 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#a3e635',
              marginRight: '16px',
            }}
          />
          <div
            style={{
              display: 'flex',
              color: '#a3e635',
              fontSize: '30px',
              fontWeight: 700,
              letterSpacing: '6px',
            }}
          >
            TMAP · LIVE MAP
          </div>
        </div>

        {/* 중앙 워드마크 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: '176px',
              fontWeight: 900,
              letterSpacing: '-5px',
              lineHeight: 1,
            }}
          >
            <div style={{ display: 'flex', color: '#ffffff' }}>RUN</div>
            <div style={{ display: 'flex', color: '#a3e635' }}>CRAFT</div>
          </div>
          <div
            style={{
              display: 'flex',
              color: '#cbd5c0',
              fontSize: '42px',
              marginTop: '18px',
            }}
          >
            Real-road running simulator
          </div>
        </div>

        {/* 하단 경로선 + URL 칩 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#a3e635',
                border: '6px solid rgba(163,230,53,0.25)',
              }}
            />
            <div
              style={{
                width: '240px',
                height: '0px',
                borderTop: '6px dashed rgba(163,230,53,0.7)',
                marginLeft: '10px',
                marginRight: '10px',
              }}
            />
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: '6px solid rgba(255,255,255,0.22)',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              color: '#04140d',
              backgroundColor: '#a3e635',
              fontSize: '30px',
              fontWeight: 700,
              padding: '14px 30px',
              borderRadius: '999px',
            }}
          >
            runcraft-app.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
