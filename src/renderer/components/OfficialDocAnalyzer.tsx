import React, { useState, useEffect } from 'react';
import { CalendarPlus, ClipboardList, Copy, FileText, Loader2, PanelLeftClose, PanelLeftOpen, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AppMode, FileData } from '../types';
import { analyzeOfficialDocument } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';

const OfficialDocAnalyzer: React.FC = () => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.OFFICIAL_DOC_ANALYZER);
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputPanelCollapsed, setInputPanelCollapsed] = useState(false);

  useEffect(() => {
    const handler = () => setIsLoading(false);
    window.addEventListener('edunote-generation-reset', handler);
    return () => window.removeEventListener('edunote-generation-reset', handler);
  }, []);

  const canAnalyze = title.trim() || pastedText.trim() || files.length > 0;

  const getCalendarDate = () => {
    const dateFromText = (text: string) => {
      const m = text.match(/(20\d{2})[-.년\s]+(\d{1,2})[-.월\s]+(\d{1,2})/);
      return m ? `${m[1]}${m[2].padStart(2, '0')}${m[3].padStart(2, '0')}` : null;
    };

    // 1순위: ## 마감 섹션
    const deadlineSection = result.match(/##\s*마감\s*\n+([\s\S]*?)(?=\n##|\s*$)/);
    if (deadlineSection?.[1]) {
      const d = dateFromText(deadlineSection[1]);
      if (d) return d;
    }

    // 2순위: "까지" / "마감" / "기한" 키워드가 포함된 줄
    const source = `${result}\n${pastedText}\n${title}`;
    for (const line of source.split('\n')) {
      if (/까지|마감|기한/.test(line)) {
        const d = dateFromText(line);
        if (d) return d;
      }
    }

    // 3순위: 전체에서 첫 번째 날짜 (fallback)
    return dateFromText(source);
  };

  const getCalendarEndDate = (startDate: string) => {
    const date = new Date(
      Number(startDate.slice(0, 4)),
      Number(startDate.slice(4, 6)) - 1,
      Number(startDate.slice(6, 8)) + 1
    );
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');
  };

  const getCalendarTitle = () => {
    const cleanup = (value?: string | null) =>
      (value || '')
        .replace(/^[-*#\s:]+/, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const topicSection = result.match(/##\s*(한 줄 요약|업무 주제)\s*\n+([\s\S]*?)(?=\n##\s|\n?$)/);
    const topic = cleanup(topicSection?.[2]?.split('\n').find(line => cleanup(line)));
    if (topic) return topic.slice(0, 80);

    const firstTask = cleanup(result.match(/##\s*(할 일|해야 할 일)\s*\n+([\s\S]*?)(?=\n##\s|\n?$)/)?.[2]?.split('\n').find(line => /^[-*]\s+/.test(line)));
    if (firstTask) return firstTask.slice(0, 80);

    const firstSummary = cleanup(result.match(/##\s*핵심 요약\s*\n+([\s\S]*?)(?=\n##\s|\n?$)/)?.[1]?.split('\n').find(line => cleanup(line)));
    return (title || firstSummary || 'EduNote 공문 업무 일정').replace(/\s+/g, ' ').trim().slice(0, 80);
  };

  const handleAnalyze = async () => {
    if (!canAnalyze || isLoading) return;
    setIsLoading(true);
    setError('');
    startGeneration();
    try {
      const output = await analyzeOfficialDocument({ title, pastedText, files });
      setResult(output.trim());
      playSuccessSound();
    } catch (err: any) {
      setError(err?.message || '공문 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      endGeneration();
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
  };

  const handleSave = async () => {
    if (!result) return;
    const safeTitle = (title || '공문_업무_추출').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    await window.electronAPI.saveTxt(result, `${safeTitle}.txt`);
  };

  const handleOpenGoogleCalendar = async () => {
    if (!result) return;
    const date = getCalendarDate();
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: getCalendarTitle(),
      details: [
        'EduNote 공문 분석 결과입니다.',
        '',
        result,
        '',
        '원문 마감일과 제출처를 확인한 뒤 저장하세요.',
      ].join('\n').slice(0, 1800),
    });
    if (date) params.set('dates', `${date}/${getCalendarEndDate(date)}`);
    await window.electronAPI.openExternal(`https://calendar.google.com/calendar/render?${params.toString()}`);
  };

  const handleSaveIcs = async () => {
    if (!result) return;
    const date = getCalendarDate() || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeTitle = getCalendarTitle().replace(/[\\/:*?"<>|]/g, '_');
    const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EduNote//Official Document Task//KO',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@edunote.local`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${escapeIcs(getCalendarTitle())}`,
      `DESCRIPTION:${escapeIcs(result)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    await window.electronAPI.saveFile(ics, `${safeTitle}.ics`, 'ics');
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-gray-900">
      {inputPanelCollapsed && (
        <div className="w-11 shrink-0 border-r border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-center py-3">
          <button
            onClick={() => setInputPanelCollapsed(false)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-gray-600 text-slate-500 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
            title="입력 패널 펼치기"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}
      {!inputPanelCollapsed && (
      <div className="w-[390px] shrink-0 border-r border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">공문 요약 / 업무 추출</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">핵심 업무와 마감만 짧게 정리합니다.</p>
            </div>
            <button
              onClick={() => setInputPanelCollapsed(true)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-gray-600 text-slate-500 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
              title="입력 패널 접기"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">공문 제목 또는 메모</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder={`예: ${new Date().getMonth() < 2 ? new Date().getFullYear() - 1 : new Date().getFullYear()}학년도 학교자율시간 운영 자료 제출`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">공문 내용 붙여넣기</label>
            <textarea
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              className="w-full min-h-[180px] px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="공문 본문, 메일 내용, 업무 안내 문구를 붙여넣으세요."
            />
          </div>

          <FileUpload
            label="공문 파일 업로드 또는 스크린샷 붙여넣기 (선택)"
            files={files}
            onFilesChange={setFiles}
            multiple={true}
          />

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-gray-700">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-gray-700 text-white font-bold transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {isLoading ? '분석 중...' : '공문 업무 추출'}
          </button>
        </div>
      </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">분석 결과</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!result}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-gray-700"
            >
              <Copy className="w-3.5 h-3.5" />
              복사
            </button>
            <button
              onClick={handleSave}
              disabled={!result}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-gray-700"
            >
              <Save className="w-3.5 h-3.5" />
              TXT 저장
            </button>
            <button
              onClick={handleOpenGoogleCalendar}
              disabled={!result}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-700 dark:text-emerald-300 disabled:opacity-40 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
              title="브라우저에서 Google Calendar 일정 작성 화면을 열고, 저장만 누르면 내 캘린더에 추가됩니다."
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              구글캘린더 추가
            </button>
            <button
              onClick={handleSaveIcs}
              disabled={!result}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-600 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-gray-700"
              title="Google Calendar 가져오기, Outlook, Apple Calendar에서 쓸 수 있는 표준 일정 파일입니다."
            >
              .ics 저장
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {result ? (
            <div className="dark-prose-area prose prose-sm max-w-none bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm text-slate-900 dark:text-slate-100">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-slate-400 dark:text-slate-500">
              <div>
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-60" />
                <p className="text-sm font-semibold">공문 내용을 입력하거나 파일/스크린샷을 올린 뒤 업무를 추출하세요.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfficialDocAnalyzer;
