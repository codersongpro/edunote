// Web Audio API 기반 기분 좋은 효과음 — 외부 파일 불필요
// main 프로세스에서 autoplay-policy=no-user-gesture-required 설정으로 즉시 재생 가능

export function playSuccessSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const play = () => {
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
      setTimeout(() => ctx.close().catch(() => {}), 3000);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch {
    // Web Audio API 미지원 환경 무시
  }
}
