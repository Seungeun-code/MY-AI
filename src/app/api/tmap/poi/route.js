// TMap POI 통합검색 프록시 (서버 사이드)
// - 브라우저에서 apis.openapi.sk.com 을 직접 호출하면 CORS 로 막히므로,
//   Next.js Route Handler 를 프록시로 두고 여기서 TMap REST API 를 호출한다.
// - appKey 도 서버에서만 사용해 노출을 줄인다. (SDK 용 NEXT_PUBLIC 키를 폴백으로 허용)

const TMAP_KEY = process.env.TMAP_API_KEY || process.env.NEXT_PUBLIC_TMAP_API_KEY;
const POI_ENDPOINT = 'https://apis.openapi.sk.com/tmap/pois';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get('keyword') || '').trim();
  const count = searchParams.get('count') || '15';
  const centerLat = searchParams.get('centerLat'); // 선택: 결과를 특정 좌표 주변으로 편향
  const centerLon = searchParams.get('centerLon');
  const radius = searchParams.get('radius'); // km 단위 (0~33)

  if (!TMAP_KEY) {
    return Response.json({ error: 'TMAP_API_KEY 가 설정되지 않았습니다.' }, { status: 500 });
  }
  if (!keyword) {
    return Response.json({ error: 'keyword 파라미터가 필요합니다.' }, { status: 400 });
  }

  const qs = new URLSearchParams({
    version: '1',
    searchKeyword: keyword,
    searchType: 'all',
    searchtypCd: 'A',
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    count: String(count),
    page: '1',
  });
  if (centerLat && centerLon) {
    qs.set('centerLat', centerLat);
    qs.set('centerLon', centerLon);
    if (radius) qs.set('radius', radius);
  }

  try {
    const res = await fetch(`${POI_ENDPOINT}?${qs.toString()}`, {
      method: 'GET',
      headers: { appKey: TMAP_KEY, Accept: 'application/json' },
      cache: 'no-store',
    });

    // 204 No Content: 키는 유효하지만(게이트웨이 통과) POI 검색 상품이
    // 이 앱에 활성화되지 않았을 때 TMap 이 내려주는 응답.
    if (res.status === 204) {
      return Response.json(
        {
          error: 'POI_API_NOT_ENABLED',
          message:
            'TMap POI(장소) 검색 API가 이 appKey에 활성화되어 있지 않습니다. ' +
            'SK open API 콘솔(openapi.sk.com)에서 앱에 "TMAP 장소(POI) 검색" API를 추가/활성화하세요. ' +
            '(보행자 경로안내는 이미 정상 동작합니다.)',
        },
        { status: 424 }, // Failed Dependency: 외부 API 권한 미비
      );
    }

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: 'TMap POI 검색 실패', status: res.status, detail: text.slice(0, 500) },
        { status: res.status },
      );
    }

    const data = await res.json();
    const rawPois = data?.searchPoiInfo?.pois?.poi || [];

    // 프론트에서 쓰기 쉬운 형태로 정규화
    const pois = rawPois
      .map((p) => {
        // frontLat/frontLon = 출입구(도로변) 좌표 → 보행자 경로 시작/끝에 적합
        // noorLat/noorLon   = 중심 좌표 (폴백)
        const lat = parseFloat(p.frontLat || p.noorLat);
        const lon = parseFloat(p.frontLon || p.noorLon);
        if (!isFinite(lat) || !isFinite(lon)) return null;
        const addr = [p.upperAddrName, p.middleAddrName, p.lowerAddrName, p.roadName]
          .filter(Boolean)
          .join(' ');
        return {
          id: p.id || `${lat},${lon}`,
          name: p.name || '이름 없음',
          lat,
          lon,
          address: addr,
          category: p.lowerBizName || p.middleBizName || p.upperBizName || '',
        };
      })
      .filter(Boolean);

    return Response.json({ count: pois.length, pois });
  } catch (e) {
    return Response.json({ error: 'TMap POI 검색 중 오류', detail: String(e) }, { status: 502 });
  }
}
