// 무료 등급 분당 요청 제한(15회/분) 대응 — AI 호출 간 최소 간격을 보장한다.
// 일괄 생성(학생 30명 등)에서 호출이 몰리면 429가 연쇄 발생하므로,
// 메인 프로세스에서 전역으로 호출 시작 시점을 직렬화해 간격을 띄운다.
export class RequestPacer {
  private gate: Promise<void> = Promise.resolve();
  private lastStartedAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  // 다음 호출 차례를 예약한다. 앞 예약들이 모두 간격을 확보한 뒤에 resolve된다.
  reserve(): Promise<void> {
    const reserved = this.gate.then(async () => {
      const wait = this.lastStartedAt + this.minIntervalMs - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      this.lastStartedAt = Date.now();
    });
    // 한 예약이 실패해도 다음 예약이 막히지 않도록 한다.
    this.gate = reserved.catch(() => {});
    return reserved;
  }
}
