// 생성 중단 신호를 화면(modeKey) 단위로 관리한다.
// 이전에는 앱 전체가 AbortController 하나를 공유해서 한 화면의 중단이
// 다른 화면의 생성까지 끊었지만, 이제 각 화면이 자기 신호만 중단한다.
export class CancellationRegistry {
  private controllers = new Map<string, AbortController>();

  // 해당 키의 현재 신호를 돌려준다. 이미 중단된 신호면 새로 만든다.
  signalFor(key: string): AbortSignal {
    let controller = this.controllers.get(key);
    if (!controller || controller.signal.aborted) {
      controller = new AbortController();
      this.controllers.set(key, controller);
    }
    return controller.signal;
  }

  // 해당 키의 진행 중인 호출만 중단한다. 다음 signalFor는 새 신호를 받는다.
  cancel(key: string): void {
    const controller = this.controllers.get(key);
    if (controller) controller.abort();
    this.controllers.delete(key);
  }

  // 모든 키의 호출을 중단한다 (앱 단위 초기화용).
  cancelAll(): void {
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
  }
}
