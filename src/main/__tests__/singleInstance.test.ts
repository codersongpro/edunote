import { describe, expect, it } from 'vitest';
import { focusFirstAppWindow, type FocusableWindow } from '../singleInstance';

class WindowState implements FocusableWindow {
  restored = false;
  shown = false;
  focused = false;

  constructor(
    private readonly destroyed: boolean,
    private readonly minimized: boolean,
  ) {}

  isDestroyed(): boolean { return this.destroyed; }
  isMinimized(): boolean { return this.minimized; }
  restore(): void { this.restored = true; }
  show(): void { this.shown = true; }
  focus(): void { this.focused = true; }
}

describe('focusFirstAppWindow', () => {
  it('종료된 창을 건너뛰고 최소화된 첫 앱 창을 복원해 포커스한다', () => {
    const destroyed = new WindowState(true, false);
    const active = new WindowState(false, true);

    expect(focusFirstAppWindow([destroyed, active])).toBe(true);
    expect(destroyed.focused).toBe(false);
    expect(active.restored).toBe(true);
    expect(active.shown).toBe(true);
    expect(active.focused).toBe(true);
  });

  it('사용 가능한 창이 없으면 false를 반환한다', () => {
    expect(focusFirstAppWindow([new WindowState(true, false)])).toBe(false);
  });
});
