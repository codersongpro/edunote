// Web Audio API 기반 기분 좋은 효과음 — 외부 파일 불필요
//
// Electron(Chromium 124+)에서 AudioContext는 사용자 제스처 없이 생성 시
// 'suspended' 상태로 시작합니다. resume() 후 노트를 재생해야 소리가 납니다.

export function playSuccessSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playNotes = () => {
      const now = ctx.currentTime;
      // 도-미-솔-도(높음) 장음계 아르페지오 — 기분 좋은 상행 화음
      const notes = [
        { freq: 523.25, delay: 0,    gain: 0.22 }, // C5
        { freq: 659.25, delay: 0.11, gain: 0.20 }, // E5
        { freq: 783.99, delay: 0.22, gain: 0.18 }, // G5
        { freq: 1046.5, delay: 0.33, gain: 0.16 }, // C6
      ];
      notes.forEach(({ freq, delay, gain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        const start = now + delay;
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(gain, start + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + 0.65);
        osc.start(start);
        osc.stop(start + 0.7);
      });
      setTimeout(() => ctx.close().catch(() => {}), 3000);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(playNotes).catch(() => {});
    } else {
      playNotes();
    }
  } catch {
    // Web Audio API 미지원 환경 무시
  }
}
