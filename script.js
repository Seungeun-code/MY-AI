// ===== 게임 설정 =====
const CONFIG = {
  CAT_WIDTH: 60,
  CAT_HEIGHT: 50,
  ITEM_SIZE: 35,
  BASE_SPEED: 3,
  SPEED_PER_LEVEL: 0.8,
  MAX_SPEED: 12,
  SPAWN_RATE: 50,
  SPAWN_RATE_DECREASE: 3,
  MIN_SPAWN_RATE: 15,
  COMBO_TIMEOUT: 2500,
  POWERUP_DURATION: 6000,
  LEVEL_UP_SCORE: 80,
};

// ===== 아이템 타입 =====
const ITEM_TYPES = {
  FISH: { emoji: '🐟', points: 10, color: '#4ECDC4', size: 1 },
  GOLDEN_FISH: { emoji: '🐠', points: 30, color: '#FFD700', size: 1.2 },
  SHRIMP: { emoji: '', points: 15, color: '#FF6B6B', size: 1 },
  SQUID: { emoji: '', points: 20, color: '#E056A0', size: 1.1 },
  BOMB: { emoji: '💣', points: -1, color: '#333', size: 1 },
  STAR: { emoji: '⭐', points: 0, color: '#FFD700', powerUp: 'star', size: 1.2 },
  MAGNET: { emoji: '🧲', points: 0, color: '#E74C3C', powerUp: 'magnet', size: 1.2 },
  DOUBLE: { emoji: '✨', points: 0, color: '#9B59B6', powerUp: 'double', size: 1.2 },
  SHIELD: { emoji: '️', points: 0, color: '#3498DB', powerUp: 'shield', size: 1.2 },
  BIG_FISH: { emoji: '🐋', points: 50, color: '#2980B9', size: 1.8, rare: true },
};

// ===== DOM 요소 =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const gameoverScreen = document.getElementById('gameoverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const homeBtn = document.getElementById('homeBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const comboDisplay = document.getElementById('comboDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const highScoreStart = document.getElementById('highScoreStart');
const finalScore = document.getElementById('finalScore');
const finalCombo = document.getElementById('finalCombo');
const finalLevel = document.getElementById('finalLevel');
const finalCat = document.getElementById('finalCat');
const newRecord = document.getElementById('newRecord');
const powerUpIndicator = document.getElementById('powerUpIndicator');
const powerUpIcon = document.getElementById('powerUpIcon');
const powerUpTime = document.getElementById('powerUpTime');

// ===== 게임 상태 =====
let gameState = {
  running: false,
  score: 0,
  lives: 3,
  combo: 0,
  maxCombo: 0,
  level: 1,
  cat: { x: 200, y: 500, targetX: 200, expression: 'normal', expressionTimer: 0 },
  items: [],
  particles: [],
  popups: [],
  powerUp: null,
  powerUpEndTime: 0,
  lastComboTime: 0,
  frameCount: 0,
  highScore: parseInt(localStorage.getItem('nyancoHighScore')) || 0,
  shakeTimer: 0,
  shakeIntensity: 0,
  levelUpTimer: 0,
  itemsCaught: 0,
  itemsMissed: 0,
};

// ===== 캔버스 크기 설정 =====
function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  canvas.width = Math.max(rect.width, 300);
  canvas.height = Math.max(rect.height - 60, 400);
  gameState.cat.y = canvas.height - CONFIG.CAT_HEIGHT - 20;
  if (!gameState.running) {
    gameState.cat.x = canvas.width / 2 - CONFIG.CAT_WIDTH / 2;
    gameState.cat.targetX = gameState.cat.x;
  }
}

