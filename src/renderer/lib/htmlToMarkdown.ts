const BLOCK_TAGS = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV', 'SECTION', 'ARTICLE',
  'HEADER', 'FOOTER', 'MAIN', 'BLOCKQUOTE', 'UL', 'OL', 'TABLE', 'HR',
]);

const HANGUL_MARKERS = '가나다라마바사아자차카타파하';

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\u00a0/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;
  const tag = element.tagName;
  if (tag === 'BR') return '\n';
  if (tag === 'UL' || tag === 'OL' || tag === 'TABLE') return '';

  const inner = Array.from(element.childNodes).map(inlineMarkdown).join('');
  if ((tag === 'STRONG' || tag === 'B') && inner.trim()) return `**${inner.trim()}**`;
  if ((tag === 'EM' || tag === 'I') && inner.trim()) return `*${inner.trim()}*`;
  if (tag === 'CODE' && inner.trim()) return `\`${inner.trim().replace(/`/g, '\\`')}\``;
  if (tag === 'A') {
    const href = element.getAttribute('href')?.trim();
    return href ? `[${inner.trim() || href}](${href})` : inner;
  }
  return inner;
}

function directInlineMarkdown(nodes: Node[]): string {
  return nodes.map(inlineMarkdown).join('').replace(/[ \t]+\n/g, '\n').trim();
}

function outlineLevel(element: HTMLElement, text: string): number | null {
  const explicit = Number(element.getAttribute('data-outline-level'));
  if (explicit >= 1 && explicit <= 7) return explicit;

  const marginMatch = element.getAttribute('style')?.match(/margin-left\s*:\s*([\d.]+)px/i);
  const margin = Number(marginMatch?.[1]);
  if (margin >= 46) return 4;
  if (margin >= 30) return 3;
  if (margin >= 14) return 2;

  const trimmed = text.trimStart();
  if (/^\d{1,2}\.(?!\d)\s*\S/.test(trimmed)) return 1;
  if (new RegExp(`^[${HANGUL_MARKERS}]\\.\\s*\\S`).test(trimmed)) return 2;
  if (/^\d{1,2}\)\s*\S/.test(trimmed)) return 3;
  if (new RegExp(`^[${HANGUL_MARKERS}]\\)\\s*\\S`).test(trimmed)) return 4;
  if (/^\(\d{1,2}\)\s*\S/.test(trimmed)) return 5;
  if (new RegExp(`^\\([${HANGUL_MARKERS}]\\)\\s*\\S`).test(trimmed)) return 6;
  if (/^[①-⑮㉮-㉻]\s*\S/.test(trimmed)) return 7;
  return null;
}

function renderInlineBlock(element: HTMLElement, nodes: Node[] = Array.from(element.childNodes)): string {
  const text = directInlineMarkdown(nodes);
  if (!text) return '';
  const level = outlineLevel(element, text);
  return `${level ? '  '.repeat(level - 1) : ''}${text}\n\n`;
}

function renderList(list: HTMLOListElement | HTMLUListElement, depth: number): string {
  const ordered = list.tagName === 'OL';
  const parsedStart = Number.parseInt(list.getAttribute('start') ?? '1', 10);
  let number = ordered && Number.isFinite(parsedStart) ? parsedStart : 1;
  const indent = '    '.repeat(depth);
  const lines: string[] = [];

  Array.from(list.children).forEach(child => {
    if (child.tagName !== 'LI') return;
    const item = child as HTMLLIElement;
    if (ordered) {
      const itemValue = Number.parseInt(item.getAttribute('value') ?? '', 10);
      if (Number.isFinite(itemValue)) number = itemValue;
    }
    const inlineNodes = Array.from(item.childNodes).filter(node => {
      return !(node.nodeType === Node.ELEMENT_NODE && ['UL', 'OL'].includes((node as Element).tagName));
    });
    const text = directInlineMarkdown(inlineNodes);
    const hasOwnMarker = /^(?:\d{1,2}[.)]|[가-하][.)]|[•▪‣◦-])\s*/.test(text.trimStart());
    const marker = hasOwnMarker ? '' : ordered ? `${number}. ` : '- ';
    lines.push(`${indent}${marker}${text}`.trimEnd());
    if (ordered) number += 1;

    Array.from(item.children).forEach(nested => {
      if (nested.tagName === 'UL' || nested.tagName === 'OL') {
        lines.push(renderList(nested as HTMLOListElement | HTMLUListElement, depth + 1).trimEnd());
      }
    });
  });

  return `${lines.filter(Boolean).join('\n')}\n\n`;
}

function tableCellText(cell: HTMLTableCellElement): string {
  return directInlineMarkdown(Array.from(cell.childNodes))
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n+\s*/g, ' / ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function renderTable(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr')).filter(row => row.closest('table') === table);
  if (rows.length === 0) return '';
  const occupied: boolean[][] = rows.map(() => []);
  const values: string[][] = rows.map(() => []);
  let width = 0;

  rows.forEach((row, rowIndex) => {
    let column = 0;
    Array.from(row.children).forEach(child => {
      if (child.tagName !== 'TH' && child.tagName !== 'TD') return;
      while (occupied[rowIndex][column]) column += 1;
      const cell = child as HTMLTableCellElement;
      const colSpan = Math.max(1, Number.parseInt(cell.getAttribute('colspan') ?? '1', 10) || 1);
      const rowSpan = Math.max(1, Number.parseInt(cell.getAttribute('rowspan') ?? '1', 10) || 1);
      values[rowIndex][column] = tableCellText(cell);
      for (let rowOffset = 0; rowOffset < rowSpan && rowIndex + rowOffset < rows.length; rowOffset += 1) {
        for (let colOffset = 0; colOffset < colSpan; colOffset += 1) {
          occupied[rowIndex + rowOffset][column + colOffset] = true;
          if (rowOffset > 0 || colOffset > 0) values[rowIndex + rowOffset][column + colOffset] ||= '';
        }
      }
      column += colSpan;
      width = Math.max(width, column);
    });
  });

  const normalized = values.map(row => Array.from({ length: width }, (_, index) => row[index] ?? ''));
  const header = normalized[0];
  const body = normalized.slice(1);
  return `${[
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')}\n\n`;
}

function renderElement(element: HTMLElement): string {
  const tag = element.tagName;
  if (/^H[1-6]$/.test(tag)) {
    const depth = Number(tag.slice(1));
    const text = directInlineMarkdown(Array.from(element.childNodes));
    return text ? `${'#'.repeat(depth)} ${text}\n\n` : '';
  }
  if (tag === 'UL' || tag === 'OL') return renderList(element as HTMLUListElement | HTMLOListElement, 0);
  if (tag === 'TABLE') return renderTable(element as HTMLTableElement);
  if (tag === 'HR') return '---\n\n';
  if (tag === 'BLOCKQUOTE') {
    const text = directInlineMarkdown(Array.from(element.childNodes));
    return text ? `${text.split('\n').map(line => `> ${line}`).join('\n')}\n\n` : '';
  }

  const hasDirectBlock = Array.from(element.children).some(child => BLOCK_TAGS.has(child.tagName));
  if (!hasDirectBlock) return renderInlineBlock(element);

  const output: string[] = [];
  let inlineNodes: Node[] = [];
  const flushInline = () => {
    if (inlineNodes.length > 0) output.push(renderInlineBlock(element, inlineNodes));
    inlineNodes = [];
  };
  Array.from(element.childNodes).forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((child as Element).tagName)) {
      flushInline();
      output.push(renderElement(child as HTMLElement));
    } else {
      inlineNodes.push(child);
    }
  });
  flushInline();
  return output.join('');
}

export function convertHtmlToMarkdown(html: string): string {
  if (!String(html ?? '').trim() || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const markdown = Array.from(doc.body.childNodes).map(node => {
    if (node.nodeType === Node.ELEMENT_NODE) return renderElement(node as HTMLElement);
    return (node.textContent ?? '').trim();
  }).join('');

  return markdown
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
