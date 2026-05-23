import React, { useState, useRef, useEffect } from 'react';
import { FileText, PenTool, ClipboardList, Wand2, AlertCircle, Layers, FileOutput, ArrowRight, Layout, MessageSquare, Calendar, AlignLeft, AlignJustify, List, CheckCircle, AlertTriangle, Receipt, Users, Megaphone, Mail, Smartphone, Monitor, Megaphone as MegaphoneIcon } from 'lucide-react';
import { DocType, GongmunInputs, PlanInputs, ReportInputs, MessageInputs, NewsletterInputs, PumuiInputs, MeetingMinutesInputs, PromotionInputs, GonggoInputs, FileData, GongmunType, MessageTarget, MessageType, GongmunComplexity, PumuiType } from '../types';
import { generateDocument } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { GeneratedDisplay } from './GeneratedDisplay';
import { LOADING_MESSAGES } from '../constants';

// ─── SchoolDocPanel ──────────────────────────────────────────────────────────

interface SchoolDocPanelProps {
  initialTab?: DocType;
}

export const SchoolDocPanel: React.FC<SchoolDocPanelProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<DocType>(initialTab ?? DocType.GONGMUN);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [schoolYear, setSchoolYear] = useState('2026');
  const [pageCount, setPageCount] = useState(2);

  // Per-tab file/template state
  const allDocTypes = [
    DocType.GONGMUN, DocType.PLAN, DocType.REPORT, DocType.PUMUI,
    DocType.MEETING_MINUTES, DocType.PROMOTION, DocType.NEWSLETTER,
    DocType.MESSAGE, DocType.GONGGO,
  ];

  const initTabMap = <T,>(defaultValue: T): Record<DocType, T> => {
    const map = {} as Record<DocType, T>;
    allDocTypes.forEach(dt => { map[dt] = defaultValue; });
    return map;
  };

  const [filesByTab, setFilesByTab] = useState<Record<DocType, FileData[]>>(initTabMap([]));
  const [templatesByTab, setTemplatesByTab] = useState<Record<DocType, FileData[]>>(initTabMap([]));
  const [templateTextByTab, setTemplateTextByTab] = useState<Record<DocType, string>>(initTabMap(''));
  const [hwpxFillDataByTab, setHwpxFillDataByTab] = useState<Record<DocType, any[] | null>>(initTabMap(null));
  const [contentByTab, setContentByTab] = useState<Record<DocType, string>>(initTabMap(''));

  const uploadedFiles = filesByTab[activeTab] ?? [];
  const uploadedTemplates = templatesByTab[activeTab] ?? [];
  const templateText = templateTextByTab[activeTab] ?? '';
  const generatedContent = contentByTab[activeTab] ?? '';
  const hwpxFillData = hwpxFillDataByTab[activeTab] ?? null;

  // Gongmun form
  const [gongmunData, setGongmunData] = useState<GongmunInputs>({
    type: GongmunType.INTERNAL,
    complexity: GongmunComplexity.MEDIUM,
    recipient: '',
    title: '',
    bodyContext: '',
  });

  // Plan form
  const [planData, setPlanData] = useState<PlanInputs>({
    topic: '',
    target: '',
    budget: '',
    extraInfo: '',
  });

  // Report form
  const [reportData, setReportData] = useState<ReportInputs>({
    summary: '',
  });

  // Newsletter form
  const [newsletterData, setNewsletterData] = useState<NewsletterInputs>({
    title: '',
    target: '',
    context: '',
  });

  // Message form
  const [messageData, setMessageData] = useState<MessageInputs>({
    target: MessageTarget.PARENT,
    type: MessageType.SMS,
    context: '',
  });

  // Pumui form
  const [pumuiData, setPumuiData] = useState<PumuiInputs>({
    type: PumuiType.GOODS,
    title: '',
    relatedDoc: '',
    budget: '',
    calcDetails: '',
    details: '',
    purpose: '',
    target: '',
    datetime: '',
    place: '',
    agenda: '',
    attendees: '',
  });

  // Meeting minutes form
  const [meetingMinutesData, setMeetingMinutesData] = useState<MeetingMinutesInputs>({
    title: '',
    schoolName: '',
    datetime: '',
    place: '',
    attendees: '',
    topic: '',
    context: '',
  });

  // Promotion form
  const [promotionData, setPromotionData] = useState<PromotionInputs>({
    schoolName: '',
    datetime: '',
    target: '',
    content: '',
    purpose: '',
    interview: '',
  });

  // Gonggo form
  const [gonggoData, setGonggoData] = useState<GonggoInputs>({
    title: '',
    number: '',
    content: '',
    deadline: '',
    contact: '',
    extraInfo: '',
  });

  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load school name from config on mount
  useEffect(() => {
    window.electronAPI.getConfig('schoolName').then((v: unknown) => {
      const val = v as string;
      setMeetingMinutesData(prev => ({ ...prev, schoolName: prev.schoolName || val || '' }));
    });
  }, []);

  // Loading message cycling
  useEffect(() => {
    if (isGenerating) {
      let idx = 0;
      setLoadingMessage(LOADING_MESSAGES[0]);
      loadingIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[idx]);
      }, 2500);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    }
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [isGenerating]);

  // ─── Build prompt context ──────────────────────────────────────────────────

  const buildPromptContext = (): string => {
    switch (activeTab) {
      case DocType.GONGMUN: {
        const typeLabel = gongmunData.type === GongmunType.INTERNAL ? '내부결재' : '대외공문';
        return `[공문 유형]: ${typeLabel}\n[수신자]: ${gongmunData.recipient || '(미입력)'}\n[제목]: ${gongmunData.title || '(미입력)'}\n[본문 요청사항]: ${gongmunData.bodyContext || '(미입력)'}`;
      }
      case DocType.PLAN:
        return `[주제/사업명]: ${planData.topic}\n[대상]: ${planData.target}\n[예산]: ${planData.budget}\n[추가 사항]: ${planData.extraInfo}`;
      case DocType.REPORT:
        return `[결과 요약 및 요청사항]: ${reportData.summary}`;
      case DocType.NEWSLETTER:
        return `[제목]: ${newsletterData.title}\n[대상]: ${newsletterData.target}\n[내용]: ${newsletterData.context}`;
      case DocType.MESSAGE: {
        const typeLabel = messageData.type === MessageType.SMS ? '단문(SMS)' : '장문(LMS)';
        return `[수신 대상]: ${messageData.target}\n[문자 유형]: ${typeLabel}\n[내용]: ${messageData.context}`;
      }
      case DocType.PUMUI: {
        let ctx = `[품의 유형]: ${pumuiData.type}\n[품의 제목/건명]: ${pumuiData.title}\n[관련 공문/근거]: ${pumuiData.relatedDoc}\n[소요 예산]: ${pumuiData.budget}원\n[산출 내역]: ${pumuiData.calcDetails}`;
        if (pumuiData.type === PumuiType.GOODS) {
          ctx += `\n[세부 내역(물품명, 수량, 단가)]: ${pumuiData.details || ''}\n[구입 목적]: ${pumuiData.purpose || ''}`;
        } else if (pumuiData.type === PumuiType.ALLOWANCE) {
          ctx += `\n[지급 대상]: ${pumuiData.target || ''}\n[사업 일시]: ${pumuiData.datetime || ''}`;
        } else if (pumuiData.type === PumuiType.BIZ_PROMOTION) {
          ctx += `\n[일시]: ${pumuiData.datetime || ''}\n[장소]: ${pumuiData.place || ''}\n[협의 안건]: ${pumuiData.agenda || ''}\n[참석자]: ${pumuiData.attendees || ''}`;
        }
        return ctx;
      }
      case DocType.MEETING_MINUTES:
        return `[제목]: ${meetingMinutesData.title}\n[학교명]: ${meetingMinutesData.schoolName}\n[일시]: ${meetingMinutesData.datetime}\n[장소]: ${meetingMinutesData.place}\n[출석자]: ${meetingMinutesData.attendees}\n[회의 안건]: ${meetingMinutesData.topic}\n[회의 내용]: ${meetingMinutesData.context}`;
      case DocType.PROMOTION:
        return `[학교명]: ${promotionData.schoolName}\n[행사 일시]: ${promotionData.datetime}\n[대상]: ${promotionData.target}\n[내용]: ${promotionData.content}\n[목적/의의]: ${promotionData.purpose}\n[인터뷰 대상자]: ${promotionData.interview}`;
      default:
        return '';
    }
  };

  // ─── Get HWPX data for template filling ───────────────────────────────────

  const getHwpxTitleFromContent = (content: string, tab: DocType): string => {
    let title = '';
    if (tab === DocType.GONGMUN) title = gongmunData.title;
    else if (tab === DocType.PLAN) title = planData.topic;
    else if (tab === DocType.REPORT) title = reportData.summary.substring(0, 30);
    else if (tab === DocType.NEWSLETTER) title = newsletterData.title;
    else if (tab === DocType.MESSAGE) title = messageData.context.substring(0, 20);
    else if (tab === DocType.PUMUI) title = pumuiData.title;
    else if (tab === DocType.MEETING_MINUTES) title = meetingMinutesData.title;
    else if (tab === DocType.PROMOTION) title = promotionData.content.substring(0, 30);
    else if (tab === DocType.GONGGO) title = gonggoData.title;
    return title || 'document';
  };

  const parseHwpxFillData = (content: string, tab: DocType): any[] | null => {
    if (uploadedTemplates.length === 0) return null;
    // Return simple fill data array for hwpx template
    const title = getHwpxTitleFromContent(content, tab);
    return [{ key: '문서제목', value: title }, { key: '내용', value: content }];
  };

  // ─── Handle Generate ───────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      let result: string;
      if (activeTab === DocType.GONGGO) {
        result = await generateDocument(
          activeTab,
          '',
          undefined,
          pageCount,
          schoolYear,
          uploadedFiles,
          uploadedTemplates,
          templateText,
          GongmunComplexity.MEDIUM,
          gonggoData,
        );
      } else {
        const context = buildPromptContext();
        const gongmunType = activeTab === DocType.GONGMUN ? gongmunData.type : undefined;
        const gongmunComplexity = activeTab === DocType.GONGMUN ? gongmunData.complexity : GongmunComplexity.MEDIUM;
        result = await generateDocument(
          activeTab,
          context,
          gongmunType,
          pageCount,
          schoolYear,
          uploadedFiles,
          uploadedTemplates,
          templateText,
          gongmunComplexity,
          undefined,
        );
      }
      setContentByTab(prev => ({ ...prev, [activeTab]: result }));
      const fillData = parseHwpxFillData(result, activeTab);
      setHwpxFillDataByTab(prev => ({ ...prev, [activeTab]: fillData }));
    } catch (err: any) {
      setError(err.message || 'AI 문서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Tab definitions ───────────────────────────────────────────────────────

  const tabs = [
    { type: DocType.GONGMUN, icon: FileText, label: '공문서 작성' },
    { type: DocType.PLAN, icon: ClipboardList, label: '계획서 작성' },
    { type: DocType.REPORT, icon: FileOutput, label: '보고서 작성' },
    { type: DocType.PUMUI, icon: Receipt, label: '품의서 작성' },
    { type: DocType.MEETING_MINUTES, icon: Users, label: '회의록 작성' },
    { type: DocType.PROMOTION, icon: Megaphone, label: '홍보자료 작성' },
    { type: DocType.NEWSLETTER, icon: Mail, label: '가정통신문 작성' },
    { type: DocType.MESSAGE, icon: Smartphone, label: '문자메세지 작성' },
    { type: DocType.GONGGO, icon: MegaphoneIcon, label: '공고문 작성' },
  ];

  // ─── Style helpers ─────────────────────────────────────────────────────────

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide';
  const sectionClass = 'mb-4';

  // ─── Render ────────────────────────────────────────────────────────────────

  const hwpxTemplateFile = uploadedTemplates.length > 0 ? uploadedTemplates[0].file : undefined;

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA]">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left: input panel */}
        <div className="w-[360px] shrink-0 bg-white rounded-lg border border-gray-300 shadow-sm flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 shrink-0">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-blue-500" />
              입력 정보
            </h3>
          </div>

          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Common settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>학년도</label>
                <input
                  type="text"
                  className={inputClass}
                  value={schoolYear}
                  onChange={e => setSchoolYear(e.target.value)}
                  placeholder="예: 2026"
                />
              </div>
              {(activeTab === DocType.PLAN || activeTab === DocType.REPORT || activeTab === DocType.PROMOTION) && (
                <div>
                  <label className={labelClass}>분량 (쪽)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={pageCount}
                    min={1}
                    max={10}
                    onChange={e => setPageCount(parseInt(e.target.value) || 2)}
                  />
                </div>
              )}
            </div>

            <hr className="border-gray-200" />

            {/* Dynamic form by tab */}

            {/* 공문서 */}
            {activeTab === DocType.GONGMUN && (
              <div className="space-y-4">
                <div className={sectionClass}>
                  <label className={labelClass}>공문 유형</label>
                  <div className="flex gap-2">
                    {[
                      { val: GongmunType.INTERNAL, label: '내부결재' },
                      { val: GongmunType.EXTERNAL, label: '대외공문' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setGongmunData({ ...gongmunData, type: opt.val })}
                        className={`flex-1 py-1.5 text-sm rounded-md border transition-all ${
                          gongmunData.type === opt.val
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={sectionClass}>
                  <label className={labelClass}>공문 복잡도</label>
                  <div className="flex gap-2">
                    {[
                      { val: GongmunComplexity.SIMPLE, label: '간단' },
                      { val: GongmunComplexity.MEDIUM, label: '중간' },
                      { val: GongmunComplexity.DETAILED, label: '상세' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setGongmunData({ ...gongmunData, complexity: opt.val })}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-all ${
                          gongmunData.complexity === opt.val
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {gongmunData.type === GongmunType.EXTERNAL && (
                  <div>
                    <label className={labelClass}>수신자</label>
                    <input type="text" className={inputClass} placeholder="예: ○○교육지원청 교육장" value={gongmunData.recipient} onChange={e => setGongmunData({ ...gongmunData, recipient: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className={labelClass}>제목 (건명)</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 현장체험학습 운영 계획 안내" value={gongmunData.title} onChange={e => setGongmunData({ ...gongmunData, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>본문 요청 사항</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="공문에 들어갈 핵심 내용, 일시, 장소, 대상 등을 자유롭게 입력하세요." value={gongmunData.bodyContext} onChange={e => setGongmunData({ ...gongmunData, bodyContext: e.target.value })} />
                </div>
              </div>
            )}

            {/* 계획서 */}
            {activeTab === DocType.PLAN && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>주제 / 사업명</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 독서교육 활성화 계획" value={planData.topic} onChange={e => setPlanData({ ...planData, topic: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>대상</label>
                  <input type="text" className={inputClass} placeholder="예: 전교생, 3학년, 교직원" value={planData.target} onChange={e => setPlanData({ ...planData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>예산 (원)</label>
                  <input type="text" className={inputClass} placeholder="예: 1,500,000" value={planData.budget} onChange={e => setPlanData({ ...planData, budget: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>추가 사항 (선택)</label>
                  <textarea className={`${inputClass} min-h-[100px] resize-none`} placeholder="포함되어야 할 특이사항, 일정, 방법 등을 자유롭게 입력하세요." value={planData.extraInfo} onChange={e => setPlanData({ ...planData, extraInfo: e.target.value })} />
                </div>
              </div>
            )}

            {/* 보고서 */}
            {activeTab === DocType.REPORT && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>결과 요약 및 요청사항</label>
                  <textarea className={`${inputClass} min-h-[160px] resize-none`} placeholder="보고서로 작성할 내용을 요약하여 입력하세요. 행사명, 일시, 장소, 참여 인원, 주요 내용, 성과 등을 포함해 주세요." value={reportData.summary} onChange={e => setReportData({ ...reportData, summary: e.target.value })} />
                </div>
              </div>
            )}

            {/* 품의서 */}
            {activeTab === DocType.PUMUI && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>품의 유형</label>
                  <div className="flex gap-2">
                    {[
                      { val: PumuiType.GOODS, label: '물품 구입' },
                      { val: PumuiType.ALLOWANCE, label: '수당 지급' },
                      { val: PumuiType.BIZ_PROMOTION, label: '업무추진비' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setPumuiData({ ...pumuiData, type: opt.val })}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-all ${
                          pumuiData.type === opt.val
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>품의 제목 / 건명</label>
                  <input type="text" className={inputClass} placeholder="예: 수학 교구 구입 품의" value={pumuiData.title} onChange={e => setPumuiData({ ...pumuiData, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>관련 공문 / 근거</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 교육과정 운영 계획" value={pumuiData.relatedDoc} onChange={e => setPumuiData({ ...pumuiData, relatedDoc: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>소요 예산 (원)</label>
                  <input type="text" className={inputClass} placeholder="예: 300,000" value={pumuiData.budget} onChange={e => setPumuiData({ ...pumuiData, budget: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>산출 내역</label>
                  <input type="text" className={inputClass} placeholder="예: 노트 20권 × 5,000원 = 100,000원" value={pumuiData.calcDetails} onChange={e => setPumuiData({ ...pumuiData, calcDetails: e.target.value })} />
                </div>
                {pumuiData.type === PumuiType.GOODS && (
                  <>
                    <div>
                      <label className={labelClass}>세부 내역 (물품명, 수량, 단가)</label>
                      <textarea className={`${inputClass} min-h-[80px] resize-none`} placeholder="구입할 물품 목록을 입력하세요." value={pumuiData.details || ''} onChange={e => setPumuiData({ ...pumuiData, details: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>구입 목적</label>
                      <input type="text" className={inputClass} placeholder="예: 수업 자료 보강" value={pumuiData.purpose || ''} onChange={e => setPumuiData({ ...pumuiData, purpose: e.target.value })} />
                    </div>
                  </>
                )}
                {pumuiData.type === PumuiType.ALLOWANCE && (
                  <>
                    <div>
                      <label className={labelClass}>지급 대상</label>
                      <input type="text" className={inputClass} placeholder="예: 방과후 강사 3명" value={pumuiData.target || ''} onChange={e => setPumuiData({ ...pumuiData, target: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>사업 일시</label>
                      <input type="text" className={inputClass} placeholder="예: 2026. 3. 1. ~ 6. 30." value={pumuiData.datetime || ''} onChange={e => setPumuiData({ ...pumuiData, datetime: e.target.value })} />
                    </div>
                  </>
                )}
                {pumuiData.type === PumuiType.BIZ_PROMOTION && (
                  <>
                    <div>
                      <label className={labelClass}>일시</label>
                      <input type="text" className={inputClass} placeholder="예: 2026. 4. 10.(금) 15:00" value={pumuiData.datetime || ''} onChange={e => setPumuiData({ ...pumuiData, datetime: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>장소</label>
                      <input type="text" className={inputClass} placeholder="예: 교장실" value={pumuiData.place || ''} onChange={e => setPumuiData({ ...pumuiData, place: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>협의 안건</label>
                      <textarea className={`${inputClass} min-h-[80px] resize-none`} placeholder="협의할 주요 안건을 입력하세요." value={pumuiData.agenda || ''} onChange={e => setPumuiData({ ...pumuiData, agenda: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>참석자</label>
                      <input type="text" className={inputClass} placeholder="예: 교장, 교감, 부장교사" value={pumuiData.attendees || ''} onChange={e => setPumuiData({ ...pumuiData, attendees: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 회의록 */}
            {activeTab === DocType.MEETING_MINUTES && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>회의 제목</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 1학기 교육과정위원회 협의회" value={meetingMinutesData.title} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>학교명</label>
                  <input type="text" className={inputClass} placeholder="예: ○○초등학교" value={meetingMinutesData.schoolName} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, schoolName: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>일시</label>
                  <input type="text" className={inputClass} placeholder="예: 2026. 3. 5.(목) 16:00" value={meetingMinutesData.datetime} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, datetime: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>장소</label>
                  <input type="text" className={inputClass} placeholder="예: 교무실" value={meetingMinutesData.place} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, place: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>출석위원</label>
                  <input type="text" className={inputClass} placeholder="예: 교장, 교감, 교무부장, 연구부장" value={meetingMinutesData.attendees} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, attendees: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>회의 안건</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 교육과정 편성 검토" value={meetingMinutesData.topic} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, topic: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>회의 내용 요약</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="회의에서 논의된 주요 내용, 결정 사항, 발언 요점 등을 입력하세요." value={meetingMinutesData.context} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, context: e.target.value })} />
                </div>
              </div>
            )}

            {/* 홍보자료 */}
            {activeTab === DocType.PROMOTION && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>학교명</label>
                  <input type="text" className={inputClass} placeholder="예: ○○초등학교" value={promotionData.schoolName} onChange={e => setPromotionData({ ...promotionData, schoolName: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>행사 일시</label>
                  <input type="text" className={inputClass} placeholder="예: 2026. 5. 15.(금) 10:00" value={promotionData.datetime} onChange={e => setPromotionData({ ...promotionData, datetime: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>홍보 대상</label>
                  <input type="text" className={inputClass} placeholder="예: 학부모, 지역 주민" value={promotionData.target} onChange={e => setPromotionData({ ...promotionData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>홍보 내용</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="행사 내용, 프로그램, 특이사항 등을 입력하세요." value={promotionData.content} onChange={e => setPromotionData({ ...promotionData, content: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>목적 / 의의</label>
                  <input type="text" className={inputClass} placeholder="예: 지역사회와의 교육 공동체 형성" value={promotionData.purpose} onChange={e => setPromotionData({ ...promotionData, purpose: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>인터뷰 대상자 (선택)</label>
                  <input type="text" className={inputClass} placeholder="예: 교장 선생님, 담당 교사" value={promotionData.interview} onChange={e => setPromotionData({ ...promotionData, interview: e.target.value })} />
                </div>
              </div>
            )}

            {/* 가정통신문 */}
            {activeTab === DocType.NEWSLETTER && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>제목</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 학교 운동회 안내" value={newsletterData.title} onChange={e => setNewsletterData({ ...newsletterData, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>수신 대상</label>
                  <input type="text" className={inputClass} placeholder="예: 전교생 학부모님" value={newsletterData.target} onChange={e => setNewsletterData({ ...newsletterData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>안내 내용</label>
                  <textarea className={`${inputClass} min-h-[140px] resize-none`} placeholder="가정통신문에 포함될 주요 내용, 일시, 장소, 준비물, 협조 사항 등을 입력하세요." value={newsletterData.context} onChange={e => setNewsletterData({ ...newsletterData, context: e.target.value })} />
                </div>
              </div>
            )}

            {/* 문자메세지 */}
            {activeTab === DocType.MESSAGE && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>수신 대상</label>
                  <div className="flex gap-2">
                    {[MessageTarget.PARENT, MessageTarget.TEACHER, MessageTarget.STUDENT].map(t => (
                      <button
                        key={t}
                        onClick={() => setMessageData({ ...messageData, target: t })}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-all ${
                          messageData.target === t
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>문자 유형</label>
                  <div className="flex gap-2">
                    {[
                      { val: MessageType.SMS, label: '단문 (SMS)' },
                      { val: MessageType.LMS, label: '장문 (LMS)' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setMessageData({ ...messageData, type: opt.val })}
                        className={`flex-1 py-1.5 text-sm rounded-md border transition-all ${
                          messageData.type === opt.val
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>전달 내용</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="문자에 담을 내용을 입력하세요." value={messageData.context} onChange={e => setMessageData({ ...messageData, context: e.target.value })} />
                </div>
              </div>
            )}

            {/* 공고문 */}
            {activeTab === DocType.GONGGO && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>공고 제목</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 방과후학교 강사 모집 공고" value={gonggoData.title} onChange={(e) => setGonggoData({...gonggoData, title: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>공고 번호 (선택)</label>
                  <input type="text" className={inputClass} placeholder="예: 제2026-001호" value={gonggoData.number} onChange={(e) => setGonggoData({...gonggoData, number: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>공고 내용 요약</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="모집/공고 내용을 요약하여 입력하세요." value={gonggoData.content} onChange={(e) => setGonggoData({...gonggoData, content: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>접수 기간 / 마감일</label>
                  <input type="text" className={inputClass} placeholder="예: 2026. 3. 1.(일) ~ 3. 15.(일)" value={gonggoData.deadline} onChange={(e) => setGonggoData({...gonggoData, deadline: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>문의처</label>
                  <input type="text" className={inputClass} placeholder="예: 교무부 (054-000-0000)" value={gonggoData.contact} onChange={(e) => setGonggoData({...gonggoData, contact: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>추가 사항 (선택)</label>
                  <textarea className={`${inputClass} min-h-[80px] resize-none`} placeholder="기타 공고에 포함될 추가 사항" value={gonggoData.extraInfo} onChange={(e) => setGonggoData({...gonggoData, extraInfo: e.target.value})} />
                </div>
              </div>
            )}

            <hr className="border-gray-200" />

            {/* File uploads */}
            <div>
              <FileUpload
                label="참고 자료 (선택)"
                files={uploadedFiles}
                onFilesChange={files => setFilesByTab(prev => ({ ...prev, [activeTab]: files }))}
                multiple={true}
              />
            </div>

            <div>
              <div className="mb-2">
                <label className={labelClass}>양식 / 템플릿 (선택)</label>
              </div>
              <FileUpload
                label="양식 파일 업로드"
                files={uploadedTemplates}
                onFilesChange={files => setTemplatesByTab(prev => ({ ...prev, [activeTab]: files }))}
                multiple={false}
              />
              <div className="mt-2">
                <label className={labelClass}>양식 직접 입력 (선택)</label>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-none`}
                  placeholder="양식 구조나 항목을 텍스트로 직접 입력해도 됩니다."
                  value={templateText}
                  onChange={e => setTemplateTextByTab(prev => ({ ...prev, [activeTab]: e.target.value }))}
                />
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                isGenerating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-[0.98]'
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
                  {activeTab === DocType.GONGMUN ? '공문서 생성' :
                   activeTab === DocType.PLAN ? '계획서 생성' :
                   activeTab === DocType.REPORT ? '보고서 생성' :
                   activeTab === DocType.PUMUI ? '품의서 생성' :
                   activeTab === DocType.MEETING_MINUTES ? '회의록 생성' :
                   activeTab === DocType.PROMOTION ? '홍보자료 생성' :
                   activeTab === DocType.NEWSLETTER ? '가정통신문 생성' :
                   activeTab === DocType.MESSAGE ? '문자메세지 생성' :
                   activeTab === DocType.GONGGO ? '공고문 생성' :
                   '문서 생성'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: output panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {generatedContent ? (
            <GeneratedDisplay
              content={generatedContent}
              hwpxFillData={hwpxFillData}
              hwpxTemplate={hwpxTemplateFile}
            />
          ) : (
            <div className="flex-1 bg-white rounded-lg border border-gray-300 shadow-sm flex flex-col items-center justify-center text-center p-8">
              <div className="bg-blue-50 p-4 rounded-full mb-4">
                <FileText className="w-10 h-10 text-blue-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-600 mb-2">
                {isGenerating ? '문서를 생성하는 중...' : '문서를 생성해 주세요'}
              </h3>
              {isGenerating ? (
                <p className="text-sm text-gray-400 max-w-xs">{loadingMessage}</p>
              ) : (
                <p className="text-sm text-gray-400 max-w-xs">
                  왼쪽 패널에서 탭을 선택하고 필요한 정보를 입력한 후<br />생성 버튼을 눌러주세요.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchoolDocPanel;
