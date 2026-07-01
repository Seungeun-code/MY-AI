// TMap 역지오코딩 프록시 (서버 사이드)
// - 좌표 → 실제 주소/건물명. POI 검색이 비활성이어도 이 API 는 현재 키로 동작하므로,
//   지도 클릭 핀에 "실제 장소 이름"을 붙이는 데 사용한다.

const TMAP_KEY = process.env.TMAP_API_KEY || process.env.NEXT_PUBLIC_TMAP_API_KEY;
const RG_ENDPOINT = 'https://apis.openapi.sk.com/tmap/geo/reversegeocoding';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!TMAP_KEY) {
    return Response.json({ error: 'TMAP_API_KEY 가 설정되지 않았습니다.' }, { status: 500 });
  }
  if (!lat || !lon) {
    return Response.json({ error: 'lat/lon 파라미터가 필요합니다.' }, { status: 400 });
  }

  const qs = new URLSearchParams({
    version: '1',
    lat,
    lon,
    coordType: 'WGS84GEO',
    addressType: 'A04', // 도로명 우선, 없으면 지번
  });

  try {
    const res = await fetch(`${RG_ENDPOINT}?${qs.toString()}`, {
      method: 'GET',
      headers: { appKey: TMAP_KEY, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return Response.json({ error: '역지오코딩 실패', status: res.status }, { status: res.status });
    }
    const data = await res.json();
    const info = data?.addressInfo || {};
    // 건물명 > 도로명주소 > 시군구 순으로 이름 결정
    const name =
      info.buildingName ||
      [info.city_do, info.gu_gun, info.roadName, info.buildingIndex].filter(Boolean).join(' ') ||
      info.fullAddress ||
      '선택 지점';
    return Response.json({ name, fullAddress: info.fullAddress || '' });
  } catch (e) {
    return Response.json({ error: '역지오코딩 오류', detail: String(e) }, { status: 502 });
  }
}
