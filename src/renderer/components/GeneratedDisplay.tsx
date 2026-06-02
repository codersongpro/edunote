import React, { useRef, useEffect } from 'react';
import { Copy, Download, FileText, Printer, PenLine, AlertTriangle, History, RotateCcw } from 'lucide-react';
import { markdownOrHtmlToHtml } from '../lib/generatedContent';

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

  const getHistoryKey = (): string => {
    const base = title || hwpxData?.["문서제목"] || 'default';
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
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = temp.innerText.trim();
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
    localStorage.setItem(getHistoryKey(), JSON.stringify(nextVersions));
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
    });
    el.querySelectorAll<HTMLElement>('th, td').forEach(cell => {
      if (!cell.style.border) cell.style.border = '1pt solid #333';
      if (!cell.style.padding) cell.style.padding = '5pt 8pt';
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
    
    let success = false;

    // 1. Try modern Clipboard API
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        const htmlBlob = new Blob([currentHtml], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        
        const data = [new ClipboardItem({ 
          "text/html": htmlBlob,
          "text/plain": textBlob 
        })];
        await navigator.clipboard.write(data);
        success = true;
      } catch (err) {
        console.error("Clipboard API failed", err);
      }
    }

    // 2. Fallback to execCommand for older browsers or restricted iframes
    if (!success) {
      try {
        const tempDiv = document.createElement("div");
        tempDiv.contentEditable = "true";
        tempDiv.innerHTML = currentHtml;
        tempDiv.style.position = "fixed";
        tempDiv.style.left = "-9999px";
        document.body.appendChild(tempDiv);
        
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        const execSuccess = document.execCommand("copy");
        
        selection?.removeAllRanges();
        document.body.removeChild(tempDiv);
        
        if (execSuccess) {
          success = true;
        }
      } catch (fallbackErr) {
        console.error("Fallback copy failed", fallbackErr);
      }
    }

    // 3. Final fallback: just copy text
    if (!success && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(plainText);
        success = true;
      } catch (textErr) {
        console.error("Text copy failed", textErr);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert("클립보드 복사에 실패했습니다. 브라우저 설정을 확인해 주세요.");
    }
  };

  const getFormattedFilename = (extension: string): string => {
    const now = new Date();
    const dateStr =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');

    let docTitle = hwpxData?.["문서제목"] || title || contentRef.current?.innerText?.split('\n')[0]?.slice(0, 30) || "draft_document";
    docTitle = docTitle.replace(/[\\/:*?"<>|]/g, "_");

    return `${docTitle}(${dateStr}).${extension}`;
  };


  const handleDownloadHwpx = async () => {
    if (!hwpxTemplate || !hwpxFillData) return;
    setHwpxDownloading(true);
    try {
      const { fillHwpxTemplate } = await import('../lib/hwpx-parser');
      const blob = await fillHwpxTemplate(hwpxTemplate, hwpxFillData);
      await window.electronAPI.saveBuffer(await blob.arrayBuffer(), getFormattedFilename("hwpx"));
    } catch (error) {
      console.error("Failed to merge HWPX file", error);
      alert("HWPX 양식 채우기 중 오류가 발생했습니다.");
    } finally {
      setHwpxDownloading(false);
    }
  };

  const handleDownloadHtml = async () => {
    const currentHtml = getCurrentContent();
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body>${currentHtml}</body></html>`;
    await window.electronAPI.saveFile(fullHtml, getFormattedFilename("html"), "html");
  };

  const handleDownloadWord = async () => {
    const currentHtml = getCurrentContent();
    const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Document</title><style>body { font-family: 'Batang', 'Dotum', sans-serif; } table { border-collapse: collapse; width: 100%; border: 1px solid black; } th, td { border: 1px solid black; padding: 8px; }</style></head><body>${currentHtml}</body></html>`;
    await window.electronAPI.saveFile(fullHtml, getFormattedFilename("doc"), "doc");
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
  const compareLines: string[] = [];

  const handleRestoreVersion = () => {
    if (!selectedVersion || !contentRef.current) return;
    saveGeneratedSnapshot(getCurrentContent());
    contentRef.current.innerHTML = selectedVersion.html || markdownOrHtmlToHtml(selectedVersion.text);
  };

  const handleSavePdf = async () => {
    const currentHtml = getCurrentContent();
    const docTitle = hwpxData?.["문서제목"] || title || contentRef.current?.innerText?.split('\n')[0]?.slice(0, 30) || '문서';
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const filename = `${docTitle.replace(/[\\/:*?"<>|]/g, '_')}(${dateStr}).pdf`;
    const fullHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${docTitle}</title><style>
@page{size:A4;margin:20mm 15mm;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;font-family:'Malgun Gothic','Dotum','Apple SD Gothic Neo',sans-serif;font-size:11pt;color:#000;background:#fff;}
h1{font-size:15pt;margin:0 0 10pt;}h2{font-size:13pt;margin:8pt 0 6pt;}h3{font-size:11pt;margin:6pt 0 4pt;}
p,li{line-height:1.7;margin:0 0 6pt;}
table{width:100%;border-collapse:collapse;page-break-inside:avoid;margin:8pt 0;}
th,td{border:1pt solid #333;padding:5pt 7pt;font-size:10pt;}
section,.section,tr{page-break-inside:avoid;}
h2,h3{page-break-after:avoid;}
</style></head><body>${currentHtml}</body></html>`;
    try {
      await (window.electronAPI as any).savePdf(fullHtml, filename);
    } catch (e) {
      alert('PDF 저장 중 오류가 발생했습니다.');
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
    html = doc.body.innerHTML;
    let md = html;
    // Remove structure tags
    md = md.replace(/<head>[\s\S]*?<\/head>/gi, "");
    md = md.replace(/<style>[\s\S]*?<\/style>/gi, "");
    md = md.replace(/<html>/gi, "").replace(/<\/html>/gi, "");
    md = md.replace(/<body>/gi, "").replace(/<\/body>/gi, "");
    md = md.replace(/<!DOCTYPE html>/gi, "");

    // Basic Text Formatting
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
    
    // Lists
    md = md.replace(/<ul>/gim, '');
    md = md.replace(/<\/ul>/gim, '');
    md = md.replace(/<li>(.*?)<\/li>/gim, '- $1\n');

    // Clean up entities
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&amp;/g, '&');

    // Clean up multiple newlines
    md = md.replace(/\n\s*\n/g, '\n\n');

    return md.trim();
  };

  const handleDownloadMarkdown = async () => {
    const currentHtml = getCurrentContent();
    const mdContent = convertToMarkdown(currentHtml);
    await window.electronAPI.saveFile(mdContent, getFormattedFilename("md"), "md");
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Toolbar / Header */}
      <div className="bg-[#F8F9FA] dark:bg-gray-900 px-4 py-3 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center overflow-x-auto whitespace-nowrap scrollbar-hide">
        <div className="flex items-center gap-2 mr-4">
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          <h2 className="font-bold text-gray-800 dark:text-gray-100 text-base">미리보기 및 편집</h2>
          <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
             <PenLine className="w-3 h-3" />
             수정 가능
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="인쇄"
          >
            <Printer className="w-4 h-4" />
          </button>
          {hwpxTemplate && hwpxFillData && (
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
          <div className="flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
            <select
              value={saveFormat}
              onChange={e => setSaveFormat(e.target.value as typeof saveFormat)}
              className="bg-transparent px-2 py-1 text-xs text-gray-700 dark:text-gray-200 outline-none"
            >
              <option value="pdf">PDF</option>
              <option value="doc">Word/HWP용</option>
              <option value="html">HTML</option>
              <option value="md">Markdown</option>
            </select>
            <button
              onClick={handleSaveByFormat}
              className="inline-flex items-center gap-1 rounded bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              저장
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
            <select
              value={copyFormat}
              onChange={e => setCopyFormat(e.target.value as typeof copyFormat)}
              className="bg-transparent px-2 py-1 text-xs text-gray-700 dark:text-gray-200 outline-none"
            >
              <option value="html">HWP/웹 복사</option>
              <option value="excel">Excel로 복사</option>
              <option value="md">MD로 복사</option>
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
      {/* Editor Viewport */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-8 bg-[#EAECEF] dark:bg-gray-950 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {content && (
          <div className="mx-auto w-full max-w-[100%] sm:max-w-[210mm] mb-3 space-y-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">생성 결과 히스토리</span>
                </div>
                <button
                  onClick={handleSaveCurrentVersion}
                  className="px-3 py-1.5 text-xs font-bold rounded-md border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  현재 버전 저장
                </button>
              </div>
              {savedVersions.length > 0 ? (
                <div className="grid gap-2">
                  <select
                    value={selectedVersionId}
                    onChange={e => setSelectedVersionId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200"
                  >
                    <option value="">되돌릴 이전 버전 선택</option>
                    {savedVersions.map(version => (
                      <option key={version.id} value={version.id}>
                        {new Date(version.createdAt).toLocaleString()} - {version.title}
                      </option>
                    ))}
                  </select>
                  {selectedVersion && (
                    <button
                      type="button"
                      onClick={handleRestoreVersion}
                      className="inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-700 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      이 문서로 되돌리기
                    </button>
                  )}
                  {selectedVersion && (
                    <div className="hidden">
                      <p className="font-bold mb-1">현재 결과에 새로 보이는 문장</p>
                      {compareLines.length > 0 ? (
                        <ul className="space-y-1 list-disc pl-4">
                          {compareLines.map(line => <li key={line}>{line}</li>)}
                        </ul>
                      ) : (
                        <p>선택한 버전과 새 문장 차이가 없습니다.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">현재 결과를 저장하면 다음 생성 결과와 비교하거나 되돌릴 수 있습니다.</p>
              )}
            </div>

            {matchedCautionTerms.length > 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-200">주의어 감지</span>
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
        <div className="mx-auto w-full max-w-[100%] sm:max-w-[210mm] cursor-text print-section"
             style={{ 
               minHeight: "297mm",
               backgroundColor: "white",
               boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
               padding: "20mm",
               fontFamily: "'Dotum', sans-serif",
               wordBreak: "break-word",
               overflowWrap: "break-word"
             }}>
             <div 
                ref={contentRef}
                contentEditable
                suppressContentEditableWarning
                className="prose max-w-none text-black leading-relaxed outline-none focus:outline-none ring-0 w-full"
                style={{ minHeight: "100%", color: "#000000" }}
             />
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 px-4 py-1 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <PenLine className="w-3 h-3" />
          내용을 직접 클릭하여 수정할 수 있습니다.
        </span>
        <span>HTML, Word/HWP용, Markdown 저장 지원</span>
      </div>
    </div>
  );
};
