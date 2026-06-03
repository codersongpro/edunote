import React, { useState, useMemo } from 'react';
import { FileText, Printer, ChevronLeft, RotateCcw } from 'lucide-react';
import { PRINT_FORMS, PrintForm } from '../data/printForms';

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';
const labelClass = 'block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1';

const CATEGORIES = Array.from(new Set(PRINT_FORMS.map(f => f.category)));

export default function PrintFormScreen() {
  const [selectedForm, setSelectedForm] = useState<PrintForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);

  const formsInCategory = PRINT_FORMS.filter(f => f.category === activeCategory);

  const rendered = useMemo(() => {
    if (!selectedForm) return '';
    let html = selectedForm.htmlTemplate;
    for (const field of selectedForm.fields) {
      const val = (values[field.key] ?? '').replace(/\n/g, '<br>');
      html = html.replaceAll(`{{${field.key}}}`, val || `<span style="color:#bbb;">(${field.label})</span>`);
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
    setPreview(false);
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

  const handlePrint = async () => {
    if (!rendered || !selectedForm) return;
    const now = new Date();
    const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    try {
      await (window.electronAPI as any).savePdf(rendered, `${selectedForm.title}(${d}).pdf`);
    } catch {
      alert('PDF 저장 중 오류가 발생했습니다.');
    }
  };

  if (selectedForm) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* 헤더 */}
        <div className="shrink-0 px-5 pt-4 pb-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <button
            onClick={() => { setSelectedForm(null); setPreview(false); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            목록으로
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">{selectedForm.title}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold">{selectedForm.category}</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setPreview(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                preview
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              {preview ? '편집으로' : '미리보기'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              초기화
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
          {/* 입력 패널 */}
          {!preview && (
            <div className="w-72 shrink-0 overflow-y-auto p-4 space-y-3 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {selectedForm.fields.map(field => (
                <div key={field.key}>
                  <label className={labelClass}>{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className={inputClass}
                      rows={field.rows ?? 4}
                      placeholder={field.placeholder}
                      value={values[field.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className={inputClass}
                      value={values[field.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                    >
                      {field.options?.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'date' ? 'text' : 'text'}
                      className={inputClass}
                      placeholder={field.placeholder}
                      value={values[field.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 미리보기 */}
          <div className="flex-1 overflow-hidden bg-gray-200 dark:bg-gray-950 flex items-start justify-center p-4">
            <div className="bg-white shadow-xl" style={{ width: '210mm', minHeight: '297mm', padding: '0' }}>
              <iframe
                srcDoc={rendered}
                style={{ width: '100%', minHeight: '297mm', border: 'none', display: 'block' }}
                title="양식 미리보기"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="shrink-0 px-5 pt-5 pb-3">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-500" />
          양식 인쇄 도구
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">자주 쓰는 학교 양식을 선택해 내용을 채우고 PDF로 인쇄하세요.</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="shrink-0 px-5 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeCategory === cat
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
              className="text-left p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-bold text-sm text-gray-800 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">{form.title}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                입력 항목 {form.fields.length}개 · PDF 인쇄 지원
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
