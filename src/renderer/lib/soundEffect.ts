// Web Audio API 기반 기분 좋은 효과음 — 외부 파일 불필요

export function playSuccessSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  } catch {
    // Web Audio API 미지원 환경 무시
  }
}
