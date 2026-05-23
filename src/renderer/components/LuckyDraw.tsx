import React, { useState, useRef, useCallback } from 'react';
import { Trophy, Users, History, Trash2, RotateCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface DrawRecord {
  id: string;
  topic: string;
  winners: string[];
  drawnAt: number;
}

const HISTORY_KEY = 'eduNote_luckyDraw_history_v1';

function loadHistory(): DrawRecord[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(records: DrawRecord[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
}

// ── Audio ──────────────────────────────────────────────────────────────────

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return _ctx;
}

function playTick(pitch = 700): void {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = pitch;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.045);
  } catch { /* ignore */ }
}

function playReveal(): void {
  try {
    const ctx = getCtx();
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.11;
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'triangle'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.3);
    });
    const ct = ctx.currentTime + 0.48;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.45, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    src.connect(g2); g2.connect(ctx.destination); src.start(ct);
  } catch { /* ignore */ }
}

function playFinalFanfare(): void {
  try {
    const ctx = getCtx();
    const melody = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.50];
    const durs = [0.14, 0.14, 0.14, 0.1, 0.1, 0.42];
    let t = ctx.currentTime + 0.05;
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'triangle'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.38, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + durs[i]);
      osc.start(t); osc.stop(t + durs[i]);
      t += durs[i] + 0.02;
    });
    // Cymbal crash at end
    const ct = t - 0.1;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g2 = ctx.createGain(); g2.gain.value = 0.2;
    src.connect(g2); g2.connect(ctx.destination); src.start(ct);
  } catch { /* ignore */ }
}

// ── Confetti ───────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; w: number; h: number; rot: number; rs: number; g: number;
}

