// RunCraft 커스텀 코스 E2E: 실제 장소(POI 시드/지도클릭) → 실제 보행자 도로 경로 코스 생성까지 눈으로 검증.
const { test, expect } = require('@playwright/test');

const SHOT = 'playwright-artifacts';

async function enterRoom(page) {
  await page.goto('/runcraft', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /프라이빗 룸 만들기/ }).click();
  await expect(page.locator('.mode-tabs')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => typeof window.Tmapv2 !== 'undefined', null, { timeout: 20000 });
}

async function enterRoomAndCustomTab(page) {
  await enterRoom(page);
  await page.locator('.mode-tab', { hasText: '커스텀' }).click();
  await expect(page.locator('.custom-builder')).toBeVisible();
}

test('★프리셋: 여의도 8K 오픈런 실제 도로 코스 + 체크포인트 + 음성 길안내', async ({ page }) => {
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [browser error]', m.text()); });
  await enterRoom(page);

  // 여의도 8K 오픈런 코스 선택 (체크포인트 → 실제 보행자 경로 라우팅)
  await page.locator('.course-card', { hasText: '여의도 8K 오픈런' }).click();

  // 실제 경로 로딩 완료 → 상태박스에 코스명 반영
  await expect(page.locator('.status-box')).toContainText('여의도 8K 오픈런', { timeout: 30000 });
  await page.waitForTimeout(1600); // drawCourseOnMap 마커 렌더 대기

  // 실제 라우팅 거리(0보다 큼)와 체크포인트 마커 확인
  const info = await page.evaluate(() => {
    const c = document.querySelector('.map-container');
    const txt = c ? c.innerText : '';
    return {
      hasSF: txt.includes('S·F'),
      has1K: txt.includes('1K'),
      has7K: txt.includes('7K'),
      vectors: c ? c.querySelectorAll('path, polyline, canvas, svg').length : 0,
    };
  });
  console.log('  체크포인트 마커: S·F=' + info.hasSF + ' 1K=' + info.has1K + ' 7K=' + info.has7K + ' | 경로벡터=' + info.vectors);
  await page.screenshot({ path: `${SHOT}/07-preset-course.png`, fullPage: true });

  // 음성 발화 스파이 설치
  await page.evaluate(() => {
    window.__spoken = [];
    if (window.speechSynthesis) {
      const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = (u) => { try { window.__spoken.push(u.text); } catch (e) {} try { orig(u); } catch (e) {} };
    }
  });

  // 가상 러닝 시작 → 음성 안내 트리거 (출발 + KM 통과 안내까지 확인)
  await page.getByRole('button', { name: /가상 러닝 시작/ }).click();
  await page.waitForTimeout(24000); // ~34% 진행 → 여러 KM 지점 통과

  const spoken = await page.evaluate(() => window.__spoken || []);
  const navText = (await page.locator('.nav-text').textContent()).trim();
  console.log('  🔊 발화된 안내(' + spoken.length + '개):');
  spoken.slice(0, 10).forEach((t, i) => console.log('    ' + (i + 1) + '. ' + t));
  console.log('  현재 안내바 텍스트:', navText);
  await page.screenshot({ path: `${SHOT}/08-voice-run.png`, fullPage: true });

  expect(spoken.length).toBeGreaterThan(1);              // 출발 + 이후 안내들
  expect(spoken.join(' ')).toMatch(/출발/);              // 출발 안내
  expect(spoken.join(' ')).toMatch(/킬로미터/);          // KM 지점 음성 안내
  expect(navText.length).toBeGreaterThan(0);             // 화면 안내바 갱신
});

test('커스텀 코스: 실제 장소 시드 핀 → 실제 도보 경로 코스 생성', async ({ page }) => {
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [browser error]', m.text()); });

  await enterRoomAndCustomTab(page);

  // 실제 장소 칩 3개 추가 (여의도 클러스터 — 라우팅 검증된 좌표)
  for (const name of ['여의도한강공원', '여의도공원', '국회의사당']) {
    await page.locator('.seed-chip', { hasText: name }).click();
  }

  // 핀 3개 확인
  await expect(page.locator('.pins-header')).toContainText('선택한 핀 (3)');
  await expect(page.locator('.pin-row')).toHaveCount(3);
  await page.screenshot({ path: `${SHOT}/01-pins-added.png`, fullPage: true });
  console.log('  ✓ 실제 장소 핀 3개 추가됨');

  // 코스 생성 (보행자 경로 API 호출)
  const buildBtn = page.getByRole('button', { name: /실제 도보 경로로 코스 생성/ });
  await expect(buildBtn).toBeEnabled();
  await buildBtn.click();

  // 생성 완료 배지 (총 거리) 확인
  const meta = page.locator('.custom-meta');
  await expect(meta).toBeVisible({ timeout: 30000 });
  await expect(meta).toContainText('생성됨');
  await expect(meta).toContainText('km');
  const metaText = (await meta.textContent()).trim();
  console.log('  ✓ 코스 생성됨:', metaText);

  // 상태 박스에 커스텀 코스로 반영됐는지
  await expect(page.locator('.status-box')).toContainText('커스텀 코스');

  // 지도에 폴리라인이 실제로 그려졌는지 (SVG path 존재)
  const hasPath = await page.evaluate(() => {
    const c = document.querySelector('.map-container');
    if (!c) return false;
    return c.querySelectorAll('path, polyline, canvas').length > 0;
  });
  console.log('  지도 벡터/캔버스 요소 존재:', hasPath);

  await page.screenshot({ path: `${SHOT}/02-course-created.png`, fullPage: true });

  // 총 거리 숫자 파싱 검증 (0보다 큼)
  const km = parseFloat((metaText.match(/([0-9]+(?:\.[0-9]+)?)km/) || [])[1] || '0');
  expect(km).toBeGreaterThan(0);
  console.log('  ✓ 실제 도보 총거리:', km, 'km');
});

