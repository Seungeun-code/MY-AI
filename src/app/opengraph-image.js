import { ImageResponse } from 'next/og';

// edge 런타임에서 요청 시 생성 (빌드 시 정적 프리렌더를 하지 않아 경로 이슈 회피)
export const runtime = 'edge';

// 링크(카카오톡/트위터 등) 미리보기용 이미지 — 1200x630 PNG를 코드로 렌더링
export const alt = 'RUNCRAFT — 실지도 위를 달리는 러닝 시뮬레이터';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 이미지에 등장하는 텍스트 (한글 포함)
const BADGE = 'TMAP · 실시간 지도';
const WORD_A = 'RUN';
const WORD_B = 'CRAFT';
const SUBTITLE = '실지도 위를 달리는 러닝 시뮬레이터';
const URL_TEXT = 'runcraft-app.vercel.app';

// Google Fonts에서 필요한 글자(subset)만 받아옴 → Satori 호환(ttf) 폰트 데이터
async function loadKoreanFont(weight, text) {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(
    text,
  )}`;
  const css = await (await fetch(url)).text();
  const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
  if (!src) throw new Error('font url not found');
  const res = await fetch(src[1]);
  if (!res.ok) throw new Error('font download failed');
  return res.arrayBuffer();
}

export default async function OpengraphImage() {
  // 이미지에 쓰이는 모든 글자를 합쳐 subset 요청 (두 굵기 모두 동일 글자 커버)
  const allText = BADGE + WORD_A + WORD_B + SUBTITLE + URL_TEXT + '· .-';

  let fonts;
  try {
    const [bold, regular] = await Promise.all([
      loadKoreanFont(800, allText),
      loadKoreanFont(400, allText),
    ]);
    fonts = [
      { name: 'NotoKR', data: bold, weight: 800, style: 'normal' },
      { name: 'NotoKR', data: regular, weight: 400, style: 'normal' },
    ];
  } catch {
    // 폰트 로딩 실패 시에도 영문/도형은 기본 폰트로 렌더 (한글만 미표시)
    fonts = undefined;
  }

  const fontFamily = fonts ? 'NotoKR' : 'sans-serif';

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
          fontFamily,
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
              fontSize: '32px',
              fontWeight: 800,
              letterSpacing: '2px',
            }}
          >
            {BADGE}
          </div>
        </div>

        {/* 중앙 워드마크 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: '176px',
              fontWeight: 800,
              letterSpacing: '-5px',
              lineHeight: 1,
            }}
          >
            <div style={{ display: 'flex', color: '#ffffff' }}>{WORD_A}</div>
            <div style={{ display: 'flex', color: '#a3e635' }}>{WORD_B}</div>
          </div>
          <div
            style={{
              display: 'flex',
              color: '#dbe7d0',
              fontSize: '48px',
              fontWeight: 400,
              marginTop: '22px',
            }}
          >
            {SUBTITLE}
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
              fontWeight: 800,
              padding: '14px 30px',
              borderRadius: '999px',
            }}
          >
            {URL_TEXT}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
