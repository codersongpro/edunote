import { CustomTool } from '../types';

const TIMER_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>수업 타이머</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      overflow: hidden;
    }
    .app {
      width: 100%;
      max-width: 520px;
      padding: 32px 24px;
      text-align: center;
      position: relative;
    }
    .activity-name {
      font-size: 1.6em;
      font-weight: 700;
      color: #e0e0ff;
      margin-bottom: 28px;
      border: none;
      background: transparent;
      text-align: center;
      width: 100%;
      outline: none;
      cursor: text;
      border-bottom: 2px solid rgba(255,255,255,0.15);
      padding: 6px 8px;
      transition: border-color 0.2s;
      letter-spacing: 0.02em;
    }
    .activity-name:focus { border-color: rgba(255,255,255,0.5); }
    .activity-name::placeholder { color: rgba(255,255,255,0.3); }
    .timer-ring {
      position: relative;
      width: 240px;
      height: 240px;
      margin: 0 auto 32px;
    }
    .timer-ring svg {
      transform: rotate(-90deg);
      width: 240px;
      height: 240px;
    }
    .ring-bg { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 10; }
    .ring-fg {
      fill: none;
      stroke: #4fc3f7;
      stroke-width: 10;
      stroke-linecap: round;
      stroke-dasharray: 691;
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 0.5s linear, stroke 0.4s;
    }
    .ring-fg.warning { stroke: #ffa726; }
    .ring-fg.danger  { stroke: #ef5350; }
    .timer-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    .timer-display {
      font-size: 3.8em;
      font-weight: 700;
      letter-spacing: 0.05em;
      line-height: 1;
      color: #fff;
      transition: color 0.4s;
    }
    .timer-display.warning { color: #ffa726; }
    .timer-display.danger  { color: #ef5350; }
    .timer-label {
      font-size: 0.75em;
      color: rgba(255,255,255,0.45);
      margin-top: 4px;
    }

    /* 입력 영역 */
    .time-inputs {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 28px;
    }
    .time-inputs label { font-size: 0.85em; color: rgba(255,255,255,0.5); }
    .time-inputs input {
      width: 68px;
      padding: 8px 4px;
      font-size: 1.4em;
      font-weight: 700;
      text-align: center;
      background: rgba(255,255,255,0.1);
      border: 1.5px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      color: #fff;
      outline: none;
      transition: border-color 0.2s;
      -moz-appearance: textfield;
    }
    .time-inputs input::-webkit-outer-spin-button,
    .time-inputs input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .time-inputs input:focus { border-color: #4fc3f7; }
    .time-inputs input:disabled { opacity: 0.4; cursor: not-allowed; }
    .time-sep { font-size: 1.8em; font-weight: 700; color: rgba(255,255,255,0.5); line-height: 1; }

    /* 버튼들 */
    .btn-row {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn {
      padding: 12px 24px;
      font-size: 1em;
      font-weight: 700;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.15s, opacity 0.15s;
      min-width: 80px;
    }
    .btn:active { transform: scale(0.95); }
    .btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .btn-start  { background: #4caf50; color: #fff; }
    .btn-pause  { background: #ffa726; color: #fff; }
    .btn-reset  { background: rgba(255,255,255,0.12); color: #ddd; }
    .btn-fs     { background: rgba(255,255,255,0.12); color: #ddd; font-size: 0.9em; }

    .done-banner {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      align-items: center;
      justify-content: center;
      flex-direction: column;
      z-index: 100;
      animation: fadeIn 0.3s;
    }
    .done-banner.show { display: flex; }
    .done-banner h2 { font-size: 2.5em; color: #fff; margin-bottom: 16px; }
    .done-banner p  { color: rgba(255,255,255,0.7); font-size: 1.1em; margin-bottom: 28px; }
    .btn-close { background: #4fc3f7; color: #fff; padding: 12px 36px; font-size: 1em; font-weight: 700; border: none; border-radius: 12px; cursor: pointer; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
    .pulsing { animation: pulse 0.8s infinite; }
  </style>
</head>
<body>
<div class="app" id="app">
  <input class="activity-name" id="activityName" type="text"
    placeholder="활동 이름을 입력하세요" maxlength="30" value="수업 활동 타이머" />

  <div class="timer-ring">
    <svg viewBox="0 0 240 240">
      <circle class="ring-bg" cx="120" cy="120" r="110" />
      <circle class="ring-fg" id="ringFg" cx="120" cy="120" r="110" />
    </svg>
    <div class="timer-text">
      <div class="timer-display" id="timerDisplay">05:00</div>
      <div class="timer-label" id="timerLabel">준비</div>
    </div>
  </div>

  <div class="time-inputs" id="timeInputs">
    <label>분</label>
    <input type="number" id="inputMin" value="5" min="0" max="99" />
    <span class="time-sep">:</span>
    <label>초</label>
    <input type="number" id="inputSec" value="0" min="0" max="59" />
  </div>

  <div class="btn-row">
    <button class="btn btn-start" id="btnStart" onclick="startTimer()">시작</button>
    <button class="btn btn-pause" id="btnPause" onclick="pauseTimer()" style="display:none">일시정지</button>
    <button class="btn btn-reset" onclick="resetTimer()">초기화</button>
    <button class="btn btn-fs"   onclick="toggleFullscreen()">전체화면</button>
  </div>
</div>

<div class="done-banner" id="doneBanner">
  <h2>⏰ 시간 종료!</h2>
  <p id="doneName"></p>
  <button class="btn-close" onclick="closeBanner()">확인</button>
</div>

<script>
  const CIRCUMFERENCE = 2 * Math.PI * 110; // ≈ 691.15
  let totalSec = 0, remaining = 0, timer = null, paused = false;
  let audioCtx = null;

  const display  = document.getElementById('timerDisplay');
  const label    = document.getElementById('timerLabel');
  const ring     = document.getElementById('ringFg');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const inputMin = document.getElementById('inputMin');
  const inputSec = document.getElementById('inputSec');
  const banner   = document.getElementById('doneBanner');

  function fmt(s) {
    const m = Math.floor(s / 60), ss = s % 60;
    return String(m).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
  }

  function updateRing() {
    const pct = totalSec > 0 ? remaining / totalSec : 1;
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
    const cls = remaining <= 10 ? 'danger' : remaining <= 30 ? 'warning' : '';
    ring.className = 'ring-fg' + (cls ? ' ' + cls : '');
    display.className = 'timer-display' + (cls ? ' ' + cls : '');
  }

  function startTimer() {
    if (paused) { resume(); return; }
    const m = parseInt(inputMin.value) || 0;
    const s = parseInt(inputSec.value) || 0;
    totalSec = remaining = m * 60 + s;
    if (totalSec <= 0) return;
    document.getElementById('timeInputs').querySelectorAll('input').forEach(i => i.disabled = true);
    btnStart.style.display = 'none';
    btnPause.style.display = '';
    label.textContent = '진행 중';
    display.classList.remove('pulsing');
    tick();
    timer = setInterval(tick, 1000);
  }

  function tick() {
    display.textContent = fmt(remaining);
    updateRing();
    if (remaining <= 0) { finish(); return; }
    remaining--;
  }

  function pause() {
    clearInterval(timer); timer = null; paused = true;
    btnPause.textContent = '재개'; label.textContent = '일시정지';
  }
  function resume() {
    paused = false; btnPause.textContent = '일시정지'; label.textContent = '진행 중';
    timer = setInterval(tick, 1000);
  }
  function pauseTimer() { paused ? resume() : pause(); }

  function resetTimer() {
    clearInterval(timer); timer = null; paused = false;
    remaining = 0; totalSec = 0;
    display.textContent = fmt(parseInt(inputMin.value||0) * 60 + parseInt(inputSec.value||0));
    display.className = 'timer-display';
    ring.className = 'ring-fg';
    ring.style.strokeDashoffset = 0;
    label.textContent = '준비';
    display.classList.remove('pulsing');
    btnStart.textContent = '시작'; btnStart.style.display = '';
    btnPause.style.display = 'none';
    document.getElementById('timeInputs').querySelectorAll('input').forEach(i => i.disabled = false);
    banner.classList.remove('show');
  }

  function finish() {
    clearInterval(timer); timer = null;
    display.textContent = '00:00';
    label.textContent = '완료!';
    display.classList.add('pulsing');
    btnStart.textContent = '다시 시작'; btnStart.style.display = ''; btnPause.style.display = 'none';
    document.getElementById('timeInputs').querySelectorAll('input').forEach(i => i.disabled = false);
    playBell();
    const name = document.getElementById('activityName').value || '활동';
    document.getElementById('doneName').textContent = '"' + name + '" 시간이 끝났습니다.';
    setTimeout(() => banner.classList.add('show'), 300);
  }

  function closeBanner() { banner.classList.remove('show'); }

  function playBell() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      [[880,0],[1320,0.04],[2200,0.08],[440,0.12]].forEach(([freq, delay]) => {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.35, now + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.8);
        osc.start(now + delay);
        osc.stop(now + delay + 2);
      });
    } catch(e) {}
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen
        || document.documentElement.mozRequestFullScreen).call(document.documentElement);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen).call(document);
    }
  }

  // 입력 변경 시 display 실시간 갱신
  [inputMin, inputSec].forEach(el => el.addEventListener('input', () => {
    if (!timer && !paused) {
      const m = parseInt(inputMin.value)||0, s = parseInt(inputSec.value)||0;
      display.textContent = fmt(m*60+s);
      ring.style.strokeDashoffset = 0;
    }
  }));

  // AudioContext 초기화 (첫 클릭 시)
  document.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }, { once: true });
</script>
</body>
</html>`;

export const SAMPLE_TOOLS: CustomTool[] = [
  {
    id: 'sample-timer',
    name: '수업 타이머',
    description: '활동 이름 입력 후 시간을 설정하고 시작하면 카운트다운. 시간 종료 시 벨 소리와 팝업. 전체화면 지원.',
    category: 'lesson',
    toolType: 'html-app',
    inputs: [],
    promptTemplate: '',
    htmlContent: TIMER_HTML,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'sample-feedback',
    name: '과제 피드백 생성기',
    description: '학생 과제를 첨부하면 맞춤형 피드백을 자동으로 작성합니다.',
    category: 'student',
    inputs: [
      { id: 'student_name', label: '학생 이름', type: 'text', placeholder: '예: 홍길동' },
      { id: 'subject', label: '과목/단원', type: 'text', placeholder: '예: 수학 3단원' },
      { id: 'assignment', label: '과제 파일 또는 사진', type: 'file-upload' },
    ],
    promptTemplate: `다음 학생의 과제에 대한 교육적 피드백을 작성해줘.
학생: {{student_name}} / 과목·단원: {{subject}}
잘한 점, 개선할 점, 격려의 말을 포함해서 친절하게 작성해줘.`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'sample-cert',
    name: '이수증 연수번호 수집기',
    description: '이수증 파일이나 사진을 올리면 성명·연수명·이수번호 등을 자동 추출합니다. 최대 10장을 한 번에 올릴 수 있습니다.',
    category: 'admin',
    inputs: [
      {
        id: 'cert_file',
        label: '이수증 파일 또는 사진 (최대 10개)',
        type: 'file-upload',
        placeholder: 'PDF·사진·HWPX 모두 가능, Ctrl+V 붙여넣기도 됩니다.',
      },
    ],
    promptTemplate: `첨부된 이수증에서 연수 정보를 추출하여 표 하나로 정리해줘.
이수증이 여러 장이면 모두 한 표에 포함해줘.

| 성명 | 연수명 | 이수 날짜 | 이수 시간(h) | 연수 기관 | 연수번호 |
없는 항목은 '-'로 표시해줘.
(결과는 표 형식으로만 출력. 엑셀·구글 시트에 복사해서 바로 붙여넣기 가능하도록 정리해줘.)
결과 표는 성명 열을 기준으로 가나다 오름차순으로 정렬해줘.
`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