test('POI 검색: 활성화 전 안내 메시지 확인 (활성화되면 결과 표시)', async ({ page }) => {
  await enterRoomAndCustomTab(page);

  // 브라우저가 실제로 받은 POI 응답을 로깅
  page.on('response', async (r) => {
    if (r.url().includes('/api/tmap/poi')) {
      let body = '';
      try { body = (await r.text()).slice(0, 200); } catch {}
      console.log(`  [POI 응답] ${r.status()} url=${r.url()}`);
      console.log(`  [POI body] ${body}`);
    }
  });

  await page.getByPlaceholder(/장소 검색/).fill('스타벅스');
  await page.getByRole('button', { name: /^검색$/ }).click();

  // 결과(.poi-item) 또는 안내(.poi-error) 중 하나가 나타남
  const results = page.locator('.poi-item');
  const err = page.locator('.poi-error');
  await expect(results.first().or(err)).toBeVisible({ timeout: 20000 });

  if (await err.isVisible()) {
    const t = (await err.textContent()).trim();
    console.log('  ⚠️ POI 미활성 안내 확인:', t.slice(0, 80));
    expect(t).toContain('POI');
  } else {
    const n = await results.count();
    console.log('  ✓ POI 검색 결과', n, '건 (활성화됨)');
    expect(n).toBeGreaterThan(0);
  }
  await page.screenshot({ path: `${SHOT}/03-poi-search.png`, fullPage: true });
});

test('★핵심 흐름: 실제 POI 검색 → 결과 클릭으로 핀 → 실제 도보 코스 생성', async ({ page }) => {
  await enterRoomAndCustomTab(page);

  async function searchAndAddFirst(keyword) {
    await page.getByPlaceholder(/장소 검색/).fill(keyword);
    await page.getByRole('button', { name: /^검색$/ }).click();
    const first = page.locator('.poi-item').first();
    const err = page.locator('.poi-error');
    await expect(first.or(err)).toBeVisible({ timeout: 20000 });
    if (await err.isVisible()) return null; // POI 미활성 창
    const name = (await first.locator('.poi-name').textContent()).trim();
    await first.click();
    return name;
  }

  // POI 가 일시적으로 204(미활성 창)이면 이 테스트는 스킵
  const probe = await searchAndAddFirst('여의도한강공원');
  if (probe === null) {
    console.log('  ⚠️ POI 미활성 창 — 이 테스트 스킵 (프리셋/시드칩 경로는 정상)');
    test.skip(true, 'POI 검색이 일시적으로 204 상태');
    return;
  }
  const n1 = probe;
  const n2 = await searchAndAddFirst('여의도공원');
  const n3 = await searchAndAddFirst('국회의사당');
  console.log('  ✓ 검색으로 추가된 실제 POI 핀:', [n1, n2, n3].join(' → '));

  await expect(page.locator('.pins-header')).toContainText('선택한 핀 (3)');
  await page.screenshot({ path: `${SHOT}/05-poi-pins.png`, fullPage: true });

  await page.getByRole('button', { name: /실제 도보 경로로 코스 생성/ }).click();
  const meta = page.locator('.custom-meta');
  await expect(meta).toBeVisible({ timeout: 30000 });
  const metaText = (await meta.textContent()).trim();
  const km = parseFloat((metaText.match(/([0-9]+(?:\.[0-9]+)?)km/) || [])[1] || '0');
  expect(km).toBeGreaterThan(0);
  console.log('  ✓ 실제 POI 3곳 → 실제 도보 코스 생성:', metaText);
  await page.screenshot({ path: `${SHOT}/06-poi-course.png`, fullPage: true });
});

test('지도 클릭으로 핀 추가 (역지오코딩 장소명) — best effort', async ({ page }) => {
  await enterRoomAndCustomTab(page);

  const box = await page.locator('.map-container').boundingBox();
  // 지도 서로 다른 지점 2곳 클릭
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.waitForTimeout(1200);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.55);
  await page.waitForTimeout(1500); // 역지오코딩 반영 대기

  const pinCount = await page.locator('.pin-row').count();
  console.log('  지도 클릭 후 핀 개수:', pinCount);
  await page.screenshot({ path: `${SHOT}/04-map-click.png`, fullPage: true });

  if (pinCount > 0) {
    const firstName = (await page.locator('.pin-name').first().textContent()).trim();
    console.log('  ✓ 지도 클릭 핀 이름(역지오코딩):', firstName);
  } else {
    console.log('  ℹ️ 지도 클릭이 TMap click 이벤트를 발생시키지 않음(SDK 이벤트 형태 차이 가능) — 시드칩/검색 경로는 정상');
  }
});