function launchConfetti(canvas: HTMLCanvasElement): void {
  const ctx2 = canvas.getContext('2d');
  if (!ctx2) return;
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F40', '#FF6384'];
  const particles: Particle[] = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: canvas.height * 0.55,
    vx: (Math.random() - 0.5) * 12,
    vy: -(Math.random() * 16 + 8),
    color: colors[Math.floor(Math.random() * colors.length)],
    w: Math.random() * 12 + 5, h: Math.random() * 7 + 3,
    rot: Math.random() * 360, rs: (Math.random() - 0.5) * 18,
    g: 0.3 + Math.random() * 0.25,
  }));
  let frame = 0;
  const maxFrames = 220;
  function animate() {
    if (frame++ > maxFrames) { ctx2!.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx2!.clearRect(0, 0, canvas.width, canvas.height);
    const alpha = Math.max(0, 1 - frame / maxFrames);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.99; p.rot += p.rs;
      ctx2!.save();
      ctx2!.translate(p.x, p.y);
      ctx2!.rotate((p.rot * Math.PI) / 180);
      ctx2!.fillStyle = p.color;
      ctx2!.globalAlpha = alpha;
      ctx2!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx2!.restore();
    });
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseNames(text: string): string[] {
  return text.split(/[\n,;、]+/).map(s => s.trim()).filter(s => s.length > 0);
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Component ──────────────────────────────────────────────────────────────

type Phase = 'idle' | 'spinning' | 'done';

const SPIN_INTERVALS = [55, 60, 65, 75, 90, 110, 140, 175, 215, 270, 330];

const LuckyDraw: React.FC = () => {
  const [namesText, setNamesText] = useState('');
  const [maleNamesText, setMaleNamesText] = useState('');
  const [femaleNamesText, setFemaleNamesText] = useState('');
  const [genderMode, setGenderMode] = useState(false);
  const [count, setCount] = useState(1);
  const [maleCount, setMaleCount] = useState(1);
  const [femaleCount, setFemaleCount] = useState(1);
  const [topic, setTopic] = useState('');
  const [excludeDrawn, setExcludeDrawn] = useState(true);

  const [phase, setPhase] = useState<Phase>('idle');
  const [displayName, setDisplayName] = useState('');
  const [winners, setWinners] = useState<string[]>([]);

  const [sessionPool, setSessionPool] = useState<string[] | null>(null);
  const [sessionMalePool, setSessionMalePool] = useState<string[] | null>(null);
  const [sessionFemalePool, setSessionFemalePool] = useState<string[] | null>(null);

  const [history, setHistory] = useState<DrawRecord[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const handleDraw = useCallback(async () => {
    if (drawingRef.current) return;

    let selected: string[];
    let allNames: string[];

    if (genderMode) {
      const mPool = (excludeDrawn && sessionMalePool !== null) ? sessionMalePool : parseNames(maleNamesText);
      const fPool = (excludeDrawn && sessionFemalePool !== null) ? sessionFemalePool : parseNames(femaleNamesText);
      const mSel = pickRandom(mPool, maleCount);
      const fSel = pickRandom(fPool, femaleCount);
      selected = [...mSel, ...fSel];
      allNames = [...parseNames(maleNamesText), ...parseNames(femaleNamesText)];
      if (excludeDrawn) {
        setSessionMalePool(mPool.filter(n => !mSel.includes(n)));
        setSessionFemalePool(fPool.filter(n => !fSel.includes(n)));
      }
    } else {
      const pool = (excludeDrawn && sessionPool !== null) ? sessionPool : parseNames(namesText);
      selected = pickRandom(pool, count);
      allNames = parseNames(namesText);
      if (excludeDrawn) setSessionPool(pool.filter(n => !selected.includes(n)));
    }

    if (selected.length === 0 || allNames.length === 0) return;

    drawingRef.current = true;
    setPhase('spinning');
    setWinners([]);

    const revealed: string[] = [];

    for (let wi = 0; wi < selected.length; wi++) {
      const winner = selected[wi];
      for (let step = 0; step < SPIN_INTERVALS.length; step++) {
        setDisplayName(allNames[Math.floor(Math.random() * allNames.length)]);
        playTick(780 - step * 45);
        await sleep(SPIN_INTERVALS[step]);
      }
      setDisplayName(winner);
      playReveal();
      revealed.push(winner);
      setWinners([...revealed]);
      if (wi < selected.length - 1) await sleep(550);
    }

    setPhase('done');
    playFinalFanfare();
    if (canvasRef.current) launchConfetti(canvasRef.current);

    const record: DrawRecord = {
      id: Date.now().toString(),
      topic: topic || '이름 뽑기',
      winners: selected,
      drawnAt: Date.now(),
    };
    setHistory(prev => {
      const updated = [record, ...prev].slice(0, 100);
      saveHistory(updated);
      return updated;
    });

    drawingRef.current = false;
  }, [
    genderMode, namesText, maleNamesText, femaleNamesText,
    count, maleCount, femaleCount, topic, excludeDrawn,
    sessionPool, sessionMalePool, sessionFemalePool,
  ]);

  const resetSession = () => {
    setSessionPool(null); setSessionMalePool(null); setSessionFemalePool(null);
    setWinners([]); setPhase('idle'); setDisplayName('');
  };

  const clearHistory = () => { setHistory([]); saveHistory([]); };

  const remainingCount = genderMode
    ? (sessionMalePool ?? parseNames(maleNamesText)).length + (sessionFemalePool ?? parseNames(femaleNamesText)).length
    : (sessionPool ?? parseNames(namesText)).length;

  const hasNames = genderMode ? (maleNamesText || femaleNamesText) : namesText;
  const isSessionActive = sessionPool !== null || sessionMalePool !== null || sessionFemalePool !== null;

  const inputCls = 'w-full bg-white rounded-lg border border-gray-300 text-gray-800 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none p-2.5 transition-all';
  const labelCls = 'block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide';

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] overflow-hidden relative">
      {/* Confetti canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-50"
        style={{ width: '100%', height: '100%' }}
      />

      <div className="flex flex-1 overflow-hidden p-3 gap-3 relative z-10">

        {/* ── Left: Input panel ────────────────────────── */}
        <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Names */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-orange-500 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-gray-800 text-sm">학생 이름</span>
              </div>
              <button
                onClick={async () => {
                  const [allNames, maleNames, femaleNames] = await Promise.all([
                    window.electronAPI.getConfig('studentNames'),
                    window.electronAPI.getConfig('studentMaleNames'),
                    window.electronAPI.getConfig('studentFemaleNames'),
                  ]);
                  const hasMale = maleNames && typeof maleNames === 'string' && maleNames.trim();
                  const hasFemale = femaleNames && typeof femaleNames === 'string' && femaleNames.trim();
                  if (hasMale || hasFemale) {
                    // 성별 구분 명단이 있으면 gender mode로 자동 전환
                    const mList = hasMale ? (maleNames as string).split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).join('\n') : '';
                    const fList = hasFemale ? (femaleNames as string).split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).join('\n') : '';
                    setMaleNamesText(mList);
                    setFemaleNamesText(fList);
                    setGenderMode(true);
                    setSessionMalePool(null);
                    setSessionFemalePool(null);
                  } else if (allNames && typeof allNames === 'string' && allNames.trim()) {
                    // 번호 제거 (예: "1. 홍길동" → "홍길동")
                    const list = (allNames as string).split(/[\n,]+/)
                      .map((s: string) => s.trim().replace(/^\d+[\.\)]\s*/, ''))
                      .filter(Boolean).join('\n');
                    setNamesText(list);
                    setGenderMode(false);
                    setSessionPool(null);
                  }
                }}
                className="text-[10px] font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-0.5 rounded transition-colors"
                title="설정에서 저장한 우리 반 학생 이름을 자동으로 불러옵니다"
              >
                우리반 자동 입력
              </button>
            </div>

            {/* Gender toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setGenderMode(g => !g)}
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${genderMode ? 'bg-orange-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${genderMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-gray-600 font-medium">남/녀 구분</span>
            </label>

            {genderMode ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-bold text-blue-500 mb-0.5 block">남학생</label>
                  <textarea
                    className={`${inputCls} min-h-[70px] resize-none text-xs`}
                    placeholder="이름 (줄바꿈 또는 쉼표 구분)"
                    value={maleNamesText}
                    onChange={e => { setMaleNamesText(e.target.value); setSessionMalePool(null); }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-pink-500 mb-0.5 block">여학생</label>
                  <textarea
                    className={`${inputCls} min-h-[70px] resize-none text-xs`}
                    placeholder="이름 (줄바꿈 또는 쉼표 구분)"
                    value={femaleNamesText}
                    onChange={e => { setFemaleNamesText(e.target.value); setSessionFemalePool(null); }}
                  />
                </div>
              </div>
            ) : (
              <textarea
                className={`${inputCls} min-h-[130px] resize-none text-sm`}
                placeholder={`이름을 입력하세요.\n(줄바꿈 또는 쉼표 구분)\n\n예:\n홍길동\n김철수\n이영희`}
                value={namesText}
                onChange={e => { setNamesText(e.target.value); setSessionPool(null); }}
              />
            )}
          </div>

          {/* Settings */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-3">
            <span className="font-bold text-gray-800 text-sm">뽑기 설정</span>

            <div>
              <label className={labelCls}>주제 (선택)</label>
              <input type="text" className={inputCls} placeholder="발표자, 청소 당번..." value={topic} onChange={e => setTopic(e.target.value)} />
            </div>

            {genderMode ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-blue-500 mb-0.5 block uppercase tracking-wide">남학생 수</label>
                  <input type="number" min={0} max={50} className={inputCls} value={maleCount} onChange={e => setMaleCount(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-pink-500 mb-0.5 block uppercase tracking-wide">여학생 수</label>
                  <input type="number" min={0} max={50} className={inputCls} value={femaleCount} onChange={e => setFemaleCount(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>
            ) : (
              <div>
                <label className={labelCls}>뽑을 인원</label>
                <input type="number" min={1} max={50} className={inputCls} value={count} onChange={e => setCount(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludeDrawn}
                onChange={e => setExcludeDrawn(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-300"
              />
              <span className="text-sm text-gray-600">뽑힌 학생 이후 제외</span>
            </label>

            {isSessionActive && (
              <div className="flex items-center justify-between text-xs bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                <span className="text-gray-600">남은 학생: <strong className="text-orange-600">{remainingCount}명</strong></span>
                <button onClick={resetSession} className="flex items-center gap-1 text-orange-600 hover:text-orange-700 font-bold">
                  <RotateCcw className="w-3 h-3" />초기화
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Draw display ───────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Main draw area */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center gap-5 p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 to-amber-50/30 pointer-events-none" />

            {phase === 'idle' ? (
              <div className="flex flex-col items-center gap-3 text-center z-10">
                <div className="text-8xl select-none">🎲</div>
                <p className="text-gray-400 text-sm leading-relaxed">이름과 설정을 입력하고<br />뽑기를 시작하세요!</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 z-10 w-full">
                {topic && (
                  <span className="text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200 px-4 py-1.5 rounded-full">
                    🎯 {topic}
                  </span>
                )}

                {/* Spinning card */}
                <div className={`flex items-center justify-center rounded-2xl shadow-xl border-4 px-10 py-7 min-w-[260px] transition-all duration-150 ${
                  phase === 'spinning'
                    ? 'border-orange-400 bg-gradient-to-br from-orange-400 to-amber-500'
                    : 'border-yellow-400 bg-gradient-to-br from-yellow-400 to-orange-500'
                }`}>
                  <span className="text-5xl font-black text-white drop-shadow-lg tracking-widest select-none">
                    {displayName || '?'}
                  </span>
                </div>

                {/* Winner chips */}
                {winners.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-3">
                    {winners.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-xl px-5 py-2.5 shadow-lg"
                        style={{ animation: 'luckyPop 0.45s cubic-bezier(0.175,0.885,0.32,1.275)' }}
                      >
                        <Trophy className="w-4 h-4" />
                        <span className="font-black text-xl">{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Draw button */}
            <button
              onClick={handleDraw}
              disabled={phase === 'spinning' || !hasNames}
              className={`z-10 px-12 py-4 rounded-2xl text-lg font-black tracking-wider shadow-lg transition-all active:scale-95 ${
                phase === 'spinning'
                  ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-orange-300/60 hover:shadow-xl'
              }`}
            >
              {phase === 'spinning' ? '🎲 뽑는 중...' : phase === 'done' ? '🔄 다시 뽑기' : '🎲 뽑기 시작!'}
            </button>
          </div>

          {/* History section */}
          <button
            onClick={() => setShowHistory(s => !s)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <History className="w-4 h-4 text-gray-400" />
            <span>뽑기 기록</span>
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 ml-1">{history.length}</span>
            <span className="ml-auto text-gray-400 text-xs">{showHistory ? '▲' : '▼'}</span>
          </button>

          {showHistory && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-h-56 flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100 shrink-0">
                <span className="text-sm font-bold text-gray-700">뽑기 기록</span>
                <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-semibold">
                  <Trash2 className="w-3 h-3" />전체 삭제
                </button>
              </div>
              <div className="overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">기록이 없습니다.</p>
                ) : (
                  history.map(r => (
                    <div key={r.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <Trophy className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-bold text-gray-700">{r.topic}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(r.drawnAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-orange-600 font-semibold">{r.winners.join(', ')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes luckyPop {
          0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          80%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LuckyDraw;
