'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import './styles.css';

// 추천(프리셋) 코스 — 실제 체크포인트 좌표. 선택 시 보행자 경로 API 로
// 실제 도로/보행로를 따라 연결되어 그려진다. (임의 직선 좌표 아님)
const COURSES = {
  yeouido8k: {
    name: '여의도 8K 오픈런',
    emoji: '🏃',
    color: '#ff4b72',
    zoom: 14,
    // Seoul Runners Festival 8K 오픈런 코스 (여의나루역 출발/도착, 1K~7K 체크포인트)
    checkpoints: [
      { label: 'S', name: '여의나루역 이벤트광장', lat: 37.5268, lon: 126.9330 },
      { label: '1K', name: '서강대교남단 공영주차장', lat: 37.5330, lon: 126.9235 },
      { label: '2K', name: '국회의사당 둔치 주차장', lat: 37.5340, lon: 126.9175 },
      { label: '3K', name: '당산동-샛강생태공원 보행육교', lat: 37.5268, lon: 126.9088 },
      { label: '4K', name: '서울교', lat: 37.5205, lon: 126.9118 },
      { label: '5K', name: '전망마루', lat: 37.5176, lon: 126.9205 },
      { label: '6K', name: '여의도 제5주차장 건너편', lat: 37.5162, lon: 126.9288 },
      { label: '7K', name: '민속놀이마당', lat: 37.5235, lon: 126.9385 },
      { label: 'F', name: '여의나루역 이벤트광장', lat: 37.5268, lon: 126.9330 },
    ],
  },
  gwanghwamun: {
    name: '광화문·경복궁 코스',
    emoji: '🏯',
    color: '#34d399',
    zoom: 15,
    checkpoints: [
      { label: 'S', name: '광화문광장', lat: 37.5724, lon: 126.9768 },
      { label: '1', name: '경복궁 광화문', lat: 37.5760, lon: 126.9769 },
      { label: '2', name: '국립고궁박물관', lat: 37.5757, lon: 126.9749 },
      { label: '3', name: '경복궁 영추문', lat: 37.5787, lon: 126.9742 },
      { label: '4', name: '삼청동 초입', lat: 37.5810, lon: 126.9812 },
      { label: 'F', name: '광화문광장', lat: 37.5724, lon: 126.9768 },
    ],
  },
};

// 실제 유명 장소(빠른 추가용) — 실제 좌표. POI 검색 활성화 전에도 "장소 기반" 체험 제공.
// 모두 보행자 경로 API 로 라우팅 검증된 좌표.
const SEED_POIS = [
  { id: 'seed-yeouido-hangang', name: '여의도한강공원', emoji: '🌊', lat: 37.5275, lon: 126.9327 },
  { id: 'seed-yeouido-park', name: '여의도공원', emoji: '🌳', lat: 37.5265, lon: 126.9243 },
  { id: 'seed-assembly', name: '국회의사당', emoji: '🏛️', lat: 37.5323, lon: 126.9142 },
  { id: 'seed-seoulforest', name: '서울숲', emoji: '🌲', lat: 37.5443, lon: 127.0374 },
  { id: 'seed-seongsu', name: '성수카페거리', emoji: '☕', lat: 37.5479, lon: 127.0446 },
  { id: 'seed-gyeongbok', name: '경복궁', emoji: '🏯', lat: 37.5796, lon: 126.9770 },
  { id: 'seed-gwanghwamun', name: '광화문광장', emoji: '🏙️', lat: 37.5720, lon: 126.9769 },
];

const BOT_NAMES = ['페이서', '치타', '코멧', '제트', '하루'];
const BOT_COLORS = ['#ff4b72', '#22d3ee', '#ff8fa8', '#94a3b8', '#cbd5e1'];
const BOT_EMOJIS = ['⚡', '🐆', '☄️', '🚀', '🌙'];

function buildBots() {
  return BOT_NAMES.map((name, i) => ({
    name, color: BOT_COLORS[i % BOT_COLORS.length], emoji: BOT_EMOJIS[i],
    speed: 0.7 + Math.random() * 0.6, surge: 0, progress: 0,
  }));
}

// TMap v2 지도 클릭 이벤트에서 위/경도 추출 (SDK 버전별 형태 방어적 처리)
function extractLatLon(evt) {
  const src = evt?.latLng || evt?.lonLat || evt?.data?.lngLat || evt?.position || evt;
  if (!src) return null;
  const lat = typeof src.lat === 'function' ? src.lat() : (src._lat ?? src.lat ?? src.y ?? src._y);
  const lon = typeof src.lng === 'function' ? src.lng()
    : (src._lng ?? src.lng ?? src.lon ?? src.longitude ?? src.x ?? src._x);
  const nlat = Number(lat), nlon = Number(lon);
  if (!isFinite(nlat) || !isFinite(nlon)) return null;
  // 대한민국 범위 밖이면 무시 (EPSG3857 미터좌표 등 오파싱 방지)
  if (nlat < 33 || nlat > 39 || nlon < 124 || nlon > 132) return null;
  return { lat: nlat, lon: nlon };
}

function pointAtProgress(course, pct) {
  const path = course.path;
  if (!path || path.length < 2) return path ? path[0] : [37.5665, 126.978];
  const totalSeg = path.length - 1;
  const exact = (pct / 100) * totalSeg;
  const idx = Math.min(Math.floor(exact), totalSeg - 1);
  const frac = exact - idx;
  const a = path[idx], b = path[idx + 1];
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
}

