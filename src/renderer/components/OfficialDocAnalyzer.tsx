import React, { useState, useEffect } from 'react';
import { CalendarPlus, ClipboardList, Copy, FileText, ListTodo, Loader2, PanelLeftClose, PanelLeftOpen, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AppMode, FileData } from '../types';
import { analyzeOfficialDocument } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';
import { notifyToast } from '../lib/toast';
import { loadDocTodos, saveDocTodos, DocTodo } from './DocTodoPanel';

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
      const full = text.match(/(20\d{2})\s*(?:년|[-./])\s*(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})/);
      if (full) return `${full[1]}${full[2].padStart(2, '0')}${full[3].padStart(2, '0')}`;

      const short = text.match(/(?:^|[^\d])(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})\s*(?:일)?/);
      if (!short) return null;
      return `${new Date().getFullYear()}${short[1].padStart(2, '0')}${short[2].padStart(2, '0')}`;
    };

    // 1순위: 마감/기한/제출 섹션
    const deadlineSection = result.match(/##\s*(?:마감|기한|제출)\s*\n+([\s\S]*?)(?=\n##|\s*$)/);
    if (deadlineSection?.[1]) {
      const d = dateFromText(deadlineSection[1]);
      if (d) return d;
    }

    // 2순위: 마감 업무를 뜻하는 키워드가 포함된 줄
    const source = `${result}\n${pastedText}\n${title}`;
    for (const line of source.split('\n')) {
      if (/마감|기한|까지|제출|신청|접수|등록|회신/.test(line)) {
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

  // 분석 결과에서 제목·마감일을 추출해 공문 할일 목록에 저장한다.
  const handleSaveTodo = async () => {
    if (!result) return;
    const date = getCalendarDate();
    const deadline = date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : '';
    const taskSection = result.match(/##\s*(?:할 일|해야 할 일)\s*\n+([\s\S]*?)(?=\n##\s|\n?$)/)?.[1] ?? '';
    const memo = taskSection.trim().slice(0, 300);
    const todo: DocTodo = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: getCalendarTitle(),
      deadline,
      memo,
      done: false,
      createdAt: new Date().toISOString(),
    };
    try {
      const todos = await loadDocTodos();
      await saveDocTodos([...todos, todo]);
      notifyToast({
        type: 'success',
        title: '공문 할일에 저장했습니다.',
        description: deadline ? `마감 ${deadline}` : '마감일을 찾지 못해 비워 두었습니다.',
      });
    } catch {
      notifyToast({ type: 'error', title: '할일 저장 중 오류가 발생했습니다.' });
    }
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
        '마감일 기준으로 만든 일정입니다. 원문 마감일과 제출처를 확인한 뒤 저장하세요.',
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
    <div className="flex h-full bg-[#FAF9F7] dark:bg-[#171210]">
      {inputPanelCollapsed && (
        <div className="w-11 shrink-0 border-r border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] flex justify-center py-3">
          <button
            onClick={() => setInputPanelCollapsed(false)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] transition-colors"
            title="입력 패널 펼치기"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}
      {!inputPanelCollapsed && (
      <div className="w-[390px] shrink-0 border-r border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] flex flex-col">
        <div className="h-14 px-4 border-b border-[#EDE8E1] dark:border-[#2E2822] flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F0EBE6]">공문 요약 / 업무 추출</h2>
              <p className="text-xs text-[#78716C] dark:text-[#9C8F87]">핵심 업무와 마감만 짧게 정리합니다.</p>
            </div>
            <button
              onClick={() => setInputPanelCollapsed(true)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420] transition-colors"
              title="입력 패널 접기"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">공문 제목 또는 메모</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder={`예: ${new Date().getMonth() < 2 ? new Date().getFullYear() - 1 : new Date().getFullYear()}학년도 학교자율시간 운영 자료 제출`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#44403C] dark:text-[#C4B8B0] mb-1">공문 내용 붙여넣기</label>
            <textarea
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              className="w-full min-h-[180px] px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#171210] text-sm text-[#1C1917] dark:text-[#F0EBE6] outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
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

        <div className="p-5 border-t border-[#EDE8E1] dark:border-[#2E2822]">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#E7E5E4] dark:disabled:bg-[#2E2822] text-white font-bold transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {isLoading ? '분석 중...' : '공문 업무 추출'}
          </button>
        </div>
      </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 px-4 border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-[#1C1917] dark:text-[#F0EBE6]">분석 결과</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!result}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] text-xs text-[#78716C] dark:text-[#9C8F87] disabled:opacity-40 hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
            >
              <Copy className="w-3.5 h-3.5" />
              복사
            </button>
            <button
              onClick={handleSave}
              disabled={!result}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] text-xs text-[#78716C] dark:text-[#9C8F87] disabled:opacity-40 hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
            >
              <Save className="w-3.5 h-3.5" />
              TXT 저장
            </button>
            <button
              onClick={handleSaveTodo}
              disabled={!result}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-700 dark:text-emerald-300 disabled:opacity-40 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
              title="분석한 업무와 마감일을 공문 할일 목록에 추가합니다."
            >
              <ListTodo className="w-3.5 h-3.5" />
              할일로 저장
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] text-xs text-[#78716C] dark:text-[#9C8F87] disabled:opacity-40 hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]"
              title="Google Calendar 가져오기, Outlook, Apple Calendar에서 쓸 수 있는 표준 일정 파일입니다."
            >
              .ics 저장
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {result ? (
            <div className="dark-prose-area prose prose-sm max-w-none bg-white dark:bg-[#221E1B] border border-[#EDE8E1] dark:border-[#2E2822] rounded-2xl p-6 shadow-sm text-[#1C1917] dark:text-[#F0EBE6]">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-[#A8A29E] dark:text-[#6B5E57]">
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
