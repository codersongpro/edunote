import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { convertHtmlToMarkdown } from '../htmlToMarkdown';

type MarkdownNode = { type?: string; depth?: number; value?: string; children?: MarkdownNode[] };

const collectTypes = (node: MarkdownNode, type: string, out: MarkdownNode[] = []): MarkdownNode[] => {
  if (node.type === type) out.push(node);
  node.children?.forEach(child => collectTypes(child, type, out));
  return out;
};

describe('HTML Markdown 변환', () => {
  it('속성이 있는 제목·문단·강조·줄바꿈을 Markdown으로 바꾸고 HTML 태그를 남기지 않는다', () => {
    const markdown = convertHtmlToMarkdown(
      '<h1 style="font-size:22pt">큰 제목</h1>'
      + '<h2 data-outline-level="1"><span style="color:red">작은 제목</span></h2>'
      + '<p style="margin-left:14px">첫 줄<br><strong>강조 문장</strong></p>',
    );

    expect(markdown).toContain('# 큰 제목');
    expect(markdown).toContain('## 작은 제목');
    expect(markdown).toContain('첫 줄\n**강조 문장**');
    expect(markdown).not.toMatch(/<\/?(?:h\d|p|div|span|strong)\b/i);
    expect(markdown).not.toContain('style=');
    expect(markdown).not.toContain('data-outline-level');
  });

  it('순서 목록의 시작 번호와 개별 값을 보존하며 중첩 항목을 한 번씩 변환한다', () => {
    const markdown = convertHtmlToMarkdown(
      '<ol start="3">'
      + '<li>셋째 항목</li>'
      + '<li value="7">일곱째 항목<ul><li>하위 항목</li></ul></li>'
      + '<li>여덟째 항목</li>'
      + '</ol>',
    );

    expect(markdown).toContain('3. 셋째 항목');
    expect(markdown).toContain('7. 일곱째 항목');
    expect(markdown).toContain('  - 하위 항목');
    expect(markdown).toContain('8. 여덟째 항목');
    expect(markdown.match(/하위 항목/g)).toHaveLength(1);

    const tree = unified().use(remarkParse).parse(markdown) as MarkdownNode;
    expect(collectTypes(tree, 'list')).toHaveLength(2);
    expect(collectTypes(tree, 'listItem')).toHaveLength(4);
  });

  it('한국식 말머리의 원문 기호와 단계 관계를 읽을 수 있게 유지한다', () => {
    const markdown = convertHtmlToMarkdown(
      '<h2 style="font-size:16pt">1. 운영 방법</h2>'
      + '<div style="margin-left:14px">가. 대상별 안내</div>'
      + '<div style="margin-left:30px">1) 안내 자료 확인</div>'
      + '<div style="margin-left:46px">가) 제출 항목 점검</div>',
    );

    expect(markdown).toContain('## 1. 운영 방법');
    expect(markdown).toContain('  가. 대상별 안내');
    expect(markdown).toContain('    1) 안내 자료 확인');
    expect(markdown).toContain('      가) 제출 항목 점검');
  });

  it('표 셀의 파이프와 줄바꿈을 한 행 안에서 안전하게 표현한다', () => {
    const markdown = convertHtmlToMarkdown(
      '<table><tr><th>항목</th><th>내용</th></tr>'
      + '<tr><td>기호 | 확인</td><td>첫 줄<br>둘째 줄</td></tr>'
      + '<tr><td colspan="2">병합 내용</td></tr></table>',
    );

    expect(markdown).toContain('| 기호 \\| 확인 | 첫 줄 / 둘째 줄 |');
    expect(markdown).toContain('| 병합 내용 |  |');
    expect(markdown).not.toContain('<br');
    const tableLines = markdown.split('\n').filter(line => line.startsWith('|'));
    expect(tableLines).toHaveLength(4);
  });
});
