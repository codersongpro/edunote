import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRANSLATION_LANGUAGES, languageByCode, translateHtml, translateText } from '../translation';

const aiGenerate = vi.fn();

beforeEach(() => {
  aiGenerate.mockReset();
  aiGenerate.mockResolvedValue({ text: '<p>translated</p>' });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerate },
  });
});

const promptOf = (): string => String(aiGenerate.mock.calls[0][0]);

describe('번역 프롬프트', () => {
  it('평문 번역에서 날짜·시간을 도착 언어 표기로 바꾸게 한다', async () => {
    await translateText('2026. 4. 18.(토) 15:30에 시작합니다.', '영어(English)');
    const prompt = promptOf();

    expect(prompt).toContain('영어(English)로 번역하세요');
    expect(prompt).toContain('날짜는 도착 언어의 표기 순서와 월·요일 이름으로 바꿉니다');
    expect(prompt).toContain('시간은 도착 언어에서 흔히 쓰는 형식으로 바꿉니다');
    expect(prompt).toContain('기간과 기한');
  });

  it('기관명·지명은 도착 언어로 옮기고 원문을 괄호로 병기하게 한다', async () => {
    await translateText('충청북도교육청에서 안내합니다.', '베트남어(Tiếng Việt)');
    const prompt = promptOf();

    expect(prompt).toContain('기관명, 학교명, 부서명, 직위는 도착 언어로 옮기고');
    expect(prompt).toContain('괄호 안에 원문 표기를 함께 적습니다');
    expect(prompt).toContain('지명, 주소, 시설 이름도 같은 방식으로 옮기고');
  });

  it('학년·명절·화폐처럼 한쪽 나라에만 있는 표기도 풀어 쓰게 한다', async () => {
    await translateText('3학년 2반, 추석, 5,000원', '영어(English)');

    expect(promptOf()).toContain('학년·반·학기, 명절, 화폐 단위처럼 한쪽 나라에만 있는 표기는');
  });

  it('사람 이름·연락처·숫자는 그대로 두고 없는 정보를 만들지 않게 한다', async () => {
    await translateText('담임 김교사 010-0000-0000', '영어(English)');
    const prompt = promptOf();

    expect(prompt).toContain('사람 이름, 전화번호, 이메일, 웹 주소, 금액·수량의 숫자 자체는 바꾸지 않습니다');
    expect(prompt).toContain('원문에 없는 날짜·시간·장소를 만들지 말고 표기 방식만 바꿉니다');
  });

  it('HTML 번역도 구조를 지키면서 같은 표기 규칙을 따른다', async () => {
    const language = languageByCode('vi')!;
    await translateHtml('<p>2026. 4. 18.(토) 해솔초등학교</p>', language);
    const prompt = promptOf();

    expect(prompt).toContain('베트남어(Tiếng Việt)로 번역하세요');
    expect(prompt).toContain('HTML 태그, 속성, 구조는 그대로 유지하고 텍스트만 번역합니다');
    expect(prompt).toContain('날짜는 도착 언어의 표기 순서와 월·요일 이름으로 바꿉니다');
    // 예전 규칙(학교명·날짜를 그대로 두라는 지시)이 남아 있으면 표기 변환과 충돌한다.
    expect(prompt).not.toContain('학교명, 사람 이름, 날짜, 숫자, 연락처는 번역하지 않고');
  });

  it('외국어 → 한국어 방향에서도 같은 규칙을 쓴다', async () => {
    await translateText('The meeting starts at 3:30 p.m. on April 18, 2026.', '한국어');
    const prompt = promptOf();

    expect(prompt).toContain('한국어로 번역하세요');
    expect(prompt).toContain('날짜는 도착 언어의 표기 순서와 월·요일 이름으로 바꿉니다');
  });

  it('번역 언어 목록과 코드 조회는 그대로 동작한다', () => {
    expect(TRANSLATION_LANGUAGES.length).toBeGreaterThan(0);
    expect(languageByCode('ko')).toBeUndefined();
    expect(languageByCode('en')?.native).toBe('English');
  });
});