// ===== 초기화 =====
function init() {
  highScoreStart.textContent = gameState.highScore;
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

// ===== 화면 전환 =====
function showScreen(screen) {
  startScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  screen.classList.remove('hidden');
}

// ===== 게임 시작 =====
function startGame() {
  showScreen(gameScreen);
  setTimeout(function() {
    resizeCanvas();
    gameState.running = true;
    gameState.score = 0;
    gameState.lives = 3;
    gameState.combo = 0;
    gameState.maxCombo = 0;
    gameState.level = 1;
    gameState.cat.x = canvas.width / 2 - CONFIG.CAT_WIDTH / 2;
    gameState.cat.y = canvas.height - CONFIG.CAT_HEIGHT - 20;
    gameState.cat.targetX = gameState.cat.x;
    gameState.cat.expression = 'normal';
    gameState.cat.expressionTimer = 0;
    gameState.items = [];
    gameState.particles = [];
    gameState.popups = [];
    gameState.powerUp = null;
    gameState.powerUpEndTime = 0;
    gameState.lastComboTime = 0;
    gameState.frameCount = 0;
    gameState.shakeTimer = 0;
    gameState.levelUpTimer = 0;
    gameState.itemsCaught = 0;
    gameState.itemsMissed = 0;
    updateUI();
    requestAnimationFrame(gameLoop);
  }, 50);
}

// ===== 게임 오버 =====
function gameOver() {
  gameState.running = false;
  var isNewRecord = gameState.score > gameState.highScore;
  if (isNewRecord) {
    gameState.highScore = gameState.score;
    localStorage.setItem('nyancoHighScore', gameState.highScore);
  }
  finalScore.textContent = gameState.score;
  finalCombo.textContent = gameState.maxCombo;
  finalLevel.textContent = gameState.level;
  if (gameState.score >= 500) finalCat.textContent = '😻';
  else if (gameState.score >= 200) finalCat.textContent = '😺';
  else if (gameState.score >= 100) finalCat.textContent = '😸';
  else finalCat.textContent = '😿';
  newRecord.classList.toggle('hidden', !isNewRecord);
  setTimeout(function() { showScreen(gameoverScreen); }, 800);
}

// ===== 현재 속도 계산 =====
function getCurrentSpeed() {
  var speed = CONFIG.BASE_SPEED + (gameState.level - 1) * CONFIG.SPEED_PER_LEVEL;
  return Math.min(speed, CONFIG.MAX_SPEED);
}

// ===== 현재 생성 주기 =====
function getCurrentSpawnRate() {
  var rate = CONFIG.SPAWN_RATE - (gameState.level - 1) * CONFIG.SPAWN_RATE_DECREASE;
  return Math.max(rate, CONFIG.MIN_SPAWN_RATE);
}

// ===== 아이템 생성 =====
function spawnItem() {
  var rand = Math.random();
  var type;
  var bombChance = Math.min(0.12 + gameState.level * 0.025, 0.35);
  var powerUpChance = 0.06;
  var goldenChance = 0.08;
  var bigFishChance = 0.03;

  if (rand < bigFishChance && gameState.level >= 3) {
    type = ITEM_TYPES.BIG_FISH;
  } else if (rand < bigFishChance + bombChance) {
    type = ITEM_TYPES.BOMB;
  } else if (rand < bigFishChance + bombChance + powerUpChance) {
    var powerUps = [ITEM_TYPES.STAR, ITEM_TYPES.MAGNET, ITEM_TYPES.DOUBLE, ITEM_TYPES.SHIELD];
    type = powerUps[Math.floor(Math.random() * powerUps.length)];
  } else if (rand < bigFishChance + bombChance + powerUpChance + goldenChance) {
    type = ITEM_TYPES.GOLDEN_FISH;
  } else if (rand < bigFishChance + bombChance + powerUpChance + goldenChance + 0.15) {
    type = ITEM_TYPES.SQUID;
  } else if (rand < bigFishChance + bombChance + powerUpChance + goldenChance + 0.3) {
    type = ITEM_TYPES.SHRIMP;
  } else {
    type = ITEM_TYPES.FISH;
  }

  var itemSize = CONFIG.ITEM_SIZE * (type.size || 1);
  var speed = getCurrentSpeed() + Math.random() * 1.5;
  
  // 큰 물고기는 더 느리게
  if (type.rare) speed *= 0.6;

  var item = {
    x: Math.random() * (canvas.width - itemSize),
    y: -itemSize,
    type: type,
    size: itemSize,
    speed: speed,
    rotation: 0,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.03 + Math.random() * 0.04,
  };
  gameState.items.push(item);
}

// ===== 파티클 생성 =====
function createParticles(x, y, color, count) {
  count = count || 8;
  for (var i = 0; i < count; i++) {
    gameState.particles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10 - 3,
      life: 1,
      color: color,
      size: Math.random() * 8 + 3,
      gravity: 0.15 + Math.random() * 0.1,
    });
  }
}

