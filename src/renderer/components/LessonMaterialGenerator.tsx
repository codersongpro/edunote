import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Wand2, AlertCircle, FileText, Layers, ClipboardList, Zap, SlidersHorizontal,
  Download, FileType, BookOpen, Monitor, Users, ChevronDown, ChevronRight, FileDown,
  Play, X, ChevronLeft, Image as ImageIcon,
} from 'lucide-react';
import { AppMode } from '../types';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { GeneratedDisplay } from './GeneratedDisplay';
import {
  generateLessonSlides, generateLessonWorksheet, generateLessonQuiz, generateLessonPlan,
  LessonSlide, LessonParams,
} from '../services/geminiService';
import { LOADING_MESSAGES } from '../constants';
import { GRADES as CURRICULUM_GRADES, getSubjectsForGrade } from '../constants/curriculum2022';
import { getStandards, AchievementStandard } from '../constants/curriculumStandards';

type LessonContentType = 'SLIDE' | 'WORKSHEET' | 'QUIZ' | 'PLAN';

const CONTENT_TYPES: { value: LessonContentType; icon: React.ElementType; label: string; desc: string }[] = [
  { value: 'SLIDE', icon: Layers, label: '수업 슬라이드', desc: '발표용 슬라이드 및 교사 메모' },
  { value: 'WORKSHEET', icon: ClipboardList, label: '워크시트', desc: '워크시트 및 평가지 (HTML/인쇄용)' },
  { value: 'QUIZ', icon: Zap, label: '퀴즈 앱', desc: '인터랙티브 퀴즈 (선택형/O×)' },
  { value: 'PLAN', icon: FileText, label: '수업 계획서', desc: '교수·학습 과정안 (A4 인쇄용)' },
];

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide';

