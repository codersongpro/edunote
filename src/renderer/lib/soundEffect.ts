// Web Audio API 기반 효과음 — 외부 파일 불필요
//
// Electron/Chromium은 사용자 제스처 없이 AudioContext를 만들면 'suspended' 상태로
// 시작합니다. AI 생성은 비동기라 완료 시점엔 제스처 컨텍스트가 만료돼 소리가 막힙니다.
// → 앱 시작 시 첫 사용자 클릭/키 입력에서 AudioContext를 미리 만들어 unlock하고,
//   그 컨텍스트를 재사용해 생성 완료 시 확실히 재생합니다.

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!sharedCtx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      sharedCtx = new Ctor();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

// 앱 시작 시 1회 호출 — 첫 사용자 상호작용에서 오디오 컨텍스트를 깨워둠
export function initAudioUnlock(): void {
  const unlock = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  // once: 첫 상호작용에서 깨운 뒤 리스너가 스스로 제거되도록 한다.
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, unlock, { passive: true, once: true }),
  );
}

export function playSuccessSound(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const play = () => {
    try {
      const now = ctx.currentTime;
      // 도-미-솔-도(높음) 장음계 아르페지오
      const notes = [
        { freq: 523.25, delay: 0,    gain: 0.22 }, // C5
        { freq: 659.25, delay: 0.11, gain: 0.20 }, // E5
        { freq: 783.99, delay: 0.22, gain: 0.18 }, // G5
        { freq: 1046.5, delay: 0.33, gain: 0.16 }, // C6
      ];
      notes.forEach(({ freq, delay, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(g);
        g.connect(ctx.destination);
        const t = now + delay;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
        osc.start(t);
        osc.stop(t + 0.7);
      });
    } catch {
      // 무시
    }
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {});
  } else {
    play();
  }
}
