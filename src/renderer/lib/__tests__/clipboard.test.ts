import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyPlainTextToClipboard } from '../clipboard';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

const setClipboard = (value: { writeText: (text: string) => Promise<void> } | undefined) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value,
  });
};

const setExecCommand = (value: (command: string) => boolean) => {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else delete (navigator as { clipboard?: Clipboard })?.clipboard;
  if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand);
  else delete (document as { execCommand?: Document['execCommand'] }).execCommand;
});

describe('copyPlainTextToClipboard', () => {
  it('클립보드 API가 거부되면 textarea 대체 경로로 탭 구분 텍스트를 복사한다', async () => {
    const excelText = '이름\t점수\n김하늘\t95';
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard permission denied'));
    setClipboard({ writeText });
    setExecCommand((command) => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[data-edunote-clipboard-fallback]');
      expect(command).toBe('copy');
      expect(textarea?.value).toBe(excelText);
      return true;
    });

    await expect(copyPlainTextToClipboard(excelText)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(excelText);
    expect(document.querySelector('textarea[data-edunote-clipboard-fallback]')).toBeNull();
  });

  it('클립보드 API가 성공하면 대체 요소를 만들지 않는다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    setClipboard({ writeText });
    setExecCommand(execCommand);

    await expect(copyPlainTextToClipboard('한 줄')).resolves.toBe(true);
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelector('textarea[data-edunote-clipboard-fallback]')).toBeNull();
  });

  it('두 복사 경로가 모두 실패하면 false를 반환하고 임시 요소를 제거한다', async () => {
    setClipboard(undefined);
    setExecCommand(() => false);

    await expect(copyPlainTextToClipboard('복사할 내용')).resolves.toBe(false);
    expect(document.querySelector('textarea[data-edunote-clipboard-fallback]')).toBeNull();
  });
});