// ===== 점수 팝업 생성 =====
function createPopup(x, y, text, color) {
  gameState.popups.push({
    x: x, y: y,
    text: text,
    color: color || '#FFD700',
    life: 1,
    vy: -2,
  });
}

// ===== 화면 흔들기 =====
function shakeScreen(intensity, duration) {
  gameState.shakeIntensity = intensity;
  gameState.shakeTimer = duration;
}

// ===== 고양이 표정 변경 =====
function setCatExpression(expression, duration) {
  gameState.cat.expression = expression;
  gameState.cat.expressionTimer = duration || 60;
}

// ===== 고양이 그리기 =====
function drawCat(x, y) {
  var centerX = x + CONFIG.CAT_WIDTH / 2;
  var centerY = y + CONFIG.CAT_HEIGHT / 2;
  var expr = gameState.cat.expression;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  
  // 몸통
  ctx.fillStyle = '#FF9F43';
  ctx.beginPath();
  ctx.ellipse(0, 10, 25, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 머리
  ctx.beginPath();
  ctx.arc(0, -10, 20, 0, Math.PI * 2);
  ctx.fill();
  
  // 귀
  ctx.beginPath();
  ctx.moveTo(-15, -25);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-22, -12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(15, -25);
  ctx.lineTo(8, -10);
  ctx.lineTo(22, -12);
  ctx.closePath();
  ctx.fill();
  
  // 귀 안쪽
  ctx.fillStyle = '#FFB8B8';
  ctx.beginPath();
  ctx.moveTo(-14, -22);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-19, -13);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, -22);
  ctx.lineTo(10, -12);
  ctx.lineTo(19, -13);
  ctx.closePath();
  ctx.fill();
  
  // 눈 - 표정에 따라 변경
  ctx.fillStyle = '#333';
  if (expr === 'happy') {
    // 행복한 눈 ( ^ ^ )
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.arc(-8, -12, 5, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, -12, 5, Math.PI, 0);
    ctx.stroke();
  } else if (expr === 'sad') {
    // 슬픈 눈
    ctx.beginPath();
    ctx.ellipse(-8, -10, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -10, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 눈물
    ctx.fillStyle = '#74B9FF';
    ctx.beginPath();
    ctx.ellipse(-12, -5, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === 'excited') {
    // 신난 눈 (★ ★)
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('★', -8, -8);
    ctx.fillText('★', 8, -8);
  } else {
    // 일반 눈
    ctx.beginPath();
    ctx.ellipse(-8, -12, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -12, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 눈 하이라이트
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -14, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -14, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 코
  ctx.fillStyle = '#FFB8B8';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(-3, -2);
  ctx.lineTo(3, -2);
  ctx.closePath();
  ctx.fill();
  
  // 입 - 표정에 따라 변경
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  if (expr === 'happy' || expr === 'excited') {
    ctx.beginPath();
    ctx.arc(0, -2, 6, 0, Math.PI);
    ctx.stroke();
    // 혀
    if (expr === 'excited') {
      ctx.fillStyle = '#FF6B6B';
      ctx.beginPath();
      ctx.ellipse(0, 3, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (expr === 'sad') {
    ctx.beginPath();
    ctx.arc(0, 2, 6, Math.PI, 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-5, 3, -8, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(5, 3, 8, 0);
    ctx.stroke();
  }
  
  // 수염
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-25, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-25, 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(25, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(25, 2); ctx.stroke();
  
  // 꼬리
  ctx.strokeStyle = '#FF9F43';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  var tailWag = Math.sin(gameState.frameCount * 0.15) * 12;
  if (expr === 'excited') tailWag = Math.sin(gameState.frameCount * 0.3) * 18;
  ctx.beginPath();
  ctx.moveTo(20, 15);
  ctx.quadraticCurveTo(35 + tailWag, 0, 30 + tailWag, -15);
  ctx.stroke();
  
  // 특수능력 이펙트
  if (gameState.powerUp) {
    var effectColor;
    if (gameState.powerUp === 'magnet') effectColor = '#E74C3C';
    else if (gameState.powerUp === 'double') effectColor = '#9B59B6';
    else if (gameState.powerUp === 'shield') effectColor = '#3498DB';
    else effectColor = '#FFD700';
    
    ctx.strokeStyle = effectColor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5 + Math.sin(gameState.frameCount * 0.2) * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  
  ctx.restore();
}

// ===== 아이템 그리기 =====
function drawItem(item) {
  ctx.save();
  ctx.translate(item.x + item.size / 2, item.y + item.size / 2);
  ctx.rotate(item.rotation);
  
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  
  ctx.font = item.size + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.type.emoji, 0, 0);
  
  ctx.restore();
}

// ===== 파티클 그리기 =====
function drawParticles() {
  for (var i = 0; i < gameState.particles.length; i++) {
    var p = gameState.particles[i];
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ===== 팝업 그리기 =====
function drawPopups() {
  for (var i = 0; i < gameState.popups.length; i++) {
    var p = gameState.popups[i];
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
}

// ===== 배경 그리기 =====
function drawBackground() {
  var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#87CEEB');
  gradient.addColorStop(0.7, '#98D8C8');
  gradient.addColorStop(1, '#90EE90');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 구름
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  var cloudOffset = (gameState.frameCount * 0.5) % (canvas.width + 100);
  drawCloud(cloudOffset - 50, 50);
  drawCloud((cloudOffset + 200) % (canvas.width + 100) - 50, 100);
  drawCloud((cloudOffset + 400) % (canvas.width + 100) - 50, 30);
  
  // 잔디
  ctx.fillStyle = '#7CCD7C';
  ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
  
  // 잔디 디테일
  ctx.strokeStyle = '#6BBF6B';
  ctx.lineWidth = 2;
  for (var i = 0; i < canvas.width; i += 12) {
    var grassHeight = Math.sin(i * 0.1 + gameState.frameCount * 0.08) * 5 + 10;
    ctx.beginPath();
    ctx.moveTo(i, canvas.height - 30);
    ctx.lineTo(i + 3, canvas.height - 30 - grassHeight);
    ctx.stroke();
  }
}

function drawCloud(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.arc(x + 25, y - 5, 25, 0, Math.PI * 2);
  ctx.arc(x + 50, y, 20, 0, Math.PI * 2);
  ctx.fill();
}

// ===== 충돌 감지 =====
function checkCollision(item) {
  var catCenterX = gameState.cat.x + CONFIG.CAT_WIDTH / 2;
  var catCenterY = gameState.cat.y + CONFIG.CAT_HEIGHT / 2;
  var itemCenterX = item.x + item.size / 2;
  var itemCenterY = item.y + item.size / 2;
  var dx = catCenterX - itemCenterX;
  var dy = catCenterY - itemCenterY;
  var distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (CONFIG.CAT_WIDTH / 2 + item.size / 2) * 0.85;
}

// ===== 아이템 획득 =====
function collectItem(item) {
  var itemCenterX = item.x + item.size / 2;
  var itemCenterY = item.y + item.size / 2;
  
  if (item.type.points === -1) {
    // 폭탄
    if (gameState.powerUp === 'shield') {
      // 방패로 방어!
      createParticles(itemCenterX, itemCenterY, '#3498DB', 15);
      createPopup(itemCenterX, itemCenterY - 20, '방어!', '#3498DB');
      gameState.powerUp = null;
      powerUpIndicator.classList.add('hidden');
    } else {
      gameState.lives--;
      gameState.combo = 0;
      createParticles(itemCenterX, itemCenterY, '#333', 20);
      shakeScreen(8, 15);
      setCatExpression('sad', 90);
      createPopup(itemCenterX, itemCenterY - 20, '💥', '#FF0000');
      
      if (gameState.lives <= 0) {
        gameOver();
        return;
      }
    }
  } else if (item.type.powerUp) {
    gameState.powerUp = item.type.powerUp;
    gameState.powerUpEndTime = Date.now() + CONFIG.POWERUP_DURATION;
    createParticles(itemCenterX, itemCenterY, item.type.color, 15);
    showPowerUpIndicator();
    setCatExpression('excited', 60);
    var powerNames = { magnet: '자석!', double: '2배!', star: '별!', shield: '방패!' };
    createPopup(itemCenterX, itemCenterY - 20, powerNames[item.type.powerUp] || '파워업!', item.type.color);
  } else {
    // 점수 아이템
    var points = item.type.points;
    var now = Date.now();
    
    if (now - gameState.lastComboTime < CONFIG.COMBO_TIMEOUT) {
      gameState.combo++;
    } else {
      gameState.combo = 1;
    }
    gameState.lastComboTime = now;
    gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo);
    
    var comboMultiplier = 1 + (gameState.combo - 1) * 0.25;
    if (gameState.powerUp === 'double') points *= 2;
    points = Math.floor(points * comboMultiplier);
    gameState.score += points;
    gameState.itemsCaught++;
    
    createParticles(itemCenterX, itemCenterY, item.type.color, 10);
    
    // 점수 팝업
    var popupText = '+' + points;
    if (gameState.combo > 3) popupText += ' (x' + gameState.combo + ')';
    createPopup(itemCenterX, itemCenterY - 20, popupText, item.type.color);
    
    // 표정 변경
    if (gameState.combo >= 5) setCatExpression('excited', 40);
    else setCatExpression('happy', 30);
    
    // 레벨업 체크
    var newLevel = Math.floor(gameState.score / CONFIG.LEVEL_UP_SCORE) + 1;
    if (newLevel > gameState.level) {
      gameState.level = newLevel;
      gameState.levelUpTimer = 120;
      createParticles(canvas.width / 2, canvas.height / 2, '#FFD700', 30);
      createPopup(canvas.width / 2, canvas.height / 2 - 50, 'LEVEL UP! Lv.' + gameState.level, '#FFD700');
      shakeScreen(3, 10);
    }
  }
  updateUI();
}

// ===== 특수능력 표시 =====
function showPowerUpIndicator() {
  powerUpIndicator.classList.remove('hidden');
  var icons = { magnet: '🧲', double: '✨', star: '⭐', shield: '🛡️' };
  powerUpIcon.textContent = icons[gameState.powerUp] || '⭐';
}

function updatePowerUpIndicator() {
  if (gameState.powerUp) {
    var remaining = Math.max(0, gameState.powerUpEndTime - Date.now());
    if (remaining <= 0) {
      gameState.powerUp = null;
      powerUpIndicator.classList.add('hidden');
    } else {
      powerUpTime.textContent = Math.ceil(remaining / 1000) + 's';
    }
  }
}

// ===== UI 업데이트 =====
function updateUI() {
  scoreDisplay.textContent = gameState.score;
  livesDisplay.textContent = gameState.lives > 0 ? '❤️'.repeat(gameState.lives) : '💔';
  comboDisplay.textContent = gameState.combo > 1 ? 'x' + gameState.combo : 'x1';
  levelDisplay.textContent = 'Lv.' + gameState.level;
}

// ===== 입력 처리 =====
var inputX = null;
var keys = {};

canvas.addEventListener('mousemove', function(e) {
  var rect = canvas.getBoundingClientRect();
  inputX = e.clientX - rect.left - CONFIG.CAT_WIDTH / 2;
});

canvas.addEventListener('touchmove', function(e) {
  e.preventDefault();
  var rect = canvas.getBoundingClientRect();
  inputX = e.touches[0].clientX - rect.left - CONFIG.CAT_WIDTH / 2;
}, { passive: false });

document.addEventListener('keydown', function(e) { keys[e.key] = true; });
document.addEventListener('keyup', function(e) { keys[e.key] = false; });

// ===== 고양이 이동 =====
function updateCat() {
  var speed = 10;
  if (keys['ArrowLeft'] || keys['a']) gameState.cat.targetX -= speed;
  if (keys['ArrowRight'] || keys['d']) gameState.cat.targetX += speed;
  if (inputX !== null) gameState.cat.targetX = inputX;
  gameState.cat.targetX = Math.max(0, Math.min(canvas.width - CONFIG.CAT_WIDTH, gameState.cat.targetX));
  gameState.cat.x += (gameState.cat.targetX - gameState.cat.x) * 0.25;
  
  // 표정 타이머
  if (gameState.cat.expressionTimer > 0) {
    gameState.cat.expressionTimer--;
    if (gameState.cat.expressionTimer <= 0) {
      gameState.cat.expression = 'normal';
    }
  }
}

// ===== 아이템 업데이트 =====
function updateItems() {
  var magnetRange = gameState.powerUp === 'magnet' ? 180 : 0;
  
  for (var i = gameState.items.length - 1; i >= 0; i--) {
    var item = gameState.items[i];
    
    // 자석 효과
    if (magnetRange > 0 && item.type.points > 0) {
      var dx = (gameState.cat.x + CONFIG.CAT_WIDTH / 2) - (item.x + item.size / 2);
      var dy = (gameState.cat.y + CONFIG.CAT_HEIGHT / 2) - (item.y + item.size / 2);
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < magnetRange) {
        item.x += dx * 0.12;
        item.y += dy * 0.12;
      }
    }
    
    item.y += item.speed;
    item.rotation += 0.02;
    item.wobble += item.wobbleSpeed;
    item.x += Math.sin(item.wobble) * 0.8;
    
    if (checkCollision(item)) {
      collectItem(item);
      gameState.items.splice(i, 1);
      continue;
    }
    
    if (item.y > canvas.height + 50) {
      if (item.type.points > 0) {
        gameState.combo = 0;
        gameState.itemsMissed++;
        updateUI();
      }
      gameState.items.splice(i, 1);
    }
  }
}

// ===== 파티클 업데이트 =====
function updateParticles() {
  for (var i = gameState.particles.length - 1; i >= 0; i--) {
    var p = gameState.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.life -= 0.025;
    if (p.life <= 0) gameState.particles.splice(i, 1);
  }
}

// ===== 팝업 업데이트 =====
function updatePopups() {
  for (var i = gameState.popups.length - 1; i >= 0; i--) {
    var p = gameState.popups[i];
    p.y += p.vy;
    p.life -= 0.02;
    if (p.life <= 0) gameState.popups.splice(i, 1);
  }
}

// ===== 게임 루프 =====
function gameLoop() {
  if (!gameState.running) return;
  
  gameState.frameCount++;
  
  // 아이템 생성
  var spawnRate = getCurrentSpawnRate();
  if (gameState.frameCount % spawnRate === 0) {
    spawnItem();
  }
  
  // 레벨업 타이머
  if (gameState.levelUpTimer > 0) gameState.levelUpTimer--;
  
  // 화면 흔들기
  if (gameState.shakeTimer > 0) gameState.shakeTimer--;
  
  updateCat();
  updateItems();
  updateParticles();
  updatePopups();
  updatePowerUpIndicator();
  
  // 그리기
  ctx.save();
  
  // 화면 흔들기 적용
  if (gameState.shakeTimer > 0) {
    var shakeX = (Math.random() - 0.5) * gameState.shakeIntensity;
    var shakeY = (Math.random() - 0.5) * gameState.shakeIntensity;
    ctx.translate(shakeX, shakeY);
  }
  
  drawBackground();
  
  for (var i = 0; i < gameState.items.length; i++) {
    drawItem(gameState.items[i]);
  }
  
  drawParticles();
  drawCat(gameState.cat.x, gameState.cat.y);
  drawPopups();
  
  // 보 표시
  if (gameState.combo > 2) {
    ctx.save();
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF6B6B';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    var comboText = gameState.combo + ' COMBO!';
    ctx.strokeText(comboText, canvas.width / 2, 120);
    ctx.fillText(comboText, canvas.width / 2, 120);
    ctx.restore();
  }
  
  // 레벨업 이펙트
  if (gameState.levelUpTimer > 0) {
    ctx.save();
    ctx.globalAlpha = gameState.levelUpTimer / 120;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.strokeText('LEVEL UP!', canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillText('LEVEL UP!', canvas.width / 2, canvas.height / 2 - 30);
    ctx.restore();
  }
  
  ctx.restore();
  
  requestAnimationFrame(gameLoop);
}

// ===== 이벤트 리스너 =====
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
homeBtn.addEventListener('click', function() {
  highScoreStart.textContent = gameState.highScore;
  showScreen(startScreen);
});

// ===== 초기화 =====
init();