// TMap 보행자 경로안내 프록시 (서버 사이드)
// - 순서가 있는 POI 좌표 목록을 받아 실제 도보 경로(도로/보행로 기반)로 연결한다.
// - TMap 보행자 API 는 경유지(passList)를 한 번에 최대 5개까지만 받으므로,
//   핀이 그보다 많으면 구간을 나눠(chunk) 호출한 뒤 좌표를 이어붙인다.
//
// 요청(body): { points: [{ lat, lon, name }] }  (2개 이상)
// 응답: { coords: [[lat, lon], ...], distance: <미터>, time: <초> }

const TMAP_KEY = process.env.TMAP_API_KEY || process.env.NEXT_PUBLIC_TMAP_API_KEY;
const PED_ENDPOINT = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';

// 한 요청당 최대 지점 수 = 출발 1 + 경유지(passList) 5 + 도착 1 = 7
const MAX_POINTS_PER_REQ = 7;

function chunkPoints(points) {
  // 각 chunk 는 이전 chunk 의 마지막 지점에서 이어지도록 1개 겹치게 나눈다.
  const chunks = [];
  let i = 0;
  const last = points.length - 1;
  while (i < last) {
    const endIdx = Math.min(i + MAX_POINTS_PER_REQ - 1, last);
    chunks.push(points.slice(i, endIdx + 1));
    i = endIdx;
  }
  return chunks;
}

async function routeChunk(chunk) {
  const start = chunk[0];
  const end = chunk[chunk.length - 1];
  const mids = chunk.slice(1, -1); // 경유지 (최대 5)

  const body = {
    startX: String(start.lon),
    startY: String(start.lat),
    endX: String(end.lon),
    endY: String(end.lat),
    // TMap 은 startName/endName 을 URL 인코딩된 문자열로 요구한다. (빈 값 불가)
    startName: encodeURIComponent(start.name || '출발'),
    endName: encodeURIComponent(end.name || '도착'),
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    startTime: '',
    searchOption: '0', // 0=추천, 4=최단
    sort: 'index',
  };
  if (mids.length > 0) {
    body.passList = mids.map((p) => `${p.lon},${p.lat}`).join('_');
  }

  const res = await fetch(PED_ENDPOINT, {
    method: 'POST',
    headers: {
      appKey: TMAP_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`보행자 경로 실패 (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const features = data?.features || [];

  const coords = []; // [lat, lon]
  const guides = []; // 턴바이턴 음성 안내점
  let distance = 0;
  let time = 0;

  for (const f of features) {
    const props = f?.properties || {};
    // 요약 정보는 Point(index 0) properties 에 담겨 있다.
    if (props.totalDistance != null) distance = Number(props.totalDistance) || distance;
    if (props.totalTime != null) time = Number(props.totalTime) || time;

    if (f?.geometry?.type === 'Point') {
      // description 예: "70m 앞에서 좌회전", "횡단보도 이후 직진", "도착"
      const desc = (props.description || '').trim();
      if (desc) {
        const [lon, lat] = f.geometry.coordinates;
        guides.push({
          lat, lon,
          description: desc,
          turnType: props.turnType ?? null, // 11직진 12좌 13우 ... 200출발 201도착
          pointIndex: props.pointIndex ?? null,
        });
      }
    } else if (f?.geometry?.type === 'LineString') {
      for (const [lon, lat] of f.geometry.coordinates) {
        coords.push([lat, lon]);
      }
    }
  }
  return { coords, guides, distance, time };
}

export async function POST(request) {
  if (!TMAP_KEY) {
    return Response.json({ error: 'TMAP_API_KEY 가 설정되지 않았습니다.' }, { status: 500 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: '잘못된 JSON 요청' }, { status: 400 });
  }

  const points = Array.isArray(payload?.points) ? payload.points : [];
  if (points.length < 2) {
    return Response.json({ error: '최소 2개의 지점이 필요합니다.' }, { status: 400 });
  }

  try {
    const chunks = chunkPoints(points);
    const results = [];
    for (const c of chunks) {
      results.push(await routeChunk(c));
    }

    // 좌표 이어붙이기 (chunk 경계의 중복점 제거)
    const coords = [];
    const guides = [];
    let distance = 0;
    let time = 0;
    for (const r of results) {
      distance += r.distance;
      time += r.time;
      for (const pt of r.coords) {
        const prev = coords[coords.length - 1];
        if (prev && prev[0] === pt[0] && prev[1] === pt[1]) continue;
        coords.push(pt);
      }
      for (const g of r.guides) guides.push(g);
    }

    // 각 안내점을 병합 경로상의 가장 가까운 좌표 인덱스에 매핑
    // (시뮬레이션 진행 인덱스가 이 값을 지나면 음성 안내 트리거)
    for (const g of guides) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < coords.length; i++) {
        const dLat = coords[i][0] - g.lat;
        const dLon = coords[i][1] - g.lon;
        const d = dLat * dLat + dLon * dLon;
        if (d < bestD) { bestD = d; best = i; }
      }
      g.coordIndex = best;
    }
    guides.sort((a, b) => a.coordIndex - b.coordIndex);

    return Response.json({
      coords,
      guides, // [{ lat, lon, description, turnType, coordIndex }]
      distance, // 미터
      time, // 초
      distanceKm: Math.round((distance / 1000) * 100) / 100,
      requests: chunks.length,
    });
  } catch (e) {
    return Response.json({ error: '보행자 경로 계산 중 오류', detail: String(e?.message || e) }, { status: 502 });
  }
}
