/* ========================================
   FoodLens AI — app.js
   Pure Vanilla JS · No External APIs
   ======================================== */

// ==========================================
// 1. 가상 음식 데이터셋
// ==========================================
const FOOD_DATABASE = [
  {
    name: '치킨 (후라이드)',
    emoji: '🍗',
    calories: 580,
    carbs: 25,
    protein: 35,
    fat: 38,
    keywords: ['치킨', 'chicken', '닭', '튀김'],
    feedback: '튀김옷의 탄수화물이 생각보다 높아요! 다음엔 구이 치킨을 선택하면 칼로리를 30% 줄일 수 있어요.',
  },
  {
    name: '샐러드 (그릭)',
    emoji: '🥗',
    calories: 220,
    carbs: 12,
    protein: 15,
    fat: 14,
    keywords: ['샐러드', 'salad', '야채', '채소'],
    feedback: '훌륭한 선택이에요! 단백질이 조금 부족하니 닭가슴살이나 두부를 추가하면 완벽해요.',
  },
  {
    name: '마라탕',
    emoji: '🍲',
    calories: 720,
    carbs: 45,
    protein: 28,
    fat: 42,
    keywords: ['마라탕', 'mala', '마라', '탕'],
    feedback: '매운맛의 캡사이신이 대사량을 약간 올려주지만, 나트륨 함량이 높아요. 물을 충분히 마셔주세요!',
  },
  {
    name: '떡볶이',
    emoji: '🌶️',
    calories: 480,
    carbs: 72,
    protein: 8,
    fat: 14,
    keywords: ['떡볶이', '떡', '볶이', 'tteokbokki'],
    feedback: '탄수화물 비중이 매우 높아요. 단백질 반찬을 곁들이면 혈당 스파이크를 줄일 수 있어요.',
  },
  {
    name: '피자 (페퍼로니)',
    emoji: '🍕',
    calories: 650,
    carbs: 55,
    protein: 28,
    fat: 34,
    keywords: ['피자', 'pizza', '페퍼로니'],
    feedback: '한 조각(250kcal)만 먹어도 충분해요. 남은 피자는 내일 점심으로 계획해보세요!',
  },
  {
    name: '햄버거 (클래식)',
    emoji: '🍔',
    calories: 540,
    carbs: 42,
    protein: 30,
    fat: 26,
    keywords: ['햄버거', 'burger', '버거'],
    feedback: '감자튀김 대신 사이드 샐러드를 선택하면 총 칼로리를 200kcal 줄일 수 있어요.',
  },
  {
    name: '삼겹살 (200g)',
    emoji: '🥩',
    calories: 680,
    carbs: 2,
    protein: 42,
    fat: 54,
    keywords: ['삼겹살', '고기', '돼지', 'pork'],
    feedback: '단백질이 풍부하지만 지방 함량이 높아요. 쌈 채소를 많이 드시면 좋아요!',
  },
  {
    name: '김밥',
    emoji: '🍙',
    calories: 350,
    carbs: 52,
    protein: 12,
    fat: 10,
    keywords: ['김밥', 'gimbap', '김밥'],
    feedback: '균형 잡힌 한 끼예요! 참치 김밥을 선택하면 단백질을 더 보충할 수 있어요.',
  },
  {
    name: '라면',
    emoji: '🍜',
    calories: 510,
    carbs: 68,
    protein: 14,
    fat: 18,
    keywords: ['라면', 'ramen', '라면', 'instant'],
    feedback: '나트륨이 한 끼 기준 일일 권장량의 80%! 건더기 스프는 절반만 넣는 걸 추천해요.',
  },
  {
    name: '요거트 보울',
    emoji: '🫐',
    calories: 280,
    carbs: 35,
    protein: 18,
    fat: 8,
    keywords: ['요거트', '요거트보울', 'yogurt', '그릭요거트'],
    feedback: '프로바이오틱스가 장 건강에 좋아요! 그래놀라 양을 조절하면 칼로리를 더 줄일 수 있어요.',
  },
  {
    name: '연어 스테이크',
    emoji: '🐟',
    calories: 420,
    carbs: 5,
    protein: 45,
    fat: 24,
    keywords: ['연어', 'salmon', '생선', '회'],
    feedback: '오메가-3 지방산이 풍부해요! 근육 회복에 최고인 선택이에요.',
  },
  {
    name: '아보카도 토스트',
    emoji: '🥑',
    calories: 320,
    carbs: 28,
    protein: 10,
    fat: 20,
    keywords: ['아보카도', '토스트', 'avocado'],
    feedback: '건강한 지방이 포만감을 오래 유지해줘요. 달걀을 올리면 단백질 보충!',
  },
];

