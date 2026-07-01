import './globals.css';

export const metadata = {
  title: 'RUNCRAFT · TMap 실지도 러닝 시뮬레이터',
  description: '실제 도로·보행로 경로 위에서 턴바이턴 음성 안내를 들으며 봇들과 경쟁하는 러닝 시뮬레이터',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/*
          TMap JS SDK v2는 document.write()로 내부 스크립트를 로딩하므로,
          Next.js <Script> 컴포넌트(동적 삽입)가 아닌 HTML 정적 <script> 태그로
          직접 삽입해야 정상 작동함.
        */}
        <script
          type="text/javascript"
          src={`https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=${process.env.NEXT_PUBLIC_TMAP_API_KEY}`}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}