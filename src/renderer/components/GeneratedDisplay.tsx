import React, { useEffect, useRef } from 'react';
import { notifyToast } from '../lib/toast';
import { AlertTriangle, Copy, Download, FileText, History, PenLine, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { extractPlainText, markdownOrHtmlToHtml } from '../lib/generatedContent';
import { sanitizeHtml } from '../lib/security';
import { safeSetItem } from '../lib/safeStorage';

export interface HwpxTemplateData {
  [key: string]: string;
}

interface GeneratedDisplayProps {
  content: string;
  hwpxData?: HwpxTemplateData;
  hwpxFillData?: any[] | null;
  hwpxTemplate?: File;
  title?: string;
}

interface SavedGeneratedVersion {
  id: string;
  title: string;
  html?: string;
  text: string;
  createdAt: string;
}

const RESULT_HISTORY_KEY_PREFIX = 'edunote_generated_document_history_v1_';
const selectClassName = 'bg-white px-2 py-1 text-xs font-semibold text-[#1C1917] outline-none dark:bg-white dark:text-[#1C1917]';
const optionClassName = 'bg-white text-[#1C1917]';

export const GeneratedDisplay: React.FC<GeneratedDisplayProps> = ({ content, hwpxData, hwpxFillData, hwpxTemplate, title }) => {
  const [copied, setCopied] = React.useState(false);
  const [hwpxDownloading, setHwpxDownloading] = React.useState(false);
  const [cautionTerms, setCautionTerms] = React.useState<string[]>([]);
  const [matchedCautionTerms, setMatchedCautionTerms] = React.useState<string[]>([]);
  const [savedVersions, setSavedVersions] = React.useState<SavedGeneratedVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = React.useState('');
  const [copyFormat, setCopyFormat] = React.useState<'html' | 'excel' | 'md'>('html');
  const [saveFormat, setSaveFormat] = React.useState<'pdf' | 'doc' | 'html' | 'md'>('pdf');
  const contentRef = useRef<HTMLDivElement>(null);

  const getPlainText = (): string => {
    const currentHtml = contentRef.current?.innerHTML || content;
    return contentRef.current?.innerText || currentHtml.replace(/<[^>]*>?/gm, '');
  };

  const sanitizeFilenamePart = (value: string): string => {
    return value
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  };

  const getDocumentTitle = (): string => {
    const currentHtml = contentRef.current?.innerHTML || content;
    const doc = new DOMParser().parseFromString(markdownOrHtmlToHtml(currentHtml), 'text/html');
    const plainText = doc.body.innerText || '';
    const titleLabels = ['\uBB38\uC11C\uC81C\uBAA9', '\uC81C\uBAA9', '\uC8FC\uC694\uB0B4\uC6A9'];
    const labeledTitle = plainText
      .split(/\r?\n/)
      .map(line => line.trim())
      .map(line => {
        const label = titleLabels.find(item => line.startsWith(`${item}:`) || line.startsWith(`${item}\uFF1A`));
        return label ? line.slice(label.length + 1).trim() : '';
      })
      .find(Boolean);
    const headingTitle = doc.querySelector('h1, h2')?.textContent?.trim();
    const candidate = hwpxData?.['\uBB38\uC11C\uC81C\uBAA9'] || hwpxData?.['\uC81C\uBAA9'] || hwpxData?.['\uC8FC\uC694\uB0B4\uC6A9'] || labeledTitle || headingTitle || title || '\uC0DD\uC131\uBB38\uC11C';
    return sanitizeFilenamePart(candidate) || '\uC0DD\uC131\uBB38\uC11C';
  };

  const getShortDate = (): string => {
    const now = new Date();
    return `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  };

  const getFormattedFilename = (extension: string): string => {
    return `(${getShortDate()})_${getDocumentTitle()}.${extension}`;
  };

  const getHistoryKey = (): string => {
    const base = title || hwpxData?.['\uBB38\uC11C\uC81C\uBAA9'] || hwpxData?.['\uC81C\uBAA9'] || hwpxData?.['\uC8FC\uC694\uB0B4\uC6A9'] || 'default';
    return `${RESULT_HISTORY_KEY_PREFIX}${encodeURIComponent(base.slice(0, 80))}`;
  };

  const loadSavedVersions = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(getHistoryKey());
      const parsed = raw ? JSON.parse(raw) : [];
      const versions = Array.isArray(parsed)
        ? parsed.map((version: Partial<SavedGeneratedVersion>) => ({
            ...version,
            html: version.html || markdownOrHtmlToHtml(version.text || ''),
          })) as SavedGeneratedVersion[]
        : [];
      setSavedVersions(versions.slice(0, 8));
    } catch {
      setSavedVersions([]);
    }
  }, [title, hwpxData]);

  const saveGeneratedSnapshot = (html: string) => {
    const text = extractPlainText(html);
    if (!text) return;

    let versions: SavedGeneratedVersion[] = [];
    try {
      const raw = localStorage.getItem(getHistoryKey());
      const parsed = raw ? JSON.parse(raw) : [];
      versions = Array.isArray(parsed) ? parsed : [];
    } catch {
      versions = [];
    }

    if (versions[0]?.html === html) {
      setSavedVersions(versions.slice(0, 8));
      return;
    }

    const now = new Date();
    const next: SavedGeneratedVersion = {
      id: `${now.getTime()}`,
      title: title || text.slice(0, 24) || '생성 문서',
      html,
      text,
      createdAt: now.toISOString(),
    };
    const nextVersions = [next, ...versions.filter(version => version.html !== html)].slice(0, 8);
    safeSetItem(getHistoryKey(), JSON.stringify(nextVersions));
    setSavedVersions(nextVersions);
  };

  useEffect(() => {
    window.electronAPI.getConfig('cautionTerms')
      .then(termsValue => {
        const terms = String(termsValue || '')
          .split(/\r?\n|,/)
          .map(term => term.trim())
          .filter(Boolean);
        setCautionTerms(Array.from(new Set(terms)));
      })
      .catch(() => {
        setCautionTerms([]);
      });
    loadSavedVersions();
  }, [loadSavedVersions]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !content) return;
    const cleanContent = markdownOrHtmlToHtml(content);
    saveGeneratedSnapshot(cleanContent);
    el.innerHTML = cleanContent;

    el.querySelectorAll<HTMLTableElement>('table').forEach(table => {
      if (!table.style.borderCollapse) table.style.borderCollapse = 'collapse';
      if (!table.style.width) table.style.width = '100%';
      if (!table.style.margin) table.style.margin = '10pt 0 14pt';
    });
    el.querySelectorAll<HTMLElement>('th, td').forEach(cell => {
      if (!cell.style.border) cell.style.border = '1pt solid #333';
      if (!cell.style.padding) cell.style.padding = '8pt 10pt';
      if (!cell.style.verticalAlign) cell.style.verticalAlign = 'middle';
    });
    el.querySelectorAll<HTMLElement>('h1').forEach(h1 => {
      if (!h1.style.textAlign) h1.style.textAlign = 'center';
    });
    el.querySelectorAll<HTMLElement>('.student-info').forEach(div => {
      div.style.display = 'flex';
      div.style.gap = '16pt';
      div.style.justifyContent = 'flex-end';
      if (!div.style.borderBottom) div.style.borderBottom = '1pt solid #000';
      if (!div.style.paddingBottom) div.style.paddingBottom = '3pt';
      if (!div.style.marginBottom) div.style.marginBottom = '6pt';
    });
    el.querySelectorAll<HTMLElement>('.student-info .fill, .fill').forEach(span => {
      span.style.display = 'inline-block';
      if (!span.style.minWidth) span.style.minWidth = '50pt';
      if (!span.style.borderBottom) span.style.borderBottom = '1pt solid #333';
    });
  }, [content]);

  useEffect(() => {
    const text = getPlainText();
    setMatchedCautionTerms(cautionTerms.filter(term => text.includes(term)));
  }, [content, cautionTerms]);

  const getCurrentContent = (): string => {
    return markdownOrHtmlToHtml(contentRef.current?.innerHTML || content);
  };

  const handleCopy = async () => {
    const currentHtml = getCurrentContent();
    const plainText = getPlainText();
    await copyHtmlToClipboard(currentHtml, plainText);
  };

  const copyHtmlToClipboard = async (currentHtml: string, plainText: string) => {
    let success = false;

    if (navigator.clipboard && window.ClipboardItem) {
      try {
        const htmlBlob = new Blob([currentHtml], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
        success = true;
      } catch (err) {
        console.error('Clipboard API failed', err);
      }
    }

    if (!success) {
      try {
        const tempDiv = document.createElement('div');
        tempDiv.contentEditable = 'true';
        tempDiv.innerHTML = currentHtml;
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        selection?.removeAllRanges();
        selection?.addRange(range);
        const execSuccess = document.execCommand('copy');
        selection?.removeAllRanges();
        document.body.removeChild(tempDiv);
        success = execSuccess;
      } catch (fallbackErr) {
        console.error('Fallback copy failed', fallbackErr);
      }
    }

    if (!success && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(plainText);
        success = true;
      } catch (textErr) {
        console.error('Text copy failed', textErr);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      notifyToast({ type: 'error', title: '클립보드 복사에 실패했습니다. 브라우저 설정을 확인해 주세요.' });
    }
  };

  const getHangulOptimizedHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(markdownOrHtmlToHtml(html), 'text/html');
    const body = doc.body;
    const fontFamily = "'Malgun Gothic', 'Batang', 'Dotum', sans-serif";

    body.style.margin = '0';
    body.style.padding = '18mm 16mm';
    body.style.fontFamily = fontFamily;
    body.style.fontSize = '11pt';
    body.style.lineHeight = '1.7';
    body.style.color = '#000000';
    body.style.backgroundColor = '#ffffff';

    body.querySelectorAll<HTMLElement>('h1').forEach(el => {
      el.style.fontFamily = fontFamily;
      el.style.fontSize = '16pt';
      el.style.fontWeight = '700';
      el.style.textAlign = el.style.textAlign || 'center';
      el.style.lineHeight = '1.5';
      el.style.margin = '0 0 12pt 0';
      el.style.color = '#000000';
    });

    body.querySelectorAll<HTMLElement>('h2').forEach(el => {
      el.style.fontFamily = fontFamily;
      el.style.fontSize = '13pt';
      el.style.fontWeight = '700';
      el.style.lineHeight = '1.5';
      el.style.margin = '10pt 0 6pt 0';
      el.style.color = '#000000';
    });

    body.querySelectorAll<HTMLElement>('h3').forEach(el => {
      el.style.fontFamily = fontFamily;
      el.style.fontSize = '11pt';
      el.style.fontWeight = '700';
      el.style.lineHeight = '1.5';
      el.style.margin = '8pt 0 4pt 0';
      el.style.color = '#000000';
    });

    body.querySelectorAll<HTMLElement>('p, div, section, article, li').forEach(el => {
      el.style.fontFamily = fontFamily;
      el.style.fontSize = '11pt';
      el.style.lineHeight = '1.7';
      el.style.color = '#000000';
      if (el.tagName.toLowerCase() === 'p') el.style.margin = '0 0 8pt 0';
      if (el.tagName.toLowerCase() === 'li') el.style.margin = '0 0 3pt 0';
    });

    body.querySelectorAll<HTMLElement>('ul, ol').forEach(el => {
      el.style.margin = '0 0 6pt 18pt';
      el.style.padding = '0';
    });

    body.querySelectorAll<HTMLTableElement>('table').forEach(table => {
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.tableLayout = 'fixed';
      table.style.margin = '10pt 0 14pt 0';
      table.style.border = '1pt solid #000000';
    });

    body.querySelectorAll<HTMLElement>('th, td').forEach(cell => {
      cell.style.border = '1pt solid #000000';
      cell.style.padding = '8pt 10pt';
      cell.style.fontFamily = fontFamily;
      cell.style.fontSize = '10pt';
      cell.style.lineHeight = '1.5';
      cell.style.color = '#000000';
      cell.style.verticalAlign = 'middle';
      if (!cell.style.textAlign) cell.style.textAlign = cell.tagName.toLowerCase() === 'th' ? 'center' : 'left';
    });

    body.querySelectorAll<HTMLElement>('th').forEach(cell => {
      cell.style.fontWeight = '700';
      cell.style.backgroundColor = '#f2f2f2';
    });

    body.querySelectorAll<HTMLElement>('strong, b').forEach(el => {
      el.style.fontWeight = '700';
      el.style.color = '#000000';
    });

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm 16mm;}body{box-sizing:border-box;}</style></head><body>${body.innerHTML}</body></html>`;
  };

  const handleDownloadHwpx = async () => {
    if (!hwpxTemplate || !hwpxFillData) return;
    setHwpxDownloading(true);
    try {
      const { fillHwpxTemplate } = await import('../lib/hwpx-parser');
      const blob = await fillHwpxTemplate(hwpxTemplate, hwpxFillData);
      await window.electronAPI.saveBuffer(await blob.arrayBuffer(), getFormattedFilename('hwpx'));
    } catch (error) {
      console.error('Failed to merge HWPX file', error);
      notifyToast({ type: 'error', title: 'HWPX 양식 채우기 중 오류가 발생했습니다.' });
    } finally {
      setHwpxDownloading(false);
    }
  };

  const handleDownloadHtml = async () => {
    const currentHtml = getCurrentContent();
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title><style>@page{size:A4;margin:18mm 16mm;}body{margin:0;padding:18mm 16mm;font-family:'Malgun Gothic','Dotum',sans-serif;line-height:1.7;color:#000;background:#fff;word-break:keep-all;overflow-wrap:break-word;}table{width:100%;border-collapse:collapse;margin:10pt 0 14pt;}th,td{border:1pt solid #333;padding:8pt 10pt;vertical-align:middle;}</style></head><body>${currentHtml}</body></html>`;
    await window.electronAPI.saveFile(fullHtml, getFormattedFilename('html'), 'html');
  };

  const handleDownloadWord = async () => {
    const currentHtml = getCurrentContent();
    const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Document</title><style>@page{size:A4;margin:18mm 16mm;}body{margin:0;padding:18mm 16mm;font-family:'Batang','Dotum',sans-serif;line-height:1.7;word-break:keep-all;overflow-wrap:break-word;}table{border-collapse:collapse;width:100%;border:1px solid black;margin:10pt 0 14pt;}th,td{border:1px solid black;padding:8pt 10pt;vertical-align:middle;}</style></head><body>${currentHtml}</body></html>`;
    await window.electronAPI.saveFile(fullHtml, getFormattedFilename('doc'), 'doc');
  };

  const handlePrint = () => {
    window.print();
  };

  const htmlToExcelText = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));
    if (tables.length === 0) return doc.body.innerText.trim();

    return tables.map(table => Array.from(table.querySelectorAll('tr'))
      .map(row => Array.from(row.querySelectorAll('th,td'))
        .map(cell => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .join('\t'))
      .join('\n')).join('\n\n');
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyByFormat = async () => {
    const currentHtml = getCurrentContent();
    if (copyFormat === 'excel') {
      await copyText(htmlToExcelText(currentHtml));
      return;
    }
    if (copyFormat === 'md') {
      await copyText(convertToMarkdown(currentHtml));
      return;
    }
    await handleCopy();
  };

  const handleSaveByFormat = async () => {
    if (saveFormat === 'pdf') await handleSavePdf();
    else if (saveFormat === 'doc') await handleDownloadWord();
    else if (saveFormat === 'html') await handleDownloadHtml();
    else await handleDownloadMarkdown();
  };

  const handleSaveCurrentVersion = () => {
    saveGeneratedSnapshot(contentRef.current?.innerHTML || markdownOrHtmlToHtml(content));
  };

  const selectedVersion = savedVersions.find(version => version.id === selectedVersionId) || null;
  // localStorage에 저장된 버전 HTML은 외부에서 변조될 수 있으므로 렌더 직전에 다시 소독한다.
  const selectedVersionPreviewHtml = selectedVersion
    ? sanitizeHtml(selectedVersion.html || markdownOrHtmlToHtml(selectedVersion.text))
    : '';

  const handleRestoreVersion = () => {
    if (!selectedVersion || !contentRef.current) return;
    saveGeneratedSnapshot(getCurrentContent());
    contentRef.current.innerHTML = sanitizeHtml(selectedVersion.html || markdownOrHtmlToHtml(selectedVersion.text));
    setSelectedVersionId('');
  };

  const handleDeleteVersion = () => {
    if (!selectedVersion) return;
    const next = savedVersions.filter(v => v.id !== selectedVersion.id);
    safeSetItem(getHistoryKey(), JSON.stringify(next));
    setSavedVersions(next);
    setSelectedVersionId('');
  };

  const handleSavePdf = async () => {
    const currentHtml = getCurrentContent();
    const docTitle = getDocumentTitle();
    const filename = getFormattedFilename('pdf');
    const fullHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${docTitle}</title><style>
@page{size:A4;margin:18mm 16mm;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;font-family:'Malgun Gothic','Dotum','Apple SD Gothic Neo',sans-serif;font-size:11pt;color:#000;background:#fff;word-break:keep-all;overflow-wrap:break-word;}
h1{font-size:15pt;margin:0 0 10pt;}h2{font-size:13pt;margin:8pt 0 6pt;}h3{font-size:11pt;margin:6pt 0 4pt;}
p,li{line-height:1.75;margin:0 0 8pt;}
table{width:100%;border-collapse:collapse;page-break-inside:avoid;margin:10pt 0 14pt;}
th,td{border:1pt solid #333;padding:8pt 10pt;font-size:10pt;vertical-align:middle;}
section,.section,tr{page-break-inside:avoid;}
h2,h3{page-break-after:avoid;}
</style></head><body>${currentHtml}</body></html>`;
    try {
      await (window.electronAPI as any).savePdf(fullHtml, filename);
    } catch {
      notifyToast({ type: 'error', title: 'PDF 저장 중 오류가 발생했습니다.' });
    }
  };

  const convertToMarkdown = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('table').forEach(table => {
      const rows = Array.from(table.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('th,td')).map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim())
      ).filter(row => row.length > 0);
      if (rows.length === 0) return;
      const width = Math.max(...rows.map(row => row.length));
      const normalized = rows.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
      const header = normalized[0];
      const body = normalized.slice(1);
      const mdTable = [
        `| ${header.join(' | ')} |`,
        `| ${header.map(() => '---').join(' | ')} |`,
        ...body.map(row => `| ${row.join(' | ')} |`),
      ].join('\n');
      table.replaceWith(doc.createTextNode(`\n${mdTable}\n`));
    });
    doc.querySelectorAll('li').forEach(li => {
      li.replaceWith(doc.createTextNode(`- ${(li.textContent || '').trim()}\n`));
    });
    doc.querySelectorAll('br').forEach(br => br.replaceWith(doc.createTextNode('\n')));

    let md = doc.body.innerHTML;
    md = md.replace(/<head>[\s\S]*?<\/head>/gi, '');
    md = md.replace(/<style>[\s\S]*?<\/style>/gi, '');
    md = md.replace(/<html>/gi, '').replace(/<\/html>/gi, '');
    md = md.replace(/<body>/gi, '').replace(/<\/body>/gi, '');
    md = md.replace(/<!DOCTYPE html>/gi, '');
    md = md.replace(/<h1>(.*?)<\/h1>/gim, '# $1\n');
    md = md.replace(/<h2>(.*?)<\/h2>/gim, '## $1\n');
    md = md.replace(/<h3>(.*?)<\/h3>/gim, '### $1\n');
    md = md.replace(/<strong>(.*?)<\/strong>/gim, '$1');
    md = md.replace(/<b>(.*?)<\/b>/gim, '$1');
    md = md.replace(/<br\s*\/?>/gim, '\n');
    md = md.replace(/<\/div>/gim, '\n');
    md = md.replace(/<div>/gim, '');
    md = md.replace(/<p>/gim, '');
    md = md.replace(/<\/p>/gim, '\n\n');
    md = md.replace(/<ul>/gim, '');
    md = md.replace(/<\/ul>/gim, '');
    md = md.replace(/<li>(.*?)<\/li>/gim, '- $1\n');
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/\n\s*\n/g, '\n\n');
    return md.trim();
  };

  const handleDownloadMarkdown = async () => {
    const currentHtml = getCurrentContent();
    const mdContent = convertToMarkdown(currentHtml);
    await window.electronAPI.saveFile(mdContent, getFormattedFilename('md'), 'md');
  };

  return (
    <div className="bg-white dark:bg-[#221E1B] rounded-lg shadow-sm border border-[#E7E5E4] dark:border-[#2E2822] flex flex-col h-full overflow-hidden">
      <div className="bg-[#FAF9F7] dark:bg-[#171210] px-4 py-3 border-b border-[#E7E5E4] dark:border-[#2E2822] flex justify-between items-center overflow-x-auto whitespace-nowrap scrollbar-hide">
        <div className="flex items-center gap-2 mr-4">
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          <h2 className="font-bold text-[#1C1917] dark:text-[#F0EBE6] text-base">미리보기 및 편집</h2>
          <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            <PenLine className="w-3 h-3" />
            수정 가능
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="p-1.5 text-[#78716C] dark:text-[#9C8F87] hover:text-[#1C1917] dark:hover:text-[#F0EBE6] hover:bg-[#EDE8E1] dark:hover:bg-[#2E2822] rounded transition-colors"
            title="인쇄"
          >
            <Printer className="w-4 h-4" />
          </button>
          {false && hwpxTemplate && hwpxFillData && (
            <button
              onClick={handleDownloadHwpx}
              disabled={hwpxDownloading}
              className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              title="업로드한 HWPX 양식에 현재 데이터를 채워 저장"
            >
              <Download className="w-3.5 h-3.5" />
              {hwpxDownloading ? '저장 중' : 'HWPX 양식 저장'}
            </button>
          )}
          <div className="flex items-center gap-1 rounded-md border border-[#E7E5E4] dark:border-[#2E2822] bg-white p-1 shadow-sm">
            <select
              value={saveFormat}
              onChange={e => setSaveFormat(e.target.value as typeof saveFormat)}
              className={selectClassName}
              style={{ colorScheme: 'light' }}
            >
              <option className={optionClassName} value="pdf">PDF</option>
              <option className={optionClassName} value="doc">Word/HWP용</option>
              <option className={optionClassName} value="html">HTML</option>
              <option className={optionClassName} value="md">Markdown</option>
            </select>
            <button
              onClick={handleSaveByFormat}
              className="inline-flex items-center gap-1 rounded bg-[#44403C] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#1C1917]"
            >
              <Download className="w-3.5 h-3.5" />
              저장
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-[#E7E5E4] dark:border-[#2E2822] bg-white p-1 shadow-sm">
            <select
              value={copyFormat}
              onChange={e => setCopyFormat(e.target.value as typeof copyFormat)}
              className={selectClassName}
              style={{ colorScheme: 'light' }}
            >
              <option className={optionClassName} value="html">HWP/웹 복사</option>
              <option className={optionClassName} value="excel">Excel로 복사</option>
              <option className={optionClassName} value="md">MD로 복사</option>
            </select>
            <button
              onClick={handleCopyByFormat}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-bold text-white ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-8 bg-[#EAECEF] dark:bg-[#13100E] scrollbar-thin scrollbar-thumb-[#D6CFC7] dark:scrollbar-thumb-[#3A332D] scrollbar-track-transparent">
        {content && (
          <div className="mx-auto w-full max-w-[100%] sm:max-w-[210mm] mb-3 space-y-3">
            <div className="bg-white dark:bg-[#171210] border border-[#EDE8E1] dark:border-[#2E2822] rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#78716C]" />
                  <span className="text-sm font-bold text-[#44403C] dark:text-[#C4B8B0]">{'\uC0DD\uC131 \uACB0\uACFC \uD788\uC2A4\uD1A0\uB9AC'}</span>
                </div>
                <button
                  onClick={handleSaveCurrentVersion}
                  className="px-3 py-1.5 text-xs font-bold rounded-md border border-[#E7E5E4] text-[#44403C] bg-[#FAF9F7] hover:bg-[#EDE8E1] dark:border-[#2E2822] dark:text-[#C4B8B0] dark:bg-[#171210] dark:hover:bg-[#221E1B]"
                >
                  {'\uD604\uC7AC \uBC84\uC804 \uC800\uC7A5'}
                </button>
              </div>
              {savedVersions.length > 0 ? (
                <div className="grid gap-2">
                  <select
                    value={selectedVersionId}
                    onChange={e => setSelectedVersionId(e.target.value)}
                    className="w-full rounded-md border border-[#E7E5E4] bg-white px-2 py-1.5 text-xs font-semibold text-[#1C1917] outline-none dark:bg-white dark:text-[#1C1917]"
                    style={{ colorScheme: 'light' }}
                  >
                    <option className={optionClassName} value="">{'\uC774\uC804 \uBC84\uC804 \uBBF8\uB9AC\uBCF4\uAE30 \uC120\uD0DD'}</option>
                    {savedVersions.map(version => (
                      <option className={optionClassName} key={version.id} value={version.id}>
                        {new Date(version.createdAt).toLocaleString()} - {version.title}
                      </option>
                    ))}
                  </select>
                  {selectedVersion && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRestoreVersion}
                        className="inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#44403C] text-xs font-bold text-white hover:bg-[#1C1917] dark:bg-[#2E2822] dark:hover:bg-[#6B5E57]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {'\uC774 \uBB38\uC11C\uB85C \uB418\uB3CC\uB9AC\uAE30'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteVersion}
                        className="inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-xs font-bold text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {'\uC774 \uBC84\uC804 \uC0AD\uC81C'}
                      </button>
                      <span className="text-xs text-[#78716C] dark:text-[#9C8F87]">
                        {'\uC120\uD0DD\uD55C \uC774\uC804 \uBC84\uC804\uC740 \uC544\uB798\uC5D0 \uBBF8\uB9AC\uBCF4\uAE30\uB85C\uB9CC \uD45C\uC2DC\uB429\uB2C8\uB2E4.'}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">{'\uD604\uC7AC \uACB0\uACFC\uB97C \uC800\uC7A5\uD558\uBA74 \uB2E4\uC74C \uC0DD\uC131 \uACB0\uACFC\uC640 \uBE44\uAD50\uD558\uAC70\uB098 \uB418\uB3CC\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</p>
              )}
            </div>

            {matchedCautionTerms.length > 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
                <div
                  className="flex items-center gap-2 mb-2"
                  title="설정에 등록한 사용자 주의어/금지 표현이 생성 결과에 포함되었는지 알려주는 안내입니다. 실제 사용 전 문맥에 맞게 표현을 직접 확인해 주세요."
                >
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-200">주의어 감지</span>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-rose-300 text-[10px] font-bold text-rose-600 dark:border-rose-700 dark:text-rose-200">
                    ?
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {matchedCautionTerms.map(term => (
                    <span key={term} className="px-2 py-0.5 rounded-full bg-white dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-200">
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div
          className={`mx-auto w-full max-w-[100%] sm:max-w-[210mm] print-section ${selectedVersion ? 'cursor-default' : 'cursor-text'}`}
          style={{
            minHeight: '297mm',
            backgroundColor: 'white',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            padding: '22mm 18mm',
            fontFamily: "'Dotum', sans-serif",
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
          }}
        >
          {selectedVersion && (
            <div
              key="history-preview"
              className="prose max-w-none text-black leading-relaxed w-full"
              style={{ minHeight: '100%', color: '#000000' }}
              dangerouslySetInnerHTML={{ __html: selectedVersionPreviewHtml }}
            />
          )}
          <div
            key="current-editor"
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            className={selectedVersion ? 'hidden' : 'prose max-w-none text-black leading-relaxed outline-none focus:outline-none ring-0 w-full'}
            style={{ minHeight: '100%', color: '#000000' }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#171210] border-t border-[#E7E5E4] dark:border-[#2E2822] px-4 py-1 flex justify-between items-center text-xs text-[#78716C] dark:text-[#9C8F87]">
        <span className="flex items-center gap-1">
          <PenLine className="w-3 h-3" />
          {'\uB0B4\uC6A9\uC744 \uC9C1\uC811 \uD074\uB9AD\uD558\uC5EC \uC218\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
        </span>
        <span>{'HTML, Word/HWP\uC6A9, Markdown \uC800\uC7A5 \uC9C0\uC6D0'}</span>
      </div>
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 16mm; }
          body { background: #fff !important; }
          .print-section {
            box-shadow: none !important;
            border: 0 !important;
            max-width: none !important;
            min-height: auto !important;
            padding: 0 !important;
          }
          .print-section table { margin: 10pt 0 14pt !important; }
          .print-section th,
          .print-section td { padding: 8pt 10pt !important; vertical-align: middle !important; }
        }
      `}</style>
    </div>
  );
};
