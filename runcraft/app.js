/* =========================================================
   텐텐 런크래프트 - 단독 구동형 러닝 시뮬레이터
   - 서버/통신 없이 순수 JS 변수로 룸 생성/입장 흐름 제어
   - Tmap 지도 초기화(서울 중심) 및 댕댕런/고구마런 좌표 데이터셋
   - 코스 클릭 시 Tmapv2.Polyline 네온 핑크 선 드로잉
   - [가상 러닝 시작] 시 내 마커 + 가상 친구 봇 게이지 실시간 경쟁
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
   * 1. 전역 설정 & 상태
   * ========================================================= */
  const TMAP_API_KEY = "YOUR_TMAP_API_KEY"; // ← 본인 키로 교체 (index.html script 태그도 함께)

  const state = {
    roomCode: null,
    courseKey: null,
    map: null,
    mapReady: false,
    polyline: null,
    myMarker: null,
    botMarkers: [],
    running: false,
    progress: 0,      // 내 진행률 0~100
    elapsed: 0,       // 경과 초
    moveTimerId: null,
    clockTimerId: null,
    bots: [],
  };

  /* =========================================================
   * 2. 코스 데이터셋 (댕댕런 / 고구마런)
   * ========================================================= */
  const COURSES = {
    gwanghwamun: {
      name: "광화문 댕댕런",
      emoji: "🐾",
      center: { lat: 37.5710, lng: 126.9769 },
      zoom: 15,
      distance: 2.5,
      color: "#ff00e5",
      path: [
        { lat: 37.5705, lng: 126.9768 }, // 광화문 광장
        { lat: 37.5720, lng: 126.9772 },
        { lat: 37.5735, lng: 126.9785 },
        { lat: 37.5750, lng: 126.9800 },
        { lat: 37.5765, lng: 126.9815 }, // 종점
      ],
    },
    yeouido: {
      name: "여의도 고구마런",
      emoji: "🍠",
      center: { lat: 37.5260, lng: 126.9255 },
      zoom: 15,
      distance: 3.2,
      color: "#ff00e5",
      path: [
        { lat: 37.5200, lng: 126.9200 },
        { lat: 37.5220, lng: 126.9230 },
        { lat: 37.5240, lng: 126.9260 },
        { lat: 37.5260, lng: 126.9290 },
        { lat: 37.5280, lng: 126.9310 },
        { lat: 37.5300, lng: 126.9330 },
      ],
    },
  };

  /* =========================================================
   * 3. 가상 친구 봇 데이터
   * ========================================================= */
  const BOT_NAMES = ["네온캣", "사이버독", "고구마킹", "댕댕퀸", "플라즈마"];
  const BOT_COLORS = ["#ff00e5", "#00f0ff", "#b026ff", "#fff700", "#39ff14"];
  const BOT_EMOJIS = ["🐱", "🐶", "🍠", "👑", "⚡"];

  function buildBots() {
    return BOT_NAMES.map((name, i) => ({
      name,
      color: BOT_COLORS[i % BOT_COLORS.length],
      emoji: BOT_EMOJIS[i % BOT_EMOJIS.length],
      speed: 0.7 + Math.random() * 0.6,  // 초당 진행률 증가량 (%)
      surge: 0,                           // 임시 가속
      progress: 0,
    }));
  }

  /* =========================================================
   * 4. DOM 참조
   * ========================================================= */
  const $ = (sel) => document.querySelector(sel);
  const lobby = $("#lobby");
  const main = $("#main");
  const btnCreate = $("#btn-create-room");
  const btnJoin = $("#btn-join-room");
  const inputCode = $("#input-room-code");
  const lobbyToast = $("#lobby-toast");
  const roomCodeText = $("#room-code-text");
  const btnLeave = $("#btn-leave-room");
  const courseCards = document.querySelectorAll(".course-card");
  const statCourse = $("#stat-course");
  const statMyDist = $("#stat-my-dist");
  const statProgress = $("#stat-progress");
  const statTime = $("#stat-time");
  const btnStart = $("#btn-start-run");
  const btnReset = $("#btn-reset-run");
  const leaderboard = $("#leaderboard");
  const toastContainer = $("#toast-container");
  const mapDiv = $("#map_div");

  /* =========================================================
   * 5. 로비 토스트
   * ========================================================= */
  function lobbyMsg(msg) {
    lobbyToast.textContent = msg;
    lobbyToast.classList.add("show");
    clearTimeout(lobbyMsg._t);
    lobbyMsg._t = setTimeout(() => lobbyToast.classList.remove("show"), 2400);
  }

  /* =========================================================
   * 6. 룸 생성 / 입장 흐름 (순수 JS 변수)
   * ========================================================= */
  function genRoomCode() {
    const n = Math.floor(1000 + Math.random() * 9000);
    return "#" + n;
  }

  function enterRoom(code) {
    state.roomCode = code;
    roomCodeText.textContent = code;
    lobby.classList.add("hidden");
    main.classList.remove("hidden");
    showToast(`룸 ${code} 입장 완료! 코스를 선택하세요.`, "success");
    // 맵은 메인 화면이 보인 후 초기화
    setTimeout(() => initMap(), 50);
    renderLeaderboard();
  }

  btnCreate.addEventListener("click", () => {
    const code = genRoomCode();
    lobbyMsg("룸 생성 중… " + code);
    setTimeout(() => enterRoom(code), 600);
  });

  btnJoin.addEventListener("click", () => {
    let v = (inputCode.value || "").trim();
    if (!v) {
      lobbyMsg("방 코드를 입력해주세요!");
      return;
    }
    if (!v.startsWith("#")) v = "#" + v;
    lobbyMsg("입장 중… " + v);
    setTimeout(() => enterRoom(v), 500);
  });

  inputCode.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnJoin.click();
  });

  btnLeave.addEventListener("click", () => {
    stopRun();
    state.roomCode = null;
    state.courseKey = null;
    lobby.classList.remove("hidden");
    main.classList.add("hidden");
    inputCode.value = "";
    lobbyMsg("");
  });

  /* =========================================================
   * 7. Tmap 지도 초기화 (서울 중심)
   * ========================================================= */
  function initMap() {
    if (typeof Tmapv2 === "undefined" || !TMAP_API_KEY || TMAP_API_KEY === "YOUR_TMAP_API_KEY") {
      state.mapReady = false;
      mapDiv.innerHTML =
        '<div class="tmap-fallback">' +
        "Tmap을 불러오지 못했습니다.<br/>" +
        "<code>index.html</code> 의 <code>appKey=YOUR_TMAP_API_KEY</code> 를<br/>" +
        "본인 키로 교체하면 실제 지도가 표시됩니다.<br/><br/>" +
        "UI·리더보드·시뮬레이터는 폴백 모드로 정상 작동합니다." +
        "</div>";
      console.info("[RunCraft] Tmap 폴백 모드 - UI/시뮬레이션 정상 동작");
      return;
    }

    try {
      state.map = new Tmapv2.Map("map_div", {
        center: new Tmapv2.LatLng(37.5665, 126.9780), // 서울 중심
        width: "100%",
        height: "100%",
        zoom: 12,
        zoomControl: true,
        scrollwheel: true,
      });
      state.mapReady = true;
      console.info("[RunCraft] Tmap 지도 초기화 성공");
    } catch (err) {
      state.mapReady = false;
      console.warn("[RunCraft] Tmap 초기화 실패:", err);
      mapDiv.innerHTML =
        '<div class="tmap-fallback">Tmap 초기화 중 오류가 발생했습니다.<br/>시뮬레이션은 계속 동작합니다.</div>';
    }
  }

  /* =========================================================
   * 8. 코스 선택 & 네온 핑크 Polyline 드로잉
   * ========================================================= */
  courseCards.forEach((card) => {
    card.addEventListener("click", () => {
      const key = card.dataset.course;
      selectCourse(key);
    });
  });

  function selectCourse(key) {
    if (state.running) {
      showToast("러닝 중에는 코스를 변경할 수 없습니다.", "warning");
      return;
    }
    const course = COURSES[key];
    if (!course) return;

    state.courseKey = key;
    state.progress = 0;
    state.elapsed = 0;
    state.bots = buildBots();

    // UI 갱신
    courseCards.forEach((c) => c.classList.toggle("active", c.dataset.course === key));
    statCourse.textContent = course.emoji + " " + course.name;

    drawCourseOnMap(course);
    renderLeaderboard();
    updateStats();
    showToast(`${course.name} 코스 선택! 네온 트랙이 그려졌습니다.`, "success");
  }

  function clearMapObjects() {
    if (state.polyline && state.mapReady) {
      try { state.polyline.setMap(null); } catch (e) {}
    }
    state.polyline = null;
    if (state.myMarker && state.mapReady) {
      try { state.myMarker.setMap(null); } catch (e) {}
    }
    state.myMarker = null;
    state.botMarkers.forEach((m) => {
      try { m.setMap(null); } catch (e) {}
    });
    state.botMarkers = [];
  }

  function drawCourseOnMap(course) {
    if (!state.mapReady || !state.map) {
      console.info(`[RunCraft/Fallback] ${course.name} 경로:`, course.path);
      return;
    }

    // 지도 시점을 코스 중심으로
    state.map.setCenter(new Tmapv2.LatLng(course.center.lat, course.center.lng));
    state.map.setZoom(course.zoom);

    clearMapObjects();

    // 네온 핑크 Polyline
    const latLngs = course.path.map((p) => new Tmapv2.LatLng(p.lat, p.lng));
    state.polyline = new Tmapv2.Polyline({
      path: latLngs,
      strokeColor: course.color,
      strokeWeight: 6,
      strokeOpacity: 1,
      map: state.map,
    });
  }

  /* =========================================================
   * 9. 리더보드 렌더링 (내 + 봇 게이지 바)
   * ========================================================= */
  function renderLeaderboard() {
    if (!leaderboard) return;
    leaderboard.innerHTML = "";

    // 나 (ME)
    const me = {
      name: "ME (나)",
      color: "#00f0ff",
      emoji: "🏃",
      progress: state.progress,
    };
    leaderboard.appendChild(buildRunnerRow(me, true));

    // 봇
    state.bots.forEach((bot) => {
      leaderboard.appendChild(buildRunnerRow(bot, false));
    });

    updateLeaderboardValues();
  }

  function buildRunnerRow(runner, isMe) {
    const row = document.createElement("div");
    row.className = "runner-row" + (isMe ? " me" : "");
    row.dataset.name = runner.name;
    row.innerHTML =
      '<div class="runner-head">' +
        '<span class="runner-name">' +
          '<span class="runner-avatar" style="background:' + runner.color + ';box-shadow:0 0 8px ' + runner.color + ';">' + runner.emoji + '</span>' +
          runner.name +
        '</span>' +
        '<span class="runner-pct">0%</span>' +
      '</div>' +
      '<div class="gauge-track"><div class="gauge-fill" style="width:0%;"></div></div>';
    return row;
  }

  function updateLeaderboardValues() {
    if (!leaderboard) return;
    const rows = leaderboard.querySelectorAll(".runner-row");
    if (rows.length === 0) return;

    // 순위 정렬용 데이터
    const entries = [
      { name: "ME (나)", progress: state.progress },
      ...state.bots.map((b) => ({ name: b.name, progress: b.progress })),
    ];
    entries.sort((a, b) => b.progress - a.progress);
    const leaderName = entries[0].progress > 0 ? entries[0].name : null;

    rows.forEach((row) => {
      const name = row.dataset.name;
      const pct = name === "ME (나)" ? state.progress :
        (state.bots.find((b) => b.name === name) || {}).progress || 0;
      const pctEl = row.querySelector(".runner-pct");
      const fill = row.querySelector(".gauge-fill");
      if (pctEl) pctEl.textContent = Math.round(pct) + "%";
      if (fill) fill.style.width = pct + "%";

      // 리더 하이라이트
      row.classList.toggle("leader", name === leaderName && pct > 0);
    });
  }

  /* =========================================================
   * 10. 상태 박스 갱신
   * ========================================================= */
  function updateStats() {
    const course = state.courseKey ? COURSES[state.courseKey] : null;
    const dist = course ? (course.distance * state.progress / 100).toFixed(2) : "0.00";
    statMyDist.textContent = dist + " km";
    statProgress.textContent = Math.round(state.progress) + "%";
    const m = String(Math.floor(state.elapsed / 60)).padStart(2, "0");
    const s = String(state.elapsed % 60).padStart(2, "0");
    statTime.textContent = `${m}:${s}`;
  }

  /* =========================================================
   * 11. 가상 러닝 시작 (시뮬레이터 타이머)
   * ========================================================= */
  btnStart.addEventListener("click", () => {
    if (!state.courseKey) {
      showToast("먼저 코스를 선택하세요!", "warning");
      return;
    }
    if (state.running) {
      showToast("이미 러닝 중입니다!", "warning");
      return;
    }
    startRun();
  });

  btnReset.addEventListener("click", () => {
    resetRun();
  });

  function startRun() {
    state.running = true;
    state.progress = 0;
    state.elapsed = 0;
    btnStart.disabled = true;

    // 내 마커 생성
    createMyMarker();
    // 봇 마커 생성
    createBotMarkers();

    showToast("가상 러닝 시작! 봇들과 경쟁하세요! 🏃", "success");

    // 경과 시간 타이머 (1초)
    state.clockTimerId = setInterval(() => {
      state.elapsed++;
      updateStats();
    }, 1000);

    // 이동/게이지 타이머 (200ms 간격 부드러운 갱신)
    state.moveTimerId = setInterval(() => {
      tickSimulation();
    }, 200);
  }

  function tickSimulation() {
    const course = COURSES[state.courseKey];
    if (!course) return;

    // 내 진행률: 코스 거리 기반 (약 60~90초 완주)
    const mySpeedPerSec = 100 / 70; // ~70초 완주
    state.progress += mySpeedPerSec * 0.2; // 200ms -> 0.2초 분량
    if (state.progress > 100) state.progress = 100;

    // 봇 진행률: 각자 속도 + 랜덤 서지
    state.bots.forEach((bot) => {
      // 가끔 서지 발동
      if (Math.random() < 0.05) bot.surge = 1 + Math.random() * 1.5;
      const surgeBoost = bot.surge > 0 ? bot.surge : 0;
      bot.surge *= 0.7; // 서지 감쇠
      bot.progress += (bot.speed + surgeBoost) * 0.2;
      if (bot.progress > 100) bot.progress = 100;
    });

    // 내 마커 위치 이동
    moveMyMarker(course);
    // 봇 마커 위치 이동
    moveBotMarkers(course);

    // UI 갱신
    updateStats();
    updateLeaderboardValues();

    // 완주 체크
    if (state.progress >= 100) {
      finishRun();
    }
  }

  /* =========================================================
   * 12. 마커 생성 & 이동
   * ========================================================= */
  function createMyMarker() {
    if (!state.mapReady || !state.map) return;
    const course = COURSES[state.courseKey];
    const start = course.path[0];
    try {
      state.myMarker = new Tmapv2.Marker({
        position: new Tmapv2.LatLng(start.lat, start.lng),
        iconHTML: '<div style="font-size:24px;filter:drop-shadow(0 0 8px #00f0ff);">🏃</div>',
        map: state.map,
      });
    } catch (e) {
      console.warn("[RunCraft] 내 마커 생성 실패:", e);
    }
  }

  function createBotMarkers() {
    if (!state.mapReady || !state.map) return;
    const course = COURSES[state.courseKey];
    state.botMarkers = state.bots.map((bot) => {
      try {
        const m = new Tmapv2.Marker({
          position: new Tmapv2.LatLng(course.path[0].lat, course.path[0].lng),
          iconHTML: `<div style="font-size:18px;filter:drop-shadow(0 0 6px ${bot.color});">${bot.emoji}</div>`,
          map: state.map,
        });
        return m;
      } catch (e) {
        return null;
      }
    });
  }

  /** 진행률(0~100)에 해당하는 경로 상 좌표 반환 (선형 보간) */
  function pointAtProgress(course, pct) {
    const path = course.path;
    if (path.length < 2) return path[0];
    const totalSeg = path.length - 1;
    const exact = (pct / 100) * totalSeg;
    const idx = Math.min(Math.floor(exact), totalSeg - 1);
    const frac = exact - idx;
    const a = path[idx];
    const b = path[idx + 1];
    return {
      lat: a.lat + (b.lat - a.lat) * frac,
      lng: a.lng + (b.lng - a.lng) * frac,
    };
  }

  function moveMyMarker(course) {
    const pt = pointAtProgress(course, state.progress);
    if (state.mapReady && state.map && state.myMarker) {
      try {
        state.myMarker.setPosition(new Tmapv2.LatLng(pt.lat, pt.lng));
        state.map.setCenter(new Tmapv2.LatLng(pt.lat, pt.lng));
      } catch (e) {}
    } else {
      console.info(`[RunCraft/Fallback] ME 위치:`, pt, `(${Math.round(state.progress)}%)`);
    }
  }

  function moveBotMarkers(course) {
    state.bots.forEach((bot, i) => {
      const pt = pointAtProgress(course, bot.progress);
      const marker = state.botMarkers[i];
      if (marker && state.mapReady && state.map) {
        try {
          marker.setPosition(new Tmapv2.LatLng(pt.lat, pt.lng));
        } catch (e) {}
      }
    });
  }

  /* =========================================================
   * 13. 완주 처리
   * ========================================================= */
  function finishRun() {
    state.running = false;
    clearInterval(state.moveTimerId);
    clearInterval(state.clockTimerId);
    state.moveTimerId = null;
    state.clockTimerId = null;
    state.progress = 100;
    btnStart.disabled = false;

    updateStats();
    updateLeaderboardValues();

    // 순위 확정
    const entries = [
      { name: "ME (나)", progress: state.progress },
      ...state.bots.map((b) => ({ name: b.name, progress: b.progress })),
    ];
    entries.sort((a, b) => b.progress - a.progress);
    const rank = entries.findIndex((e) => e.name === "ME (나)") + 1;

    const m = String(Math.floor(state.elapsed / 60)).padStart(2, "0");
    const s = String(state.elapsed % 60).padStart(2, "0");
    showToast(`완주! 기록 ${m}:${s} · 최종 순위 ${rank}위 🎆`, "success");
  }

  /* =========================================================
   * 14. 초기화(리셋)
   * ========================================================= */
  function resetRun() {
    stopRun();
    state.progress = 0;
    state.elapsed = 0;
    state.bots = state.courseKey ? buildBots() : [];

    clearMapObjects();

    // 코스가 선택되어 있으면 다시 드로잉
    if (state.courseKey) {
      drawCourseOnMap(COURSES[state.courseKey]);
    }

    btnStart.disabled = false;
    renderLeaderboard();
    updateStats();
    showToast("시뮬레이션이 초기화되었습니다.", "info");
  }

  function stopRun() {
    if (state.moveTimerId) clearInterval(state.moveTimerId);
    if (state.clockTimerId) clearInterval(state.clockTimerId);
    state.moveTimerId = null;
    state.clockTimerId = null;
    state.running = false;
    btnStart.disabled = false;
  }

  /* =========================================================
   * 15. 토스트 유틸
   * ========================================================= */
  function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icons = { success: "✅", info: "ℹ️", warning: "⚠️", error: "❌" };
    toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "slideInRight 0.3s reverse ease-out";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /* =========================================================
   * 16. 초기 진입
   * ========================================================= */
  // 로비가 기본 표시되므로 별도 초기화 불필요
  console.info("[RunCraft] 단독 구동형 런크래프트 로드 완료");
})();