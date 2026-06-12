import React, { useCallback, useMemo, useRef, useState } from 'react';
import { notifyToast } from '../lib/toast';
import { FileDown, FileText, Printer, ChevronLeft, RotateCcw } from 'lucide-react';
import { PRINT_FORMS, PrintForm } from '../data/printForms';

const CATEGORIES = Array.from(new Set(PRINT_FORMS.map(f => f.category)));

export default function PrintFormScreen() {
  const [selectedForm, setSelectedForm] = useState<PrintForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const formsInCategory = PRINT_FORMS.filter(f => f.category === activeCategory);

  const rendered = useMemo(() => {
    if (!selectedForm) return '';
    let html = selectedForm.htmlTemplate;
    for (const field of selectedForm.fields) {
      if (field.type === 'participants') {
        // 참가자 목록 → 20명 단위로 표를 나눠 페이지가 자동으로 넘어가게 한다.
        const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const names = (values[field.key] ?? '').split('\n').map(n => n.trim()).filter(Boolean);
        const perPage = 20;
        // 한 페이지 분량의 행을 받아 표 한 개를 만든다. pageBreak가 true면 표 앞에서 페이지를 넘긴다.
        const makeTable = (rowsHtml: string, pageBreak: boolean) => `<table class="reg-table" style="width:100%;border-collapse:collapse;${pageBreak ? 'break-before:page;page-break-before:always;margin-top:12pt;' : ''}">
          <thead><tr>
            <th style="width:10%;border:1px solid #555;padding:4pt 6pt;background:#f0f0f0;text-align:center;">번호</th>
            <th style="border:1px solid #555;padding:4pt 6pt;background:#f0f0f0;text-align:center;">성명</th>
            <th style="width:25%;border:1px solid #555;padding:4pt 6pt;background:#f0f0f0;text-align:center;">서명</th>
          </tr></thead>
          <tbody style="font-size:10pt;">
            <style>.reg-row td{border:1px solid #555;padding:4pt 6pt;height:22pt;}</style>
            ${rowsHtml}
          </tbody>
        </table>`;

        let tableHtml = '';
        if (names.length === 0) {
          // 빈 양식: 번호만 있는 20줄짜리 빈 표 한 장
          const rows = Array.from({ length: perPage }, (_, i) =>
            `<tr class="reg-row"><td style="text-align:center;">${i + 1}</td><td></td><td></td></tr>`
          ).join('');
          tableHtml = makeTable(rows, false);
        } else {
          // 20명 단위로 페이지를 나눈다. 두 번째 장부터는 표 앞에서 강제로 페이지를 넘긴다.
          const pageCount = Math.ceil(names.length / perPage);
          const pages: string[] = [];
          for (let p = 0; p < pageCount; p++) {
            const slice = names.slice(p * perPage, (p + 1) * perPage);
            const rows = slice.map((name, idx) => {
              const no = p * perPage + idx + 1;
              return `<tr class="reg-row"><td style="text-align:center;">${no}</td><td>${escape(name)}</td><td></td></tr>`;
            }).join('');
            pages.push(makeTable(rows, p > 0));
          }
          tableHtml = pages.join('');
        }
        html = html.replaceAll('{{참가자행}}', tableHtml);
      } else if (field.type === 'table') {
        // 한 줄에 한 행, '/'로 칸을 나눠 columns 머리글의 표를 만든다. 빈 행은 minRows까지 채운다.
        const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const cols = field.columns ?? [];
        const dataRows = (values[field.key] ?? '')
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => line.split('/').map(cell => cell.trim()));
        const totalRows = Math.max(dataRows.length, field.minRows ?? 0);
        let body = '';
        for (let i = 0; i < totalRows; i++) {
          const row = dataRows[i] ?? [];
          body += '<tr>' + cols.map((_, ci) => {
            const first = ci === 0;
            const value = escape(row[ci] ?? '');
            return `<td style="border:1px solid #555;padding:4pt 6pt;height:22pt;${first ? 'text-align:center;font-weight:bold;background:#f7f7f7;' : ''}">${value}</td>`;
          }).join('') + '</tr>';
        }
        const head = cols.map(c => `<th style="border:1px solid #555;padding:4pt 6pt;background:#f0f0f0;text-align:center;">${escape(c)}</th>`).join('');
        const tableHtml = `<table style="width:100%;border-collapse:collapse;margin-bottom:6pt;font-size:10.5pt;">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>`;
        html = html.replaceAll(`{{${field.key}}}`, tableHtml);
      } else {
        // 빈 값은 빈 문자열 — placeholder 텍스트 표시 안 함
        const val = (values[field.key] ?? '').replace(/\n/g, '<br>');
        html = html.replaceAll(`{{${field.key}}}`, val);
      }
    }
    return html;
  }, [selectedForm, values]);

  const handleSelectForm = (form: PrintForm) => {
    setSelectedForm(form);
    const defaults: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.type === 'date') defaults[f.key] = new Date().toLocaleDateString('ko-KR');
      else if (f.type === 'select' && f.options?.[0]) defaults[f.key] = f.options[0];
      else defaults[f.key] = '';
    }
    setValues(defaults);
  };

  const handleReset = () => {
    if (!selectedForm) return;
    const defaults: Record<string, string> = {};
    for (const f of selectedForm.fields) {
      if (f.type === 'date') defaults[f.key] = new Date().toLocaleDateString('ko-KR');
      else if (f.type === 'select' && f.options?.[0]) defaults[f.key] = f.options[0];
      else defaults[f.key] = '';
    }
    setValues(defaults);
  };

  const handleEditableFrameLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.designMode = 'on';
    doc.body.contentEditable = 'true';
    doc.body.spellcheck = false;
  }, []);

  const getEditedHtml = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) return rendered;
    return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
  };

  const handlePrint = async () => {
    if (!rendered || !selectedForm) return;
    const now = new Date();
    const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    try {
      await (window.electronAPI as any).savePdf(getEditedHtml(), `${selectedForm.title}(${d}).pdf`);
    } catch {
      notifyToast({ type: 'error', title: 'PDF 저장 중 오류가 발생했습니다.' });
    }
  };

  const handleSaveHwpx = async () => {
    if (!rendered || !selectedForm) return;
    try {
      await window.electronAPI.saveHwpx(selectedForm.title, getEditedHtml(), { title: selectedForm.title });
    } catch {
      notifyToast({ type: 'error', title: 'HWPX 저장 중 오류가 발생했습니다.' });
    }
  };

  if (selectedForm) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[#FAF9F7] dark:bg-[#171210]">
        {/* 헤더 */}
        <div className="h-14 shrink-0 px-4 bg-white dark:bg-[#221E1B] border-b border-[#EDE8E1] dark:border-[#2E2822] flex items-center gap-3">
          <button
            onClick={() => setSelectedForm(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#78716C] dark:text-[#9C8F87] hover:text-[#1C1917] dark:hover:text-[#C4B8B0] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            목록으로
          </button>
          <span className="text-[#E7E5E4] dark:text-[#2E2822]">|</span>
          <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6]">{selectedForm.title}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold">{selectedForm.category}</span>
          <span className="text-xs text-[#78716C] dark:text-[#9C8F87]">양식 화면을 직접 클릭해서 수정하세요.</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#E7E5E4] dark:border-[#2E2822] rounded-lg text-[#78716C] dark:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              초기화
            </button>
            <button
              onClick={handleSaveHwpx}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              HWPX 저장
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              PDF 저장·인쇄
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto bg-[#EDE8E1] dark:bg-[#171210] flex items-start justify-center p-6">
            <div className="bg-white shadow-xl shrink-0" style={{ width: '210mm', height: '297mm', padding: '0' }}>
              <iframe
                ref={iframeRef}
                srcDoc={rendered}
                onLoad={handleEditableFrameLoad}
                style={{ width: '100%', height: '297mm', border: 'none', display: 'block' }}
                title="양식 편집"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FAF9F7] dark:bg-[#171210]">
      <div className="shrink-0 px-5 pt-5 pb-3">
        <h1 className="text-lg font-bold text-[#1C1917] dark:text-[#F0EBE6] flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-500" />
          양식 인쇄 도구
        </h1>
        <p className="text-xs text-[#78716C] dark:text-[#9C8F87] mt-0.5">자주 쓰는 학교 양식을 선택해 화면에서 바로 고치고 PDF 또는 HWPX로 저장하세요.</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="shrink-0 px-5 flex gap-2 border-b border-[#EDE8E1] dark:border-[#2E2822]">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeCategory === cat
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-[#78716C] dark:text-[#9C8F87] hover:text-[#44403C] dark:hover:text-[#C4B8B0]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 양식 목록 */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {formsInCategory.map(form => (
            <button
              key={form.id}
              onClick={() => handleSelectForm(form)}
              className="text-left p-4 bg-white dark:bg-[#221E1B] rounded-xl border border-[#EDE8E1] dark:border-[#2E2822] hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-bold text-sm text-[#1C1917] dark:text-[#F0EBE6] group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">{form.title}</span>
              </div>
              <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">
                화면 직접 편집 · PDF/HWPX 저장 지원
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
