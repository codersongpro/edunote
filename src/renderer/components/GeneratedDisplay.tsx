import React, { useRef, useEffect } from 'react';
import { Copy, Download, FileText, Printer, FileType, PenLine, FileDown, RefreshCw, ShieldCheck, AlertTriangle, History, RotateCcw } from 'lucide-react';
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
  const [rewriting, setRewriting] = React.useState<string | null>(null);
  const [reviewChecklistEnabled] = React.useState(false);
  const [cautionTerms, setCautionTerms] = React.useState<string[]>([]);
  const [matchedCautionTerms, setMatchedCautionTerms] = React.useState<string[]>([]);
  const [savedVersions, setSavedVersions] = React.useState<SavedGeneratedVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = React.useState('');
  const [checkedItems, setCheckedItems] = React.useState<Record<string, boolean>>({});
  const contentRef = useRef<HTMLDivElement>(null);

  const reviewItems = [
    { id: 'privacy', label: '학생 개인정보와 민감 정보 최소화 확인' },
    { id: 'exaggeration', label: '과장 표현, 단정 표현, 수상/대회 등 금지 표현 확인' },
    { id: 'guideline', label: '최신 기재요령과 학교 기준 직접 확인' },
    { id: 'tone', label: '문체, 분량, 중복 표현 검토' },
    { id: 'final', label: '교사 최종 책임 검토 완료' },
  ];

  const rewriteActions = [
    { label: '더 짧게', instruction: '핵심 의미는 유지하되 더 짧고 간결하게 다듬어 주세요.' },
    { label: '더 공문답게', instruction: '학교 공문서에 어울리는 정중하고 명확한 문체로 다듬어 주세요.' },
    { label: '더 따뜻하게', instruction: '과장하지 않으면서 더 따뜻하고 교육적인 표현으로 다듬어 주세요.' },
    { label: '중복 표현 줄이기', instruction: '반복되는 단어와 문장 구조를 줄이고 자연스럽게 다듬어 주세요.' },
    { label: 'NEIS 문체로 다듬기', instruction: '학교생활기록부에 어울리는 관찰 근거 중심의 간결한 문체로 다듬어 주세요.' },
  ];

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

  // Sync content prop to the editable div whenever it changes (new generation).
  // Use execCommand so the replacement is recorded in the browser undo stack,
  // allowing Ctrl+Z to restore the previous generated result.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !content) return;
    const cleanContent = markdownOrHtmlToHtml(content);
    saveGeneratedSnapshot(cleanContent);
    el.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertHTML', false, cleanContent);
    window.getSelection()?.collapse(el, 0);

    // contentEditable에 삽입 시 <style> 태그가 무시되므로 테이블에 인라인 스타일 직접 적용
    el.querySelectorAll<HTMLTableElement>('table').forEach(table => {
      if (!table.style.borderCollapse) table.style.borderCollapse = 'collapse';
      if (!table.style.width) table.style.width = '100%';
    });
    el.querySelectorAll<HTMLElement>('th, td').forEach(cell => {
      if (!cell.style.border) cell.style.border = '1pt solid #333';
      if (!cell.style.padding) cell.style.padding = '5pt 8pt';
    });

    // 워크시트 제목(h1) 가운데 정렬
    el.querySelectorAll<HTMLElement>('h1').forEach(h1 => {
      if (!h1.style.textAlign) h1.style.textAlign = 'center';
    });

    // 학년/반/이름 기입란 오른쪽 정렬
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
      alert("클립보드 복사에 실패했습니다. 브라우저 설정을 확인해주세요.");
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

  const handleDownloadBasicHwpx = async () => {
    const currentHtml = getCurrentContent();
    const docTitle = hwpxData?.["문서제목"] || title || contentRef.current?.innerText?.split('\n')[0]?.slice(0, 30) || '문서';
    await window.electronAPI.saveHwpx(docTitle, currentHtml, {
      title: docTitle,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const handleDownloadWord = async () => {
    const currentHtml = getCurrentContent();
    const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Document</title><style>body { font-family: 'Batang', 'Dotum', sans-serif; } table { border-collapse: collapse; width: 100%; border: 1px solid black; } th, td { border: 1px solid black; padding: 8px; }</style></head><body>${currentHtml}</body></html>`;
    await window.electronAPI.saveFile(fullHtml, getFormattedFilename("doc"), "doc");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRewrite = async (label: string, instruction: string) => {
    const currentHtml = getCurrentContent();
    const plainText = getPlainText();
    if (!plainText.trim()) return;
    setRewriting(label);
    try {
      const result = await window.electronAPI.aiGenerate(
        `[다듬을 원문]\n${plainText}\n\n[요청]\n${instruction}\n\n[출력 규칙]\n- 원문과 같은 용도로 바로 붙여 넣을 수 있는 결과만 출력하세요.\n- 설명, 제목, 코드블록은 쓰지 마세요.`,
        '교사가 검토 중인 학교 문서를 안전하고 자연스럽게 다듬는 편집자입니다.',
        { temperature: 0.4 },
      );
      const nextHtml = markdownOrHtmlToHtml(result);
      const el = contentRef.current;
      if (el) {
        el.innerHTML = nextHtml;
      }
    } catch {
      alert('재작성 중 오류가 발생했습니다.');
    } finally {
      setRewriting(null);
    }
  };

  const handleSaveCurrentVersion = () => {
    const text = getPlainText().trim();
    if (!text) return;
    const now = new Date();
    const next: SavedGeneratedVersion = {
      id: `${now.getTime()}`,
      title: title || text.slice(0, 24) || '생성 결과',
      text,
      createdAt: now.toISOString(),
    };
    const versions = [next, ...savedVersions].slice(0, 8);
    localStorage.setItem(getHistoryKey(), JSON.stringify(versions));
    setSavedVersions(versions);
    setSelectedVersionId(next.id);
  };

  const selectedVersion = savedVersions.find(version => version.id === selectedVersionId) || null;
  const compareLines = React.useMemo(() => {
    if (!selectedVersion) return [];
    const before = new Set(selectedVersion.text.split(/[.!?\n。]/).map(line => line.trim()).filter(Boolean));
    return getPlainText()
      .split(/[.!?\n。]/)
      .map(line => line.trim())
      .filter(line => line && !before.has(line))
      .slice(0, 5);
  }, [selectedVersion, content]);

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
        <div className="flex gap-2 shrink-0">
           <button
            onClick={handlePrint}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="인쇄하기"
          >
            <Printer className="w-4 h-4" />
          </button>

          {content && (
            <button
              onClick={handleSavePdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors shadow-sm"
              title="A4 PDF 파일로 저장"
            >
              <FileDown className="w-4 h-4" />
              <span>PDF 저장</span>
            </button>
          )}
          
          {content && (
            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded transition-colors shadow-sm"
              title="마크다운(.md) 파일로 저장"
            >
              <FileText className="w-4 h-4" />
              <span>MD 저장</span>
            </button>
          )}

          <button
            onClick={handleDownloadWord}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 rounded transition-colors shadow-sm"
            title="HWP에서 열기 좋은 Word 파일로 저장"
          >
            <Download className="w-4 h-4" />
            <span>Doc 저장</span>
          </button>


          <button 
            onClick={handleDownloadHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 rounded transition-colors shadow-sm"
            title="HTML 파일로 저장"
          >
            <FileType className="w-4 h-4" />
            <span>HTML 저장</span>
          </button>
          
          <button 
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded shadow-sm transition-all
              ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-[#1E88E5] hover:bg-[#1565C0]'}
            `}
            title="HWP 붙여넣기 최적화 복사"
          >
            <Copy className="w-4 h-4" />
            {copied ? '복사됨' : '복사하기'}
          </button>

          {content && (
            <button
              disabled
              title="HWPX 저장 기능은 현재 구현중입니다."
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors shadow-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 cursor-not-allowed"
            >
              <FileType className="w-4 h-4" />
              <span>HWPX 양식 저장 (구현중)</span>
            </button>
          )}

          {content && (
            <button
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors shadow-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 cursor-not-allowed"
              title="HWPX 저장 기능은 현재 구현중입니다."
            >
              <FileType className="w-4 h-4" />
              <span>HWPX 기본 저장 (구현중)</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Editor Viewport */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-8 bg-[#EAECEF] dark:bg-gray-950 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {content && (
          <div className="mx-auto w-full max-w-[100%] sm:max-w-[210mm] mb-3 space-y-3">
            <div className="hidden">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">빠른 재작성</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rewriteActions.map(action => (
                  <button
                    key={action.label}
                    onClick={() => handleRewrite(action.label, action.instruction)}
                    disabled={!!rewriting}
                    className="px-3 py-1.5 text-xs font-bold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:text-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900"
                  >
                    {rewriting === action.label ? '다듬는 중...' : action.label}
                  </button>
                ))}
              </div>
            </div>

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
                    <option value="">비교할 이전 버전 선택</option>
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
                        <p>선택한 버전과 큰 문장 차이가 없습니다.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">현재 결과를 저장하면 다음 생성 결과와 비교할 수 있습니다.</p>
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

            {reviewChecklistEnabled && (
              <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">검토 체크리스트</span>
                </div>
                <div className="grid gap-2">
                  {reviewItems.map(item => (
                    <label key={item.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[item.id]}
                        onChange={e => setCheckedItems(prev => ({ ...prev, [item.id]: e.target.checked }))}
                      />
                      <span>{item.label}</span>
                    </label>
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
        <span>HTML & MD 호환 | HWP 복사 가능</span>
      </div>
    </div>
  );
};