// ==========================================
// 2. 전역 상태 (온보딩 + 앱 데이터)
// ==========================================
const AppState = {
  // 온보딩 데이터
  goal: null,         // 'loss' | 'gain' | 'maintain'
  activity: null,     // 'low' | 'medium' | 'high'
  weight: null,       // number (kg)
  favFood: null,      // string (e.g. '치킨')

  // 계산된 목표 칼로리
  targetCalories: 2000,

  // 오늘 섭취 누적
  totalCalories: 0,
  totalCarbs: 0,
  totalProtein: 0,
  totalFat: 0,

  // 식단 기록
  mealHistory: [],

  // 현재 분석 중인 음식
  currentFood: null,
};

// ==========================================
// 3. 온보딩 모달 로직
// ==========================================
const OnboardingModal = {
  currentStep: 1,
  totalSteps: 4,
  selections: {},

  init() {
    this.bindEvents();
    this.updateProgress();
  },

  bindEvents() {
    // 옵션 버튼 선택
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        const value = btn.dataset.value;

        // 같은 그룹 내 선택 초기화
        document.querySelectorAll(`.option-btn[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        this.selections[group] = value;
      });
    });

    // 다음 버튼
    document.getElementById('onboarding-next').addEventListener('click', () => this.nextStep());
    // 이전 버튼
    document.getElementById('onboarding-prev').addEventListener('click', () => this.prevStep());
  },

  nextStep() {
    // 유효성 검사
    if (!this.validateStep()) return;

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.showStep(this.currentStep);
    } else {
      // 완료 — 데이터 저장 & 앱 시작
      this.saveData();
      this.closeModal();
    }
  },

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.showStep(this.currentStep);
    }
  },

  validateStep() {
    switch (this.currentStep) {
      case 1:
        if (!this.selections.goal) { this.shake(); return false; }
        return true;
      case 2:
        if (!this.selections.activity) { this.shake(); return false; }
        return true;
      case 3:
        const w = parseFloat(document.getElementById('weight-input').value);
        if (!w || w < 20 || w > 300) { this.shake(); return false; }
        this.selections.weight = w;
        return true;
      case 4:
        if (!this.selections.favFood) { this.shake(); return false; }
        return true;
      default: return true;
    }
  },

  shake() {
    const modal = document.querySelector('.onboarding-modal');
    modal.style.animation = 'none';
    void modal.offsetWidth;
    modal.style.animation = 'shake .4s ease';
  },

  showStep(step) {
    document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
    document.querySelector(`.onboarding-step[data-step="${step}"]`).classList.add('active');

    // 버튼 상태
    const prevBtn = document.getElementById('onboarding-prev');
    const nextBtn = document.getElementById('onboarding-next');
    prevBtn.disabled = step === 1;
    nextBtn.textContent = step === this.totalSteps ? '시작하기 🚀' : '다음 →';

    this.updateProgress();
  },

  updateProgress() {
    const pct = (this.currentStep / this.totalSteps) * 100;
    document.getElementById('onboarding-progress-bar').style.width = pct + '%';
  },

  saveData() {
    AppState.goal = this.selections.goal;
    AppState.activity = this.selections.activity;
    AppState.weight = this.selections.weight;
    AppState.favFood = this.selections.favFood;

    // 목표 칼로리 계산 (Mifflin-St Jeor 근사)
    let bmr = 10 * AppState.weight + 6.25 * 170 - 5 * 25; // 키/나이 기본값
    const activityMultiplier = { low: 1.2, medium: 1.55, high: 1.9 }[AppState.activity] || 1.4;
    let tdee = bmr * activityMultiplier;

    if (AppState.goal === 'loss') tdee -= 400;
    else if (AppState.goal === 'gain') tdee += 300;

    AppState.targetCalories = Math.round(tdee);

    // UI 반영
    document.getElementById('goal-calories').textContent = AppState.targetCalories.toLocaleString();
  },

  closeModal() {
    const modal = document.getElementById('onboarding-modal');
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.style.opacity = '';
      document.getElementById('app').classList.remove('hidden');
    }, 300);
  },
};

// ==========================================
// 4. 메인 앱 로직
// ==========================================
const App = {
  init() {
    this.bindUpload();
    this.bindModals();
    this.bindProfile();
  },

  // ---------- 파일 업로드 ----------
  bindUpload() {
    const area = document.getElementById('upload-area');
    const input = document.getElementById('food-image-input');

    area.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this.handleImageUpload(file);
    });

    // 드래그 앤 드롭
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.style.borderColor = 'rgba(16,185,129,.6)'; });
    area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this.handleImageUpload(file);
    });
  },

  handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      // 미리보기 표시
      const preview = document.getElementById('upload-preview');
      const placeholder = document.getElementById('upload-placeholder');
      const img = document.getElementById('preview-img');
      const area = document.getElementById('upload-area');

      img.src = e.target.result;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
      area.classList.add('has-image');

      // AI 분석 시작
      setTimeout(() => this.startAnalysis(), 600);
    };
    reader.readAsDataURL(file);
  },

  // ---------- AI 분석 시뮬레이션 ----------
  startAnalysis() {
    const analysisSection = document.getElementById('analysis-section');
    const resultSection = document.getElementById('result-section');
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');

    // 이전 결과 숨기기
    resultSection.classList.add('hidden');
    analysisSection.classList.remove('hidden');

    const messages = [
      '음식 종류를 식별하고 있습니다...',
      '영양소 데이터를 분석하고 있어요...',
      '맞춤형 피드백을 생성하고 있습니다...',
    ];

    let progress = 0;
    let msgIndex = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress > 100) progress = 100;
      loadingBar.style.width = progress + '%';

      if (progress > 30 && msgIndex === 0) { msgIndex = 1; loadingText.textContent = messages[1]; }
      if (progress > 65 && msgIndex === 1) { msgIndex = 2; loadingText.textContent = messages[2]; }

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          analysisSection.classList.add('hidden');
          this.showResult();
        }, 400);
      }
    }, 200);
  },

  // ---------- 음식 매칭 (키워드 기반) ----------
  matchFood() {
    // 랜덤 매칭 (실제 이미지 분석 없이 시뮬레이션)
    // 단, 최애 음식과 일치하면 해당 음식 우선 매칭
    const fav = AppState.favFood;
    const favMatch = FOOD_DATABASE.find(f => f.keywords.some(k => fav && fav.includes(k)));

    // 40% 확률로 최애 음식 매칭, 아니면 랜덤
    if (favMatch && Math.random() < 0.4) {
      return favMatch;
    }

    return FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
  },

  // ---------- 결과 표시 ----------
  showResult() {
    const food = this.matchFood();
    AppState.currentFood = food;

    // 결과 섹션 보이기
    const resultSection = document.getElementById('result-section');
    resultSection.classList.remove('hidden');

    // 음식 이름 & 칼로리
    document.getElementById('food-name').textContent = food.emoji + ' ' + food.name;
    document.getElementById('food-calorie-badge').textContent = food.calories + ' kcal';

    // 칼로리 카운트업 애니메이션
    this.animateCalories(food.calories);

    // 탄단지 바 애니메이션
    setTimeout(() => this.animateMacros(food), 300);

    // 도넛 차트 애니메이션
    setTimeout(() => this.animateDonut(food), 500);

    // AI 피드백
    document.getElementById('feedback-text').textContent = food.feedback;

    // 최애 음식 감지 피드백
    const favFeedback = document.getElementById('fav-food-feedback');
    if (food.keywords.some(k => AppState.favFood && AppState.favFood.includes(k))) {
      favFeedback.classList.remove('hidden');
      document.getElementById('fav-food-msg').textContent =
        `💖 최애 음식 "${AppState.favFood}" 감지! AI가 기억하고 있어요 — 오늘도 맛있게 드세요!`;
    } else {
      favFeedback.classList.add('hidden');
    }

    // 누적 칼로리 업데이트
    AppState.totalCalories += food.calories;
    AppState.totalCarbs += food.carbs;
    AppState.totalProtein += food.protein;
    AppState.totalFat += food.fat;

    this.updateDailySummary();
    this.addMealHistory(food);

    // 업로드 영역 초기화 (다음 업로드 준비)
    setTimeout(() => {
      const preview = document.getElementById('upload-preview');
      const placeholder = document.getElementById('upload-placeholder');
      const area = document.getElementById('upload-area');
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
      area.classList.remove('has-image');
      document.getElementById('food-image-input').value = '';
    }, 1000);
  },

  // ---------- 칼로리 카운트업 ----------
  animateCalories(target) {
    const el = document.getElementById('total-calories');
    const start = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
    const end = AppState.totalCalories;
    const duration = 1200;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (end - start) * eased);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  // ---------- 일일 요약 바 ----------
  updateDailySummary() {
    const pct = Math.min((AppState.totalCalories / AppState.targetCalories) * 100, 100);
    document.getElementById('calorie-bar').style.width = pct + '%';
  },

  // ---------- 탄단지 바 ----------
  animateMacros(food) {
    const maxGram = 100; // 그래프 최대값
    const carbPct = Math.min((food.carbs / maxGram) * 100, 100);
    const proteinPct = Math.min((food.protein / maxGram) * 100, 100);
    const fatPct = Math.min((food.fat / maxGram) * 100, 100);

    document.getElementById('carb-bar').style.width = carbPct + '%';
    document.getElementById('protein-bar').style.width = proteinPct + '%';
    document.getElementById('fat-bar').style.width = fatPct + '%';

    document.getElementById('carb-value').textContent = food.carbs + 'g';
    document.getElementById('protein-value').textContent = food.protein + 'g';
    document.getElementById('fat-value').textContent = food.fat + 'g';
  },

  // ---------- 도넛 차트 ----------
  animateDonut(food) {
    const total = food.carbs + food.protein + food.fat;
    const circumference = 2 * Math.PI * 50; // r=50

    const carbLen = (food.carbs / total) * circumference;
    const proteinLen = (food.protein / total) * circumference;
    const fatLen = (food.fat / total) * circumference;

    const carbSeg = document.querySelector('.carb-segment');
    const proteinSeg = document.querySelector('.protein-segment');
    const fatSeg = document.querySelector('.fat-segment');

    // 탄수화물
    carbSeg.style.strokeDasharray = `${carbLen} ${circumference}`;
    carbSeg.style.strokeDashoffset = '0';

    // 단백질 (탄수화물 뒤에 이어서)
    proteinSeg.style.strokeDasharray = `${proteinLen} ${circumference}`;
    proteinSeg.style.strokeDashoffset = `-${carbLen}`;

    // 지방 (탄수화물 + 단백질 뒤에 이어서)
    fatSeg.style.strokeDasharray = `${fatLen} ${circumference}`;
    fatSeg.style.strokeDashoffset = `-${carbLen + proteinLen}`;
  },

  // ---------- 식단 기록 ----------
  addMealHistory(food) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    AppState.mealHistory.push({
      name: food.name,
      emoji: food.emoji,
      calories: food.calories,
      time: timeStr,
    });

    this.renderMealHistory();
  },

  renderMealHistory() {
    const container = document.getElementById('meal-history');

    if (AppState.mealHistory.length === 0) {
      container.innerHTML = '<p class="empty-history">아직 기록이 없어요. 첫 식사를 분석해보세요! 📷</p>';
      return;
    }

    container.innerHTML = AppState.mealHistory.map((meal, i) => `
      <div class="meal-item" style="animation-delay: ${i * 0.05}s">
        <div class="meal-item-left">
          <span class="meal-item-icon">${meal.emoji}</span>
          <div>
            <div class="meal-item-name">${meal.name}</div>
            <div class="meal-item-time">${meal.time}</div>
          </div>
        </div>
        <span class="meal-item-cal">${meal.calories} kcal</span>
      </div>
    `).join('');
  },

  // ---------- 모달 이벤트 ----------
  bindModals() {
    // AI 핏 패스 모달
    document.getElementById('open-pass-modal').addEventListener('click', () => {
      document.getElementById('pass-modal').classList.remove('hidden');
    });
    document.getElementById('close-pass-modal').addEventListener('click', () => {
      document.getElementById('pass-modal').classList.add('hidden');
    });
    document.getElementById('pass-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) document.getElementById('pass-modal').classList.add('hidden');
    });

    // 구독 버튼 (데모)
    document.querySelector('.pass-subscribe-btn').addEventListener('click', () => {
      alert('🎉 7일 무료 체험이 시작됩니다!\n(데모 버전 — 실제 결제 없음)');
    });

    // 배너 쿠폰 (데모)
    document.querySelector('.banner-cta').addEventListener('click', () => {
      alert('📍 쿠폰이 저장되었습니다!\n(데모 버전 — 실제 연동 없음)');
    });
  },

  // ---------- 프로필 ----------
  bindProfile() {
    document.getElementById('profile-btn').addEventListener('click', () => {
      this.updateProfileModal();
      document.getElementById('profile-modal').classList.remove('hidden');
    });
    document.getElementById('close-profile-modal').addEventListener('click', () => {
      document.getElementById('profile-modal').classList.add('hidden');
    });
    document.getElementById('profile-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) document.getElementById('profile-modal').classList.add('hidden');
    });
    document.getElementById('edit-profile-btn').addEventListener('click', () => {
      document.getElementById('profile-modal').classList.add('hidden');
      // 온보딩 모달 다시 보이기
      const modal = document.getElementById('onboarding-modal');
      modal.classList.remove('hidden');
      OnboardingModal.currentStep = 1;
      OnboardingModal.showStep(1);
    });
  },

  updateProfileModal() {
    const goalMap = { loss: '🔥 체중 감량', gain: '💪 근육 증량', maintain: '⚖️ 체중 유지' };
    const actMap = { low: '🛋️ 거의 안 움직여요', medium: '🚶 가벼운 활동', high: '🏃 활발한 운동' };

    document.getElementById('p-goal').textContent = goalMap[AppState.goal] || '—';
    document.getElementById('p-activity').textContent = actMap[AppState.activity] || '—';
    document.getElementById('p-weight').textContent = AppState.weight ? AppState.weight + ' kg' : '—';
    document.getElementById('p-fav').textContent = AppState.favFood || '—';
    document.getElementById('p-target-cal').textContent = AppState.targetCalories.toLocaleString() + ' kcal';
  },
};

// ==========================================
// 5. 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  OnboardingModal.init();
  App.init();
});

// Shake 애니메이션 (CSS에 없는 경우 JS로 추가)
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);