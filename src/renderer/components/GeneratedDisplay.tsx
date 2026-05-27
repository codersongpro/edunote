import React, { useRef, useEffect } from 'react';
import { Copy, Download, FileText, Printer, FileType, PenLine, FileDown } from 'lucide-react';
import { stripGeneratedCodeFences } from '../lib/generatedContent';

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

export const GeneratedDisplay: React.FC<GeneratedDisplayProps> = ({ content, hwpxData, hwpxFillData, hwpxTemplate, title }) => {
  const [copied, setCopied] = React.useState(false);
  const [hwpxDownloading, setHwpxDownloading] = React.useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync content prop to the editable div whenever it changes (new generation).
  // Use execCommand so the replacement is recorded in the browser undo stack,
  // allowing Ctrl+Z to restore the previous generated result.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !content) return;
    const cleanContent = stripGeneratedCodeFences(content);
    el.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertHTML', false, cleanContent);
    window.getSelection()?.collapse(el, 0);
  }, [content]);

  const getCurrentContent = (): string => {
    return stripGeneratedCodeFences(contentRef.current?.innerHTML || content);
  };

  const handleCopy = async () => {
    const currentHtml = getCurrentContent();
    const plainText = contentRef.current?.innerText || currentHtml.replace(/<[^>]*>?/gm, '');
    
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
        </div>
      </div>
      
      {/* Editor Viewport */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-8 bg-[#EAECEF] dark:bg-gray-950 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
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