const extractHtml = (raw: string): string => {
  const m = raw.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  const doc = raw.match(/(<!DOCTYPE html>[\s\S]*|<html[\s\S]*)/i);
  if (doc) return doc[0].replace(/```/g, '').trim();
  return raw.replace(/```html/g, '').replace(/```/g, '').trim();
};

const LessonMaterialGenerator: React.FC = () => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.LESSON_MATERIAL);

  const defaultGrade = CURRICULUM_GRADES[4];
  const [selectedGradeLabel, setSelectedGradeLabel] = useState(defaultGrade.label);
  const [subject, setSubject] = useState(defaultGrade.subjects[0].name);
  const [selectedStandardCode, setSelectedStandardCode] = useState('');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(['01']));
  const [unit, setUnit] = useState('');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [contentType, setContentType] = useState<LessonContentType>('SLIDE');

  const currentSubjects = getSubjectsForGrade(selectedGradeLabel);
  const currentStandards = getStandards(selectedGradeLabel, subject);

  const standardsByDomain = currentStandards.reduce((acc, s) => {
    if (!acc[s.domain]) acc[s.domain] = [];
    acc[s.domain].push(s);
    return acc;
  }, {} as Record<string, AchievementStandard[]>);
  const domains = Object.keys(standardsByDomain).sort();

  const selectedStandard = currentStandards.find(s => s.code === selectedStandardCode) ?? null;

  const handleGradeChange = (newGrade: string) => {
    setSelectedGradeLabel(newGrade);
    const subs = getSubjectsForGrade(newGrade);
    const firstSub = subs[0]?.name ?? '';
    setSubject(firstSub);
    setSelectedStandardCode('');
    setExpandedDomains(new Set(['01']));
  };

  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setSelectedStandardCode('');
    setExpandedDomains(new Set(['01']));
  };

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain); else next.add(domain);
      return next;
    });
  };

  const [pageCount, setPageCount] = useState(5);
  const [worksheetCount, setWorksheetCount] = useState(2);
  const [questionCount, setQuestionCount] = useState(5);
  const [worksheetType, setWorksheetType] = useState<'activity' | 'assessment'>('activity');
  const [includeScore, setIncludeScore] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [slides, setSlides] = useState<LessonSlide[] | null>(null);
  const [worksheetHtml, setWorksheetHtml] = useState<string | null>(null);
  const [quizHtml, setQuizHtml] = useState<string | null>(null);
  const [planContent, setPlanContent] = useState<string>('');
  const [slideImages, setSlideImages] = useState<Record<number, string>>({});
  const [generatingImageSlides, setGeneratingImageSlides] = useState<Set<number>>(new Set());
  const [allImagesProgress, setAllImagesProgress] = useState<{ done: number; total: number } | null>(null);
  const [isPresentMode, setIsPresentMode] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);

  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isGenerating) {
      let idx = 0;
      setLoadingMessage(LOADING_MESSAGES[0]);
      loadingIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[idx]);
      }, 2500);
    } else {
      if (loadingIntervalRef.current) { clearInterval(loadingIntervalRef.current); loadingIntervalRef.current = null; }
    }
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current); };
  }, [isGenerating]);

  const SLIDE_IMAGE_STYLE = 'flat vector illustration, Korean educational style, bright colors, no text, clean design — ';

  const handleGenerateSlideImage = async (slide: LessonSlide) => {
    if (!slide.imagePrompt || generatingImageSlides.has(slide.page)) return;
    setGeneratingImageSlides(prev => new Set(prev).add(slide.page));
    try {
      const img = await window.electronAPI.fetchSlideImage(SLIDE_IMAGE_STYLE + slide.imagePrompt);
      if (img) setSlideImages(prev => ({ ...prev, [slide.page]: img }));
    } catch { /* no-op */ }
    setGeneratingImageSlides(prev => {
      const next = new Set(prev);
      next.delete(slide.page);
      return next;
    });
  };

  const handleGenerateAllImages = async () => {
    if (!slides) return;
    const slidesWithPrompts = slides.filter(s => s.imagePrompt);
    if (slidesWithPrompts.length === 0) return;
    setAllImagesProgress({ done: 0, total: slidesWithPrompts.length });
    setGeneratingImageSlides(new Set(slidesWithPrompts.map(s => s.page)));
    let done = 0;
    for (const slide of slidesWithPrompts) {
      try {
        const img = await window.electronAPI.fetchSlideImage(SLIDE_IMAGE_STYLE + slide.imagePrompt!);
        if (img) setSlideImages(prev => ({ ...prev, [slide.page]: img }));
      } catch { /* no-op */ }
      done++;
      setGeneratingImageSlides(prev => {
        const next = new Set(prev);
        next.delete(slide.page);
        return next;
      });
      setAllImagesProgress({ done, total: slidesWithPrompts.length });
    }
    setAllImagesProgress(null);
  };

  const handlePresentKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      setPresentIndex(i => Math.min((slides?.length ?? 1) - 1, i + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      setPresentIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'Escape') {
      setIsPresentMode(false);
    }
  }, [slides]);

  useEffect(() => {
    if (!isPresentMode) return;
    document.addEventListener('keydown', handlePresentKey);
    return () => document.removeEventListener('keydown', handlePresentKey);
  }, [isPresentMode, handlePresentKey]);

  const handleLoadStudentNames = async () => {
    const names = await window.electronAPI.getConfig('studentNames');
    if (names && typeof names === 'string' && names.trim()) {
      // 번호 포함 그대로 유지 (예: "1. 홍○수, 2. 김○영")
      const nameList = names.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).join(', ');
      const tag = `[우리반 학생: ${nameList}]`;
      setDetails(prev => {
        if (prev.includes('[우리반 학생:')) return prev.replace(/\[우리반 학생:[^\]]*\]/, tag);
        return prev ? `${tag}\n${prev}` : tag;
      });
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim() && !selectedStandardCode) {
      setError('주제/수업명 또는 성취기준을 하나 이상 입력해주세요.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    if (contentType === 'SLIDE') {
      setSlides(null);
      setSlideImages({});
      setGeneratingImageSlides(new Set());
      setAllImagesProgress(null);
      setIsPresentMode(false);
    } else if (contentType === 'WORKSHEET') {
      setWorksheetHtml(null);
    } else if (contentType === 'QUIZ') {
      setQuizHtml(null);
    } else {
      setPlanContent('');
    }
    startGeneration();

    const standardText = selectedStandard
      ? `[성취기준: ${selectedStandard.code} ${selectedStandard.text}]`
      : '';
    const effectiveTopic = topic.trim() || (selectedStandard ? `${selectedStandard.code} 성취기준 수업` : '수업');
    const params: LessonParams = {
      grade: selectedGradeLabel, subject, unit, topic: effectiveTopic,
      details: `${standardText}${standardText && details ? '\n' : ''}${details}`,
    };

    try {
      if (contentType === 'SLIDE') {
        const result = await generateLessonSlides(params, pageCount);
        setSlides(result);
      } else if (contentType === 'WORKSHEET') {
        const html = await generateLessonWorksheet(params, worksheetType, worksheetCount, includeScore);
        setWorksheetHtml(extractHtml(html));
      } else if (contentType === 'QUIZ') {
        const html = await generateLessonQuiz(params, questionCount);
        setQuizHtml(extractHtml(html));
      } else {
        const html = await generateLessonPlan(params);
        setPlanContent(extractHtml(html));
      }
    } catch (err: any) {
      setError(err.message || '자료 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      endGeneration();
    }
  };

  const handleSaveSlidesTxt = async () => {
    if (!slides) return;
    const text = slides.map(s =>
      `[슬라이드 ${s.page}] ${s.title}\n${s.content.map(c => `  • ${c}`).join('\n')}\n[교사 메모] ${s.notes}`
    ).join('\n\n---\n\n');
    await window.electronAPI.saveTxt(text, `${topic}_슬라이드.txt`);
  };

  const handleSaveSlidesMd = async () => {
    if (!slides) return;
    const md = slides.map(s =>
      `## 슬라이드 ${s.page}: ${s.title}\n\n${s.content.map(c => `- ${c}`).join('\n')}\n\n> 📌 교사 메모: ${s.notes}`
    ).join('\n\n---\n\n');
    await window.electronAPI.saveFile(md, `${topic}_슬라이드.md`, 'md');
  };

  const handleSaveSlidesPdf = async () => {
    if (!slides) return;
    const now = new Date();
    const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const slidesHtml = slides.map(s => `
      <div class="slide">
        <div class="slide-header">${s.page}. ${s.title}</div>
        <ul>${s.content.map(c => `<li>${c}</li>`).join('')}</ul>
        ${s.notes ? `<div class="notes">교사 메모: ${s.notes}</div>` : ''}
      </div>`).join('');
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${topic} 수업 슬라이드</title><style>
@page{size:A4;margin:20mm 15mm;}
*{box-sizing:border-box;}
body{margin:0;padding:0;font-family:'Malgun Gothic','Dotum',sans-serif;font-size:11pt;color:#000;background:#fff;}
.slide{page-break-inside:avoid;margin-bottom:24pt;border:1.5pt solid #e2a800;border-radius:6pt;overflow:hidden;}
.slide-header{background:#f5a800;color:#fff;font-size:13pt;font-weight:bold;padding:8pt 12pt;}
ul{margin:10pt 0 10pt 20pt;padding:0;}
li{margin-bottom:5pt;line-height:1.6;}
.notes{background:#f9f9f9;border-top:1pt dashed #ccc;padding:6pt 12pt;font-size:9pt;color:#555;font-style:italic;}
</style></head><body>${slidesHtml}</body></html>`;
    try {
      await (window.electronAPI as any).savePdf(html, `${topic}_슬라이드(${d}).pdf`);
    } catch { alert('PDF 저장 중 오류가 발생했습니다.'); }
  };

  const handleSaveHtmlPdf = async () => {
    const content = contentType === 'QUIZ' ? quizHtml : worksheetHtml;
    if (!content) return;
    const now = new Date();
    const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    try {
      await (window.electronAPI as any).savePdf(content, `${topic}(${d}).pdf`);
    } catch { alert('PDF 저장 중 오류가 발생했습니다.'); }
  };

  const handleSaveHtml = async () => {
    const content = contentType === 'QUIZ' ? quizHtml : worksheetHtml;
    if (!content) return;
    const now = new Date();
    const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    await window.electronAPI.saveFile(content, `${topic}(${d}).html`, 'html');
  };

  const currentTypeHasResult =
    (contentType === 'SLIDE' && slides !== null) ||
    (contentType === 'WORKSHEET' && worksheetHtml !== null) ||
    (contentType === 'QUIZ' && quizHtml !== null) ||
    (contentType === 'PLAN' && planContent !== '');

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA]">
      <div className="flex-1 flex overflow-hidden p-4 gap-4">

        {/* Left: input panel */}
        <div className="w-[360px] shrink-0 bg-white rounded-lg border border-gray-300 shadow-sm flex flex-col overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 shrink-0">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-500" />
              수업 정보 입력
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Grade & Subject */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>학년</label>
                <select className={inputClass} value={selectedGradeLabel} onChange={e => handleGradeChange(e.target.value)}>
                  {CURRICULUM_GRADES.map(g => (
                    <option key={g.label} value={g.label}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>교과</label>
                <select className={inputClass} value={subject} onChange={e => handleSubjectChange(e.target.value)}>
                  {currentSubjects.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Achievement Standards */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass}>성취기준 (2022 개정)</label>
                {selectedStandard && (
                  <button
                    onClick={() => setSelectedStandardCode('')}
                    className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                  >
                    선택 해제
                  </button>
                )}
              </div>

              {currentStandards.length > 0 ? (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  {selectedStandard && (
                    <div className="bg-amber-50 border-b border-amber-200 px-3 py-2">
                      <span className="text-[10px] font-bold text-amber-700 font-mono block">{selectedStandard.code}</span>
                      <p className="text-[11px] text-amber-800 leading-snug mt-0.5">{selectedStandard.text}</p>
                    </div>
                  )}
                  <div className="max-h-[220px] overflow-y-auto divide-y divide-gray-100">
                    {domains.map(domain => (
                      <div key={domain}>
                        <button
                          onClick={() => toggleDomain(domain)}
                          className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          {expandedDomains.has(domain)
                            ? <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                            : <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                          }
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">영역 {domain}</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{standardsByDomain[domain].length}개</span>
                        </button>
                        {expandedDomains.has(domain) && standardsByDomain[domain].map(std => (
                          <button
                            key={std.code}
                            onClick={() => setSelectedStandardCode(prev => prev === std.code ? '' : std.code)}
                            className={`w-full text-left px-3 py-2 border-t border-gray-50 hover:bg-amber-50 transition-colors ${
                              selectedStandardCode === std.code ? 'bg-amber-100' : ''
                            }`}
                          >
                            <span className="text-[10px] font-bold text-amber-600 font-mono block">{std.code}</span>
                            <span className="text-[11px] text-gray-700 leading-snug">{std.text}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  {selectedGradeLabel.includes('고등학교')
                    ? '고등학교 성취기준은 추가 요청사항란에 직접 입력해 주세요.'
                    : '해당 학년/교과의 성취기준을 찾을 수 없습니다.'}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>단원</label>
              <input type="text" className={inputClass} placeholder="예: 3단원. 우리 몸의 구조" value={unit} onChange={e => setUnit(e.target.value)} />
            </div>

            <div>
              <label className={labelClass}>주제 / 수업명 <span className="text-red-400">*</span></label>
              <input type="text" className={inputClass} placeholder="예: 소화 기관의 역할과 구조" value={topic} onChange={e => setTopic(e.target.value)} />
            </div>

            <hr className="border-gray-200" />

            {/* Content Type */}
            <div>
              <label className={labelClass}>자료 유형</label>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_TYPES.map(({ value, icon: Icon, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => setContentType(value)}
                    className={`flex flex-col items-start gap-1 p-2.5 rounded-lg border-2 text-left transition-all ${
                      contentType === value
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-gray-200 hover:border-amber-300 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${contentType === value ? 'text-amber-600' : 'text-gray-400'}`} />
                      <span className="text-xs font-bold">{label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific options */}
            {contentType === 'SLIDE' && (
              <div>
                <label className={labelClass}>슬라이드 수</label>
                <input type="number" className={inputClass} min={3} max={20} value={pageCount} onChange={e => setPageCount(parseInt(e.target.value) || 6)} />
              </div>
            )}

            {contentType === 'WORKSHEET' && (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>워크시트 유형</label>
                  <div className="flex gap-2">
                    {[{ val: 'activity', label: '워크시트' }, { val: 'assessment', label: '평가지' }].map(opt => (
                      <button key={opt.val} onClick={() => setWorksheetType(opt.val as any)}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-all ${worksheetType === opt.val ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>활동 수</label>
                  <input type="number" className={inputClass} min={1} max={10} value={worksheetCount} onChange={e => setWorksheetCount(Math.max(1, parseInt(e.target.value) || 2))} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input type="checkbox" checked={includeScore} onChange={e => setIncludeScore(e.target.checked)} className="rounded" />
                  점수란 포함
                </label>
              </div>
            )}

            {contentType === 'QUIZ' && (
              <div>
                <label className={labelClass}>문항 수</label>
                <input type="number" className={inputClass} min={3} max={20} value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value) || 5)} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass}>추가 요청사항 (선택)</label>
                <button
                  onClick={handleLoadStudentNames}
                  className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded transition-colors"
                  title="설정에서 저장한 우리 반 학생 이름을 자동으로 불러옵니다"
                >
                  <Users className="w-3 h-3" />
                  우리반 이름 불러오기
                </button>
              </div>
              <textarea className={`${inputClass} min-h-[80px] resize-none`} placeholder="특이사항, 강조할 내용, 제외할 내용 등을 자유롭게 입력하세요." value={details} onChange={e => setDetails(e.target.value)} />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                isGenerating ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="truncate">{loadingMessage}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  수업 자료 생성
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: output panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Slide result */}
          {contentType === 'SLIDE' && slides && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-lg border border-gray-300 shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">
                <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  수업 슬라이드 ({slides.length}장)
                  {allImagesProgress && (
                    <span className="flex items-center gap-1 text-xs font-normal text-amber-600">
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      이미지 생성 중 {allImagesProgress.done}/{allImagesProgress.total} ({Math.round(allImagesProgress.done / allImagesProgress.total * 100)}%)
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateAllImages}
                    disabled={!!allImagesProgress}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />전체 이미지 생성
                  </button>
                  <button
                    onClick={() => { setPresentIndex(0); setIsPresentMode(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />프레젠테이션
                  </button>
                  <button onClick={handleSaveSlidesPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition-colors">
                    <FileDown className="w-3.5 h-3.5" />PDF 저장
                  </button>
                  <button onClick={handleSaveSlidesMd} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded transition-colors">
                    <FileType className="w-3.5 h-3.5" />MD 저장
                  </button>
                  <button onClick={handleSaveSlidesTxt} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors">
                    <Download className="w-3.5 h-3.5" />TXT 저장
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#EAECEF]">
                {slides.map((slide) => (
                  <div key={slide.page} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 flex items-center gap-2">
                      <span className="text-xs font-black text-white/80 bg-white/20 px-2 py-0.5 rounded-full">{slide.page}</span>
                      <h3 className="text-sm font-black text-white truncate">{slide.title}</h3>
                    </div>
                    {slideImages[slide.page] ? (
                      <img src={slideImages[slide.page]} alt="" className="w-full object-cover" style={{height: 160}} />
                    ) : generatingImageSlides.has(slide.page) ? (
                      <div className="w-full bg-gray-100 flex flex-col items-center justify-center gap-1" style={{height: 80}}>
                        <svg className="animate-spin w-5 h-5 text-violet-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        <span className="text-[10px] text-gray-400">이미지 생성 중...</span>
                      </div>
                    ) : slide.imagePrompt ? (
                      <div className="w-full bg-gray-50 flex items-center justify-center border-b border-gray-100" style={{height: 56}}>
                        <button
                          onClick={() => handleGenerateSlideImage(slide)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-md transition-colors"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />이미지 생성
                        </button>
                      </div>
                    ) : null}
                    <div className="px-4 py-3">
                      <ul className="space-y-1.5 mb-3">
                        {slide.content.slice(0, 3).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-base text-gray-700">
                            <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                            <span className="line-clamp-2">{item}</span>
                          </li>
                        ))}
                      </ul>
                      {slide.notes && (
                        <div className="border-t border-gray-100 pt-2 mt-2">
                          <p className="text-xs text-gray-400 italic">[교사 메모] {slide.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HTML result (worksheet) */}
          {contentType === 'WORKSHEET' && worksheetHtml && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-lg border border-gray-300 shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">
                <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-amber-500" />
                  워크시트 미리보기
                </span>
                <div className="flex gap-2">
                  <button onClick={handleSaveHtmlPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition-colors">
                    <FileDown className="w-3.5 h-3.5" />PDF 저장
                  </button>
                  <button onClick={handleSaveHtml} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded transition-colors">
                    <Download className="w-3.5 h-3.5" />HTML 저장
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <iframe srcDoc={worksheetHtml} sandbox="allow-scripts" className="w-full h-full border-0" title="워크시트 미리보기" />
              </div>
            </div>
          )}

          {/* HTML result (quiz) */}
          {contentType === 'QUIZ' && quizHtml && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-lg border border-gray-300 shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">
                <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-amber-500" />
                  퀴즈 앱 미리보기
                </span>
                <div className="flex gap-2">
                  <button onClick={handleSaveHtmlPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded transition-colors">
                    <FileDown className="w-3.5 h-3.5" />PDF 저장
                  </button>
                  <button onClick={handleSaveHtml} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded transition-colors">
                    <Download className="w-3.5 h-3.5" />HTML 저장
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <iframe srcDoc={quizHtml} sandbox="allow-scripts" className="w-full h-full border-0" title="퀴즈 미리보기" />
              </div>
            </div>
          )}

          {/* Plan result */}
          {contentType === 'PLAN' && planContent && (
            <GeneratedDisplay
              content={planContent}
              title={`${topic} 수업 계획서`}
            />
          )}

          {/* Empty / loading state */}
          {!currentTypeHasResult && (
            <div className="flex-1 bg-white rounded-lg border border-gray-300 shadow-sm flex flex-col items-center justify-center text-center p-8">
              <div className="bg-amber-50 p-4 rounded-full mb-4">
                <BookOpen className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-600 mb-2">
                {isGenerating ? '수업 자료를 생성하는 중...' : '수업 자료를 생성해 주세요'}
              </h3>
              {isGenerating ? (
                <p className="text-sm text-gray-400 max-w-xs">{loadingMessage}</p>
              ) : (
                <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                  왼쪽에서 학년·교과·성취기준·주제와 자료 유형을 선택한 후<br />생성 버튼을 눌러주세요.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Presentation mode overlay */}
      {isPresentMode && slides && slides.length > 0 && (() => {
        const slide = slides[presentIndex];
        const img = slideImages[slide.page];
        return (
          <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col select-none" tabIndex={-1}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
              <span className="text-gray-400 text-sm truncate max-w-xs">{slide.title}</span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowNotes(n => !n)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${showNotes ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'}`}
                >
                  교사 메모 {showNotes ? '숨기기' : '보기'}
                </button>
                <span className="text-gray-500 text-sm tabular-nums">{presentIndex + 1} / {slides.length}</span>
                <button onClick={() => setIsPresentMode(false)} className="text-gray-400 hover:text-white transition-colors p-1 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Slide area */}
            <div className="flex-1 flex items-center justify-center p-6 min-h-0">
              <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{maxHeight: 'calc(100vh - 130px)'}}>
                {/* Title */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-5 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-white/60 bg-white/20 px-3 py-0.5 rounded-full tabular-nums shrink-0">{slide.page}</span>
                    <h2 className="text-5xl font-black text-white leading-tight">{slide.title}</h2>
                  </div>
                </div>
                {/* Body */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 px-8 py-6">
                    <ul className="space-y-4">
                      {slide.content.slice(0, 3).map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-amber-400 mt-1.5 shrink-0 text-3xl leading-none">•</span>
                          <span className="text-3xl font-medium leading-snug text-gray-800">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {img && (
                    <div className="w-[40%] shrink-0 overflow-hidden">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                {/* Notes */}
                {showNotes && slide.notes && (
                  <div className="bg-gray-50 border-t border-gray-200 px-8 py-3 shrink-0">
                    <p className="text-sm text-gray-500 italic">📌 {slide.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-5 pb-4 shrink-0">
              <button
                onClick={() => setPresentIndex(i => Math.max(0, i - 1))}
                disabled={presentIndex === 0}
                className="flex items-center gap-1.5 px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded-lg transition-colors font-semibold text-sm"
              >
                <ChevronLeft className="w-4 h-4" />이전
              </button>
              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPresentIndex(i)}
                    className={`h-2 rounded-full transition-all ${i === presentIndex ? 'bg-amber-400 w-4' : 'bg-gray-600 hover:bg-gray-500 w-2'}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setPresentIndex(i => Math.min(slides.length - 1, i + 1))}
                disabled={presentIndex === slides.length - 1}
                className="flex items-center gap-1.5 px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded-lg transition-colors font-semibold text-sm"
              >
                다음<ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default LessonMaterialGenerator;