export default function RunCraftPage() {
  const [showLobby, setShowLobby] = useState(true);
  const [roomCode, setRoomCode] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [lobbyToastMsg, setLobbyToastMsg] = useState('');
  const [lobbyToastShow, setLobbyToastShow] = useState(false);
  const [courseKey, setCourseKey] = useState(null);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [bots, setBots] = useState([]);
  const [toasts, setToasts] = useState([]);

  // ----- 커스텀 코스(POI + 실제 도보경로) 상태 -----
  const [mode, setMode] = useState('preset'); // 'preset' | 'custom'
  const [poiQuery, setPoiQuery] = useState('');
  const [poiResults, setPoiResults] = useState([]);
  const [poiSearching, setPoiSearching] = useState(false);
  const [poiError, setPoiError] = useState('');
  const [pins, setPins] = useState([]);           // 선택한 POI/지점 (순서 = 경유 순서)
  const [buildingRoute, setBuildingRoute] = useState(false);
  const [loopCourse, setLoopCourse] = useState(true); // 출발지로 복귀(순환)
  const [customMeta, setCustomMeta] = useState(null); // { distance, requests }
  const [resolvingCourse, setResolvingCourse] = useState(false); // 프리셋 실경로 로딩중

  // ----- 음성 길안내(TMap 턴바이턴 → Web Speech) -----
  const [voiceOn, setVoiceOn] = useState(true);
  const [currentGuide, setCurrentGuide] = useState(''); // 화면에 표시할 현재 안내
  const voiceOnRef = useRef(true);
  const spokenGuidesRef = useRef(new Set());
  const lastKmRef = useRef(0);

  const moveTimerRef = useRef(null);
  const clockTimerRef = useRef(null);
  const lobbyToastTimerRef = useRef(null);
  const progressRef = useRef(0);
  const elapsedRef = useRef(0);
  const botsRef = useRef([]);
  const courseKeyRef = useRef(null);
  const runningRef = useRef(false);
  const mapRef = useRef(null);
  const mapDivRef = useRef(null);
  const polylineRef = useRef(null);
  const myMarkerRef = useRef(null);
  const botMarkersRef = useRef([]);
  const cpMarkersRef = useRef([]);

  const customCourseRef = useRef(null); // 빌드된 커스텀 코스 객체
  const resolvedCoursesRef = useRef({}); // 프리셋 key → 실제 경로로 해석된 코스 캐시
  const pinsRef = useRef([]);
  const pinMarkersRef = useRef([]);     // 빌드 전 미리보기 핀 마커
  const previewLineRef = useRef(null);  // 빌드 전 직선 미리보기
  const modeRef = useRef('preset');

  const resolveCourse = useCallback(
    (key) => (key === 'custom' ? customCourseRef.current : resolvedCoursesRef.current[key]),
    [],
  );

  // ---- 음성 안내 ----
  const speak = useCallback((text) => {
    setCurrentGuide(text);
    if (!voiceOnRef.current) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = 1.08;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }, []);

  const resetGuides = useCallback(() => {
    spokenGuidesRef.current = new Set();
    lastKmRef.current = 0;
    setCurrentGuide('');
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
  }, []);

  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);

  const showToast = useCallback((message, type) => {
    const id = Date.now() + Math.random();
    const icons = { success: '✅ ', info: 'ℹ️ ', warning: '⚠️ ', error: ' ' };
    setToasts(prev => [...prev, { id, message, type, icon: icons[type] || 'ℹ️ ' }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 3200);
  }, []);

  const lobbyMsg = useCallback((msg) => {
    setLobbyToastMsg(msg);
    setLobbyToastShow(true);
    if (lobbyToastTimerRef.current) clearTimeout(lobbyToastTimerRef.current);
    lobbyToastTimerRef.current = setTimeout(() => setLobbyToastShow(false), 2400);
  }, []);

  const genRoomCode = () => '#' + Math.floor(1000 + Math.random() * 9000);

  const enterRoom = useCallback((code) => {
    setRoomCode(code);
    setShowLobby(false);
    showToast('룸 ' + code + ' 입장 완료! 코스를 선택하세요.', 'success');
  }, [showToast]);

  const handleCreateRoom = () => {
    const code = genRoomCode();
    lobbyMsg('룸 생성 중… ' + code);
    setTimeout(() => enterRoom(code), 600);
  };

  const handleJoinRoom = () => {
    let v = (inputCode || '').trim();
    if (!v) { lobbyMsg('방 코드를 입력해주세요!'); return; }
    if (!v.startsWith('#')) v = '#' + v;
    lobbyMsg('입장 중… ' + v);
    setTimeout(() => enterRoom(v), 500);
  };

  const handleLeaveRoom = () => {
    stopRun();
    setRoomCode(null);
    setCourseKey(null);
    courseKeyRef.current = null;
    setShowLobby(true);
    setInputCode('');
    setLobbyToastMsg('');
  };

  // TMap 지도 초기화
  useEffect(() => {
    if (showLobby) return;
    if (!mapDivRef.current || mapRef.current) return;
    if (typeof window === 'undefined' || !window.Tmapv2) {
      console.warn('[RunCraft] Tmapv2 객체가 아직 로드되지 않았습니다.');
      return;
    }

    try {
      const map = new window.Tmapv2.Map(mapDivRef.current, {
        center: new window.Tmapv2.LatLng(37.5190, 126.9230),
        width: '100%',
        height: '100%',
        zoom: 13,
        httpsMode: true,
      });
      map.setMapType(window.Tmapv2.Map.MapType.ROAD);
      mapRef.current = map;

      // 지도 클릭 → 커스텀 모드일 때 핀 추가 (현재 appKey 로 즉시 동작)
      // 역지오코딩으로 실제 장소/주소 이름을 붙인다.
      map.addListener('click', (evt) => {
        if (modeRef.current !== 'custom') return;
        const c = extractLatLon(evt);
        if (!c) { console.warn('[RunCraft] 클릭 좌표 파싱 실패', evt); return; }
        const id = `map-${c.lat.toFixed(5)}-${c.lon.toFixed(5)}`;
        const fallbackName = `지점 ${pinsRef.current.length + 1}`;
        addPin({ id, name: fallbackName, lat: c.lat, lon: c.lon });
        // 실제 주소로 이름 갱신 (비동기)
        fetch(`/api/tmap/reversegeocode?lat=${c.lat}&lon=${c.lon}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d && d.name) {
              const list = pinsRef.current.map(p => (p.id === id ? { ...p, name: d.name } : p));
              pinsRef.current = list;
              setPins(list);
            }
          })
          .catch(() => {});
      });

      console.info('[RunCraft] TMap 지도 초기화 성공');
    } catch (e) {
      console.error('[RunCraft] TMap 초기화 실패:', e);
      showToast('TMap 지도 초기화 실패: ' + e.message, 'error');
    }

    return () => {
      if (mapRef.current) {
        try { mapRef.current.destroy && mapRef.current.destroy(); } catch (_) {}
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLobby, showToast]);

  useEffect(() => {
    modeRef.current = mode;
    // 커스텀 모드로 돌아오면 기존 핀 미리보기 복원
    if (mode === 'custom' && pinsRef.current.length && !runningRef.current) renderPinPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const clearMapObjects = useCallback(() => {
    if (!mapRef.current) return;
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (myMarkerRef.current) { myMarkerRef.current.setMap(null); myMarkerRef.current = null; }
    botMarkersRef.current.forEach(m => { if (m) m.setMap(null); });
    botMarkersRef.current = [];
    cpMarkersRef.current.forEach(m => { if (m) m.setMap(null); });
    cpMarkersRef.current = [];
  }, []);

  const drawCourseOnMap = useCallback(() => {
    if (!mapRef.current || !window.Tmapv2) return;
    const course = resolveCourse(courseKeyRef.current);
    if (!course) return;

    clearMapObjects();
    clearPinPreview();

    const Tmapv2 = window.Tmapv2;
    mapRef.current.setCenter(new Tmapv2.LatLng(course.center[0], course.center[1]));
    mapRef.current.setZoom(course.zoom);

    // 폴리라인: 실제 도로/보행로 경로 그대로 (닫힌 루프면 시작점 복귀)
    const isClosed = course.closed === true;
    const linePts = isClosed ? [...course.path, course.path[0]] : course.path;
    const latlngs = linePts.map(p => new Tmapv2.LatLng(p[0], p[1]));
    polylineRef.current = new Tmapv2.Polyline({
      path: latlngs,
      strokeColor: '#ff4b72', // 코스 폴리라인은 항상 프리미엄 핑크 (course.color 는 마커 액센트용)
      strokeWeight: 4,
      strokeOpacity: 0.85,
      map: mapRef.current,
    });

    // 체크포인트 마커 (라벨 + 장소명) — 미니멀 글래스 핀
    const markers = course.markers || [];
    markers.forEach((m) => {
      const border = m.kind === 'start' ? '#34d399' : m.kind === 'end' ? '#ff4b72' : (course.color || '#ff4b72');
      const labelHTML =
        '<span style="font-family:Inter,Pretendard,sans-serif;font-weight:800;font-size:11px;letter-spacing:-0.02em;color:' + border + ';">' + m.label + '</span>';
      const nameHTML = m.name
        ? '<span style="font-size:10px;color:#f1f5f9;margin-left:5px;font-weight:500;">' + m.name + '</span>'
        : '';
      const iconHTML =
        '<div style="background:rgba(11,15,25,0.92);padding:5px 10px;border-radius:999px;border:1px solid ' + border + ';' +
        'box-shadow:0 6px 16px -6px rgba(0,0,0,0.6);white-space:nowrap;transform:translate(-50%,-50%);display:flex;align-items:center;">' +
        labelHTML + nameHTML + '</div>';
      cpMarkersRef.current.push(new Tmapv2.Marker({
        position: new Tmapv2.LatLng(m.lat, m.lon), iconHTML, map: mapRef.current,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearMapObjects, resolveCourse]);

  // ---------- 커스텀: 핀 미리보기 ----------
  const clearPinPreview = () => {
    pinMarkersRef.current.forEach(m => { if (m) m.setMap(null); });
    pinMarkersRef.current = [];
    if (previewLineRef.current) { previewLineRef.current.setMap(null); previewLineRef.current = null; }
  };

  const renderPinPreview = () => {
    if (!mapRef.current || !window.Tmapv2) return;
    clearPinPreview();
    const Tmapv2 = window.Tmapv2;
    const list = pinsRef.current;
    list.forEach((p, i) => {
      const iconHTML =
        '<div style="background:#0b0f19;color:#062018;font-weight:800;font-size:12px;width:24px;height:24px;' +
        'display:flex;align-items:center;justify-content:center;border-radius:50%;background:#34d399;border:2px solid #0b0f19;' +
        'box-shadow:0 4px 12px -4px rgba(0,0,0,0.6);transform:translate(-50%,-50%);">' + (i + 1) + '</div>';
      pinMarkersRef.current.push(new Tmapv2.Marker({
        position: new Tmapv2.LatLng(p.lat, p.lon), iconHTML, map: mapRef.current,
      }));
    });
    if (list.length >= 2) {
      previewLineRef.current = new Tmapv2.Polyline({
        path: list.map(p => new Tmapv2.LatLng(p.lat, p.lon)),
        strokeColor: '#34d399', strokeWeight: 3, strokeOpacity: 0.6, strokeStyle: 'dash',
        map: mapRef.current,
      });
    }
  };

  const addPin = (pin) => {
    const next = [...pinsRef.current, pin];
    pinsRef.current = next;
    setPins(next);
    renderPinPreview();
    if (mapRef.current && window.Tmapv2) {
      mapRef.current.setCenter(new window.Tmapv2.LatLng(pin.lat, pin.lon));
    }
    showToast('핀 추가: ' + pin.name, 'info');
  };

  const removePin = (idx) => {
    const next = pinsRef.current.filter((_, i) => i !== idx);
    pinsRef.current = next;
    setPins(next);
    renderPinPreview();
  };

  const movePin = (idx, dir) => {
    const next = [...pinsRef.current];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    pinsRef.current = next;
    setPins(next);
    renderPinPreview();
  };

  const clearPins = () => {
    pinsRef.current = [];
    setPins([]);
    setCustomMeta(null);
    clearPinPreview();
  };

  // ---------- 커스텀: POI 검색 ----------
  const searchPoi = async () => {
    const kw = (poiQuery || '').trim();
    if (!kw) { showToast('검색어를 입력하세요.', 'warning'); return; }
    setPoiSearching(true);
    setPoiError('');
    setPoiResults([]);
    try {
      const center = mapRef.current ? mapRef.current.getCenter() : null;
      const params = new URLSearchParams({ keyword: kw, count: '12' });
      if (center) {
        const clat = typeof center.lat === 'function' ? center.lat() : center._lat;
        const clon = typeof center.lng === 'function' ? center.lng() : center._lng;
        if (isFinite(clat) && isFinite(clon)) {
          params.set('centerLat', String(clat));
          params.set('centerLon', String(clon));
          params.set('radius', '10');
        }
      }
      const res = await fetch('/api/tmap/poi?' + params.toString());
      const data = await res.json();
      if (!res.ok) {
        setPoiError(data.message || data.error || 'POI 검색 실패');
        return;
      }
      setPoiResults(data.pois || []);
      if (!data.pois || data.pois.length === 0) showToast('검색 결과가 없습니다.', 'info');
    } catch (e) {
      setPoiError('네트워크 오류: ' + String(e));
    } finally {
      setPoiSearching(false);
    }
  };

  // ---------- 커스텀: 실제 도보 경로로 코스 생성 ----------
  const buildRoute = async () => {
    const list = pinsRef.current;
    if (list.length < 2) { showToast('핀을 2개 이상 추가하세요.', 'warning'); return; }
    if (runningRef.current) { showToast('러닝 중에는 코스를 만들 수 없습니다.', 'warning'); return; }

    setBuildingRoute(true);
    try {
      const points = list.map(p => ({ lat: p.lat, lon: p.lon, name: p.name }));
      if (loopCourse) points.push({ lat: list[0].lat, lon: list[0].lon, name: list[0].name }); // 출발지 복귀

      const res = await fetch('/api/tmap/pedestrian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('경로 생성 실패: ' + (data.detail || data.error || res.status), 'error');
        return;
      }
      if (!data.coords || data.coords.length < 2) {
        showToast('경로 좌표를 받지 못했습니다.', 'error');
        return;
      }

      const lats = data.coords.map(c => c[0]);
      const lons = data.coords.map(c => c[1]);
      const center = [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lons) + Math.max(...lons)) / 2,
      ];

      const markers = list.map((p, i) => ({
        lat: p.lat, lon: p.lon, name: p.name, label: String(i + 1),
        kind: i === 0 ? 'start' : (i === list.length - 1 && !loopCourse ? 'end' : 'mid'),
      }));

      customCourseRef.current = {
        name: '커스텀 코스',
        emoji: '🧭',
        center,
        zoom: 15,
        distance: data.distanceKm || Math.round((data.distance / 1000) * 100) / 100,
        color: '#34d399',
        path: data.coords,          // 실제 도로/보행로 좌표
        guides: data.guides || [],  // 턴바이턴 음성 안내
        markers,                    // 체크포인트 마커
        pins: [...list],
        closed: false,
      };
      setCustomMeta({ distance: customCourseRef.current.distance, requests: data.requests });

      // 코스 선택 흐름 재사용
      setCourseKey('custom');
      courseKeyRef.current = 'custom';
      setProgress(0); progressRef.current = 0;
      setElapsed(0); elapsedRef.current = 0;
      resetGuides();
      const newBots = buildBots();
      setBots(newBots); botsRef.current = newBots;
      setTimeout(() => drawCourseOnMap(), 100);
      showToast('실제 도보 경로 코스 생성! 총 ' + customCourseRef.current.distance + 'km', 'success');
    } catch (e) {
      showToast('경로 생성 오류: ' + String(e), 'error');
    } finally {
      setBuildingRoute(false);
    }
  };

  // 프리셋 체크포인트 → 실제 보행자 도로 경로로 해석
  const buildResolvedCourse = async (def) => {
    const points = def.checkpoints.map(c => ({ lat: c.lat, lon: c.lon, name: c.name }));
    const res = await fetch('/api/tmap/pedestrian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    });
    const data = await res.json();
    if (!res.ok || !data.coords || data.coords.length < 2) {
      throw new Error(data.detail || data.error || '경로를 불러오지 못했습니다.');
    }
    const lats = data.coords.map(c => c[0]);
    const lons = data.coords.map(c => c[1]);
    const center = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lons) + Math.max(...lons)) / 2,
    ];
    const cps = def.checkpoints;
    const loop = cps.length > 1 && cps[cps.length - 1].lat === cps[0].lat && cps[cps.length - 1].lon === cps[0].lon;
    const used = loop ? cps.slice(0, -1) : cps;
    const markers = used.map((c, i) => ({
      lat: c.lat, lon: c.lon, name: c.name,
      label: (i === 0 && loop) ? 'S·F' : c.label,
      kind: i === 0 ? 'start' : (i === used.length - 1 && !loop ? 'end' : 'mid'),
    }));
    return {
      name: def.name, emoji: def.emoji, color: def.color, zoom: def.zoom,
      center, distance: data.distanceKm,
      path: data.coords, guides: data.guides || [], markers,
      checkpoints: cps, closed: false,
    };
  };

  const selectCourse = async (key) => {
    if (runningRef.current) { showToast('러닝 중에는 코스를 변경할 수 없습니다.', 'warning'); return; }

    let course = resolveCourse(key);
    if (!course) {
      const def = COURSES[key];
      if (!def) return;
      setResolvingCourse(true);
      showToast(def.name + ' 실제 도로 경로 불러오는 중…', 'info');
      try {
        course = await buildResolvedCourse(def);
        resolvedCoursesRef.current[key] = course;
      } catch (e) {
        showToast('경로 불러오기 실패: ' + String(e.message || e), 'error');
        setResolvingCourse(false);
        return;
      }
      setResolvingCourse(false);
    }

    setCourseKey(key);
    courseKeyRef.current = key;
    setProgress(0);
    progressRef.current = 0;
    setElapsed(0);
    elapsedRef.current = 0;
    resetGuides();
    const newBots = buildBots();
    setBots(newBots);
    botsRef.current = newBots;
    showToast(course.name + ' 코스 준비 완료! (총 ' + course.distance + 'km · 실제 도로 경로)', 'success');

    setTimeout(() => drawCourseOnMap(), 300);
  };

  const tickSimulation = () => {
    const course = resolveCourse(courseKeyRef.current);
    if (!course) return;
    const mySpeedPerSec = 100 / 70;
    progressRef.current += mySpeedPerSec * 0.2;
    if (progressRef.current > 100) progressRef.current = 100;

    const updatedBots = botsRef.current.map(bot => {
      let surge = bot.surge;
      if (Math.random() < 0.05) surge = 1 + Math.random() * 1.5;
      const surgeBoost = surge > 0 ? surge : 0;
      surge *= 0.7;
      let botProgress = bot.progress + (bot.speed + surgeBoost) * 0.2;
      if (botProgress > 100) botProgress = 100;
      return { ...bot, surge, progress: botProgress };
    });
    botsRef.current = updatedBots;
    setBots(updatedBots);
    setProgress(progressRef.current);

    // ---- 음성 길안내: 지나온 안내점 발화 + KM 지점 통과 안내 ----
    const path = course.path;
    if (path && path.length > 1) {
      const curIdx = Math.floor((progressRef.current / 100) * (path.length - 1));

      // KM 지점 통과 (체크포인트 이름 포함)
      const curKm = Math.floor((course.distance || 0) * progressRef.current / 100);
      if (curKm > lastKmRef.current) {
        lastKmRef.current = curKm;
        const cp = (course.markers || []).find(m => m.label === curKm + 'K');
        speak(curKm + '킬로미터 지점' + (cp && cp.name ? ', ' + cp.name + ' 통과' : ' 통과'));
      }

      // 턴바이턴: 지나온 안내점 중 아직 발화 안 한 것 (회전/횡단보도 위주)
      if (course.guides && course.guides.length) {
        for (const g of course.guides) {
          if (g.coordIndex <= curIdx && !spokenGuidesRef.current.has(g.coordIndex)) {
            spokenGuidesRef.current.add(g.coordIndex);
            const isTurn = /회전|횡단보도|방향/.test(g.description);
            const canSpeak = typeof window !== 'undefined' && window.speechSynthesis && !window.speechSynthesis.speaking;
            if (isTurn && canSpeak) speak(g.description);
          }
        }
      }
    }

    if (mapRef.current && window.Tmapv2) {
      const Tmapv2 = window.Tmapv2;
      const pt = pointAtProgress(course, progressRef.current);
      const myLL = new Tmapv2.LatLng(pt[0], pt[1]);
      if (myMarkerRef.current) {
        myMarkerRef.current.setPosition(myLL);
        mapRef.current.setCenter(myLL);
      }
      botMarkersRef.current.forEach((marker, i) => {
        if (marker && botsRef.current[i]) {
          const bpt = pointAtProgress(course, botsRef.current[i].progress);
          marker.setPosition(new Tmapv2.LatLng(bpt[0], bpt[1]));
        }
      });
    }

    if (progressRef.current >= 100) finishRun();
  };

  const finishRun = () => {
    runningRef.current = false;
    setRunning(false);
    if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    if (clockTimerRef.current) clearInterval(clockTimerRef.current);
    moveTimerRef.current = null;
    clockTimerRef.current = null;
    progressRef.current = 100;
    setProgress(100);

    const entries = [
      { name: 'ME (나)', progress: progressRef.current },
      ...botsRef.current.map(b => ({ name: b.name, progress: b.progress })),
    ];
    entries.sort((a, b) => b.progress - a.progress);
    const rank = entries.findIndex(e => e.name === 'ME (나)') + 1;
    const m = String(Math.floor(elapsedRef.current / 60)).padStart(2, '0');
    const s = String(elapsedRef.current % 60).padStart(2, '0');
    showToast('완주! 기록 ' + m + ':' + s + ' · 최종 순위 ' + rank + '위 🏆', 'success');
    speak('목적지에 도착했습니다. 완주를 축하합니다. 최종 순위 ' + rank + '위입니다.');
  };

  const stopRun = () => {
    if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    if (clockTimerRef.current) clearInterval(clockTimerRef.current);
    moveTimerRef.current = null;
    clockTimerRef.current = null;
    runningRef.current = false;
    setRunning(false);
  };

  const startRun = () => {
    if (!courseKeyRef.current) { showToast('먼저 코스를 선택하세요!', 'warning'); return; }
    if (runningRef.current) { showToast('이미 러닝 중입니다!', 'warning'); return; }
    if (!mapRef.current || !window.Tmapv2) { showToast('지도가 아직 로드되지 않았습니다.', 'warning'); return; }

    runningRef.current = true;
    setRunning(true);
    progressRef.current = 0;
    elapsedRef.current = 0;
    resetGuides();
    showToast('가상 러닝 시작! 봇들과 경쟁하세요! 🏃', 'success');

    const Tmapv2 = window.Tmapv2;
    const course = resolveCourse(courseKeyRef.current);
    const startName = (course.markers && course.markers[0] && course.markers[0].name) || '출발지';
    speak(course.name + ' 안내를 시작합니다. ' + startName + '에서 출발합니다.');
    const start = course.path[0];
    const startLL = new Tmapv2.LatLng(start[0], start[1]);

    if (myMarkerRef.current) myMarkerRef.current.setMap(null);
    myMarkerRef.current = new Tmapv2.Marker({
      position: startLL,
      iconHTML: '<div style="width:28px;height:28px;border-radius:50%;background:#34d399;border:2px solid #0b0f19;' +
        'box-shadow:0 4px 12px -3px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;' +
        'font-size:15px;transform:translate(-50%,-50%);">🏃</div>',
      map: mapRef.current,
    });

    botMarkersRef.current.forEach(m => { if (m) m.setMap(null); });
    botMarkersRef.current = botsRef.current.map((bot) => {
      return new Tmapv2.Marker({
        position: startLL,
        iconHTML: '<div style="width:24px;height:24px;border-radius:50%;background:' + bot.color + ';border:2px solid #0b0f19;' +
          'box-shadow:0 3px 10px -3px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;' +
          'font-size:12px;transform:translate(-50%,-50%);">' + bot.emoji + '</div>',
        map: mapRef.current,
      });
    });

    clockTimerRef.current = setInterval(() => {
      elapsedRef.current++;
      setElapsed(elapsedRef.current);
    }, 1000);

    moveTimerRef.current = setInterval(() => {
      tickSimulation();
    }, 200);
  };

  const resetRun = () => {
    stopRun();
    progressRef.current = 0;
    elapsedRef.current = 0;
    setProgress(0);
    setElapsed(0);
    const newBots = courseKeyRef.current ? buildBots() : [];
    botsRef.current = newBots;
    setBots(newBots);
    setRunning(false);
    clearMapObjects();
    drawCourseOnMap();
    showToast('시뮬레이션이 초기화되었습니다.', 'info');
  };

  useEffect(() => {
    return () => {
      if (moveTimerRef.current) clearInterval(moveTimerRef.current);
      if (clockTimerRef.current) clearInterval(clockTimerRef.current);
      if (lobbyToastTimerRef.current) clearTimeout(lobbyToastTimerRef.current);
    };
  }, []);

  const leaderboardData = [
    { name: 'ME (나)', color: '#34d399', emoji: '🏃', progress, isMe: true },
    ...bots.map(b => ({ name: b.name, color: b.color, emoji: b.emoji, progress: b.progress, isMe: false })),
  ];
  leaderboardData.sort((a, b) => b.progress - a.progress);
  const leaderName = leaderboardData[0] && leaderboardData[0].progress > 0 ? leaderboardData[0].name : null;

  const currentCourse = courseKey ? resolveCourse(courseKey) : null;
  const myDist = currentCourse ? (currentCourse.distance * progress / 100).toFixed(2) : '0.00';
  const timeStr = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');

  return (
    <div className="runcraft-app">
      {showLobby && (
        <div className="landing">
          <nav className="landing-nav">
            <div className="landing-brand">RUN<span>CRAFT</span></div>
            <div className="landing-nav-actions">
              <Link href="/" className="back-btn">← 홈</Link>
              <button
                className="btn-neon btn-neon-pink"
                style={{ padding: '9px 18px', fontSize: '13px' }}
                onClick={handleCreateRoom}
              >
                룸 만들기
              </button>
            </div>
          </nav>

          <div className="landing-inner">
            {/* ---------- 히어로 ---------- */}
            <section className="hero">
              <div className="hero-copy">
                <div className="hero-eyebrow"><span className="dot" /> TMap 실지도 기반 · 러닝 시뮬레이터</div>
                <h1 className="hero-title">
                  진짜 서울 위를<br />
                  <span className="accent">달리는 감각.</span>
                </h1>
                <p className="hero-lead">
                  실제 도로와 보행로를 그대로 그린 코스에서 <b>턴바이턴 음성 안내</b>를 들으며 달립니다.
                  봇 러너들과 실시간으로 경쟁하고, 원하는 장소를 찍어 <b>나만의 코스</b>를 만드세요.
                </p>
                <div className="hero-stats">
                  <div className="hero-stat">
                    <div className="num">100<em>%</em></div>
                    <div className="lbl">실제 도로·보행로 경로</div>
                  </div>
                  <div className="hero-stat">
                    <div className="num">TMap</div>
                    <div className="lbl">턴바이턴 음성 길안내</div>
                  </div>
                  <div className="hero-stat">
                    <div className="num">POI</div>
                    <div className="lbl">장소 검색 · 커스텀 코스</div>
                  </div>
                </div>
              </div>

              {/* 히어로에 자연스럽게 녹인 룸 입장 기능 */}
              <div className="hero-entry">
                <div className="lobby-content">
                  <div className="entry-kicker">프라이빗 룸<span className="live">LIVE</span></div>
                  <p className="entry-sub">룸을 만들거나 코드로 입장해 바로 러닝을 시작하세요.</p>
                  <button className="btn-neon btn-neon-pink w-full big" onClick={handleCreateRoom}>
                    <span style={{ fontSize: '18px' }}>🚀</span> 프라이빗 룸 만들기
                  </button>
                  <div className="lobby-divider">또는</div>
                  <div className="join-row">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="방 코드 (예: #7739)"
                      value={inputCode}
                      onChange={e => setInputCode(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleJoinRoom(); }}
                    />
                    <button className="btn-neon btn-neon-cyan" onClick={handleJoinRoom}>입장</button>
                  </div>
                  <div className={`lobby-toast ${lobbyToastShow ? 'show' : ''}`}>{lobbyToastMsg}</div>
                  <div className="entry-note">회원가입 없이 즉시 플레이 · 서울 전역 실지도 지원</div>
                </div>
              </div>
            </section>

            {/* ---------- 차별점(기능) ---------- */}
            <section className="section">
              <div className="section-head">
                <div className="section-eyebrow">Why RunCraft</div>
                <h2 className="section-title">지도만 진짜인 게 아닙니다.<br />달리는 경험까지 진짜입니다.</h2>
                <p className="section-desc">
                  RunCraft는 TMap 실지도·실경로 위에 러닝 게임의 재미를 얹었습니다.
                  네 가지 핵심으로 여느 러닝 앱과 다릅니다.
                </p>
              </div>
              <div className="feature-grid">
                <div className="feature-card">
                  <div className="feature-icon">🗺️</div>
                  <h3 className="feature-title">실제 도로·보행로 경로</h3>
                  <p className="feature-text">임의의 직선이 아닙니다. TMap 보행자 경로 API로 실제 길을 따라 코스를 정확히 그립니다.</p>
                </div>
                <div className="feature-card mint">
                  <div className="feature-icon">🔊</div>
                  <h3 className="feature-title">턴바이턴 음성 길안내</h3>
                  <p className="feature-text">회전·횡단보도·킬로미터 통과를 한국어 음성으로 안내. 화면을 보지 않아도 달릴 수 있습니다.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📍</div>
                  <h3 className="feature-title">POI 커스텀 코스 빌더</h3>
                  <p className="feature-text">장소를 검색하거나 지도를 찍어 경유지를 담고, 실제 도보 경로로 나만의 코스를 완성합니다.</p>
                </div>
                <div className="feature-card mint">
                  <div className="feature-icon">🏁</div>
                  <h3 className="feature-title">실시간 봇 레이스</h3>
                  <p className="feature-text">페이스가 제각각인 러너 봇들과 실시간 리더보드로 경쟁하며 완주 순위를 다툽니다.</p>
                </div>
              </div>
            </section>

            {/* ---------- 이용 방법 ---------- */}
            <section className="section">
              <div className="section-head">
                <div className="section-eyebrow">How it works</div>
                <h2 className="section-title">3단계면 트랙 위입니다.</h2>
              </div>
              <div className="steps">
                <div className="step">
                  <div className="step-num">STEP 01</div>
                  <h3 className="step-title">룸 만들기 · 입장</h3>
                  <p className="step-text">프라이빗 룸을 만들거나 친구의 방 코드로 아레나에 입장합니다.</p>
                </div>
                <div className="step">
                  <div className="step-num">STEP 02</div>
                  <h3 className="step-title">코스 선택 · 제작</h3>
                  <p className="step-text">추천 코스를 고르거나 POI로 나만의 코스를 실제 경로로 생성합니다.</p>
                </div>
                <div className="step">
                  <div className="step-num">STEP 03</div>
                  <h3 className="step-title">가상 러닝 시작</h3>
                  <p className="step-text">음성 안내를 들으며 봇들과 경쟁하고, 실시간 리더보드로 순위를 확인합니다.</p>
                </div>
              </div>
            </section>

            {/* ---------- 추천 코스 미리보기 ---------- */}
            <section className="section">
              <div className="section-head">
                <div className="section-eyebrow">Featured courses</div>
                <h2 className="section-title">바로 달릴 수 있는 추천 코스.</h2>
              </div>
              <div className="course-preview-grid">
                <div className="preview-course">
                  <div className="preview-emoji">🏃</div>
                  <div className="preview-body">
                    <div className="preview-name">여의도 8K 오픈런</div>
                    <div className="preview-meta">S·1K~7K·F 실제 체크포인트 · 한강 순환</div>
                  </div>
                  <div className="preview-tag">실경로</div>
                </div>
                <div className="preview-course">
                  <div className="preview-emoji">🏯</div>
                  <div className="preview-body">
                    <div className="preview-name">광화문·경복궁 코스</div>
                    <div className="preview-meta">경복궁 일대 도심런 · 실제 보행로</div>
                  </div>
                  <div className="preview-tag">실경로</div>
                </div>
              </div>
            </section>

            {/* ---------- CTA ---------- */}
            <div className="landing-cta">
              <h3>지금, 서울 위를 달릴 준비됐나요?</h3>
              <p>회원가입 없이 룸 하나면 바로 시작됩니다.</p>
              <button className="btn-neon btn-neon-pink" onClick={handleCreateRoom}>
                <span style={{ fontSize: '17px' }}>🚀</span> 프라이빗 룸 만들기
              </button>
            </div>

            <footer className="landing-footer">
              <div className="brand">RUNCRAFT</div>
              <div>© 2026 MY-AI · TMap 실지도 기반 러닝 시뮬레이터</div>
            </footer>
          </div>
        </div>
      )}

      {!showLobby && (
        <div className="main-screen">
          <header className="main-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link href="/" className="back-btn">← 홈</Link>
              <div className="room-badge">룸 <span>{roomCode}</span></div>
            </div>
            <h2 className="main-title">런크래프트 아레나</h2>
            <button className="btn-ghost" onClick={handleLeaveRoom}>나가기</button>
          </header>

          <div className="main-grid">
            <aside className="panel course-panel" style={{ overflowY: 'auto' }}>
              <div className="mode-tabs">
                <button className={`mode-tab ${mode === 'preset' ? 'active' : ''}`} onClick={() => setMode('preset')}>추천 코스</button>
                <button className={`mode-tab ${mode === 'custom' ? 'active' : ''}`} onClick={() => setMode('custom')}>커스텀 (POI)</button>
              </div>

              {mode === 'preset' && (
                <>
                  <button className={`course-card ${courseKey === 'yeouido8k' ? 'active' : ''}`} onClick={() => selectCourse('yeouido8k')} disabled={resolvingCourse}>
                    <div className="course-head"><span className="course-name">🏃 여의도 8K 오픈런</span><span className="course-emoji">🏁</span></div>
                    <div className="course-meta">S·1K~7K·F 실제 체크포인트 · 실제 도로 경로</div>
                    <div className="course-bar"><div className="course-bar-fill pink"></div></div>
                  </button>
                  <button className={`course-card ${courseKey === 'gwanghwamun' ? 'active' : ''}`} onClick={() => selectCourse('gwanghwamun')} disabled={resolvingCourse}>
                    <div className="course-head"><span className="course-name">🏯 광화문·경복궁 코스</span><span className="course-emoji">👟</span></div>
                    <div className="course-meta">경복궁 일대 · 실제 보행자 도로 경로</div>
                    <div className="course-bar"><div className="course-bar-fill cyan"></div></div>
                  </button>
                  {resolvingCourse && <div className="poi-hint">⏳ 실제 도로 경로를 불러오는 중…</div>}
                </>
              )}

              {mode === 'custom' && (
                <div className="custom-builder">
                  <div className="poi-search-row">
                    <input
                      type="text"
                      placeholder="장소 검색 (예: 여의도한강공원)"
                      value={poiQuery}
                      onChange={e => setPoiQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') searchPoi(); }}
                    />
                    <button className="btn-neon btn-neon-cyan" onClick={searchPoi} disabled={poiSearching}>
                      {poiSearching ? '검색중' : '검색'}
                    </button>
                  </div>
                  <div className="poi-hint">🔎 장소 검색 · 지도 클릭 · 아래 실제 장소 칩으로 핀을 추가하세요.</div>

                  <div className="seed-chips">
                    {SEED_POIS.map((s) => (
                      <button
                        key={s.id}
                        className="seed-chip"
                        onClick={() => addPin({ id: s.id + '-' + pinsRef.current.length, name: s.name, lat: s.lat, lon: s.lon })}
                      >
                        {s.emoji} {s.name}
                      </button>
                    ))}
                  </div>

                  {poiError && <div className="poi-error">⚠️ {poiError}</div>}

                  {poiResults.length > 0 && (
                    <div className="poi-results">
                      {poiResults.map((p) => (
                        <button key={p.id} className="poi-item" onClick={() => addPin(p)}>
                          <span className="poi-name">{p.name}</span>
                          <span className="poi-addr">{p.address}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pins-header">
                    <span>선택한 핀 ({pins.length})</span>
                    {pins.length > 0 && <button className="pins-clear" onClick={clearPins}>전체삭제</button>}
                  </div>
                  <div className="pins-list">
                    {pins.length === 0 && <div className="pins-empty">아직 핀이 없습니다.</div>}
                    {pins.map((p, i) => (
                      <div key={p.id + i} className="pin-row">
                        <span className="pin-idx">{i + 1}</span>
                        <span className="pin-name">{p.name}</span>
                        <span className="pin-actions">
                          <button onClick={() => movePin(i, -1)} disabled={i === 0}>▲</button>
                          <button onClick={() => movePin(i, 1)} disabled={i === pins.length - 1}>▼</button>
                          <button onClick={() => removePin(i)}>✕</button>
                        </span>
                      </div>
                    ))}
                  </div>

                  <label className="loop-toggle">
                    <input type="checkbox" checked={loopCourse} onChange={e => setLoopCourse(e.target.checked)} />
                    출발지로 복귀 (순환 코스)
                  </label>

                  <button className="btn-neon btn-neon-cyan w-full" onClick={buildRoute} disabled={buildingRoute || pins.length < 2}>
                    {buildingRoute ? '경로 계산중…' : '🛣️ 실제 도보 경로로 코스 생성'}
                  </button>
                  {customMeta && (
                    <div className="custom-meta">✅ 생성됨 · 총 {customMeta.distance}km {customMeta.requests > 1 ? `· ${customMeta.requests}구간` : ''}</div>
                  )}
                </div>
              )}

              <div className="status-box">
                <div className="status-row"><span>선택 코스</span><span>{currentCourse ? currentCourse.emoji + ' ' + currentCourse.name : '-'}</span></div>
                <div className="status-row"><span>내 거리</span><span>{myDist} km</span></div>
                <div className="status-row"><span>진행률</span><span>{Math.round(progress)}%</span></div>
                <div className="status-row"><span>시간</span><span>{timeStr}</span></div>
              </div>
              <button className="btn-neon btn-neon-pink w-full big" onClick={startRun} disabled={running}>
                <span style={{ fontSize: '20px', marginRight: '8px' }}>🏁</span> 가상 러닝 시작
              </button>
              <button className="btn-ghost w-full" style={{ marginTop: '8px' }} onClick={resetRun}>↻ 초기화</button>
            </aside>

            <section className="panel map-panel">
              <div className="nav-bar">
                <div className="nav-guide">
                  <span className="nav-icon">🔊</span>
                  <span className="nav-text">{currentGuide || (running ? '경로 안내 중…' : 'TMap 음성 길안내 대기 중')}</span>
                </div>
                <button
                  className={`voice-toggle ${voiceOn ? 'on' : 'off'}`}
                  onClick={() => {
                    const next = !voiceOn;
                    setVoiceOn(next);
                    if (!next && typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
                    else if (next) speak('음성 안내를 켰습니다.');
                  }}
                >
                  {voiceOn ? '🔊 음성 ON' : '🔇 음성 OFF'}
                </button>
              </div>
              <div
                ref={mapDivRef}
                className="map-container"
                style={{ position: 'relative', width: '100%', height: '100%', minHeight: '420px' }}
              />
              <div className="map-hint">
                TMap 실제 지도 · 실제 도로/보행로 경로 · TMap 턴바이턴 음성 안내
              </div>
            </section>

            <aside className="panel leaderboard-panel">
              <h3 className="panel-title">▸ 실시간 리더보드</h3>
              <div className="leaderboard-list">
                {leaderboardData.map((runner, i) => (
                  <div key={i} className={`runner-row ${runner.isMe ? 'me' : ''} ${leaderName === runner.name && runner.progress > 0 ? 'leader' : ''}`}>
                    <div className="runner-head">
                      <span className="runner-name">
                        <span className="runner-avatar" style={{ background: runner.color, boxShadow: '0 2px 6px -2px rgba(0,0,0,0.5)' }}>{runner.emoji}</span>
                        {runner.name}
                      </span>
                      <span className="runner-pct">{Math.round(runner.progress)}%</span>
                    </div>
                    <div className="gauge-track"><div className="gauge-fill" style={{ width: runner.progress + '%' }}></div></div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.icon}</span><span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
