import React, { useState, useRef, useEffect } from 'react';
import { FileText, PenTool, ClipboardList, Wand2, AlertCircle, Layers, FileOutput, ArrowRight, Layout, MessageSquare, Calendar, AlignLeft, AlignJustify, List, CheckCircle, AlertTriangle, Receipt, Users, Megaphone, Mail, Smartphone, Monitor, Megaphone as MegaphoneIcon, PanelLeftClose, PanelLeftOpen, HelpCircle, GraduationCap, Search } from 'lucide-react';
import type { GroundingInfo } from '../../preload/types';
import { DocType, GongmunInputs, PlanInputs, TrainingMaterialInputs, ReportInputs, MessageInputs, NewsletterInputs, PumuiInputs, MeetingMinutesInputs, PromotionInputs, GonggoInputs, FileData, GongmunType, MessageTarget, MessageType, MessageRelationship, GongmunComplexity, PumuiType, AppMode } from '../types';
import { generateDocument } from '../services/geminiService';
import { safeSetItem } from '../lib/safeStorage';
import { FileUpload } from './FileUpload';
import { GeneratedDisplay } from './GeneratedDisplay';
import { useTour } from '../TourContext';
import { LOADING_MESSAGES } from '../constants';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';
import { stripGeneratedCodeFences } from '../lib/generatedContent';
import { applyOutlineStyles, OUTLINE_FORMATTED_DOC_TYPES } from '../lib/outlineFormat';
import {
  DEFAULT_TRAINING_MATERIAL_SECTIONS,
  TRAINING_SECTION_OPTIONS,
  buildTrainingMaterialPromptContext,
} from '../lib/trainingMaterial';
import {
  buildInstitutionFormatInstruction,
  normalizeInstitutionFormat,
  type InstitutionFormat,
} from '../lib/workflowFeatures';
import {
  BULLET_STYLE_OPTIONS,
  EMPTY_INSTITUTION_FORMAT_DRAFT,
  ENDING_STYLE_OPTIONS,
  draftFromPreset,
  presetById,
  presetsForDocType,
  type InstitutionFormatDraft,
} from '../lib/institutionFormatPresets';
import { EXAMPLE_DOCS } from '../lib/documentExamples';


// ─── SchoolDocPanel ──────────────────────────────────────────────────────────

interface SchoolDocPanelProps {
  initialTab?: DocType;
}

interface SettingsProfile {
  institution: string;
}

interface DocTemplateFavorite {
  id: string;
  docType: DocType;
  title: string;
  text: string;
  createdAt: string;
}

const DOC_TEMPLATE_FAVORITES_KEY = 'edunote_doc_template_favorites_v1';

// 기관 서식 드롭다운의 특수 선택 값
const FORMAT_CHOICE_CUSTOM = 'custom';
const FORMAT_CHOICE_PRESET_PREFIX = 'preset:';

export const SchoolDocPanel: React.FC<SchoolDocPanelProps> = ({ initialTab }) => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.SCHOOL_DOC);
  const { startTour } = useTour();
  const [activeTab, setActiveTab] = useState<DocType>(initialTab ?? DocType.GONGMUN);
  const [settingsProfile, setSettingsProfile] = useState<SettingsProfile>({
    institution: '',
  });

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [isGenerating, setIsGenerating] = useState(false);
  // 스트리밍 생성 중간 텍스트 (생성 중 미리보기용)
  const [streamPreview, setStreamPreview] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inputPanelCollapsed, setInputPanelCollapsed] = useState(false);
  const currentSchoolYear = (() => { const now = new Date(); return String(now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear()); })();
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear);
  const [pageCount, setPageCount] = useState(2);

  // Per-tab file/template state
  const allDocTypes = [
    DocType.GONGMUN, DocType.PLAN, DocType.TRAINING_MATERIAL, DocType.REPORT, DocType.PUMUI,
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
  const [templateFavorites, setTemplateFavorites] = useState<DocTemplateFavorite[]>([]);
  const [institutionFormats, setInstitutionFormats] = useState<InstitutionFormat[]>([]);
  // 기관 서식 선택 값 — '' 사용 안 함, FORMAT_CHOICE_CUSTOM 직접 입력,
  // 'preset:<id>' 기본 제공 서식, 그 밖에는 저장한 서식의 id.
  const [formatChoice, setFormatChoice] = useState('');
  const [formatDraft, setFormatDraft] = useState<InstitutionFormatDraft>(EMPTY_INSTITUTION_FORMAT_DRAFT);
  const [hwpxFillDataByTab, setHwpxFillDataByTab] = useState<Record<DocType, any[] | null>>(initTabMap(null));
  const [contentByTab, setContentByTab] = useState<Record<DocType, string>>(initTabMap(''));
  const [modelByTab, setModelByTab] = useState<Record<DocType, string>>(initTabMap(''));
  const [groundingByTab, setGroundingByTab] = useState<Record<DocType, GroundingInfo | undefined>>(initTabMap(undefined));
  // 연수자료의 웹 검색 참조 여부 — 검색 건수만큼 과금되고 무료 키는 한도를 넘으면 생성이
  // 실패하므로, 이전에 켰더라도 앱을 다시 열면 항상 꺼진 상태로 시작한다.
  const [useWebSearch, setUseWebSearch] = useState(false);

  const uploadedFiles = filesByTab[activeTab] ?? [];
  const uploadedTemplates = templatesByTab[activeTab] ?? [];
  const templateText = templateTextByTab[activeTab] ?? '';
  const generatedContent = contentByTab[activeTab] ?? '';
  const generatedModel = modelByTab[activeTab] ?? '';
  const generatedGrounding = groundingByTab[activeTab];
  const hwpxFillData = hwpxFillDataByTab[activeTab] ?? null;
  const activeTemplateFavorites = templateFavorites.filter(item => item.docType === activeTab);
  const activeInstitutionFormats = institutionFormats.filter(item => item.docType === activeTab);
  const { recommended: recommendedPresets, others: otherPresets } = presetsForDocType(activeTab);
  // 저장한 서식을 고른 상태에서만 삭제할 수 있다.
  const savedFormatSelected = activeInstitutionFormats.some(item => item.id === formatChoice);
  // 저장 여부와 관계없이 화면에 보이는 값이 곧 이번 생성에 쓰이는 서식이다.
  const formatInstruction = formatChoice ? buildInstitutionFormatInstruction(formatDraft) : '';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DOC_TEMPLATE_FAVORITES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setTemplateFavorites(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTemplateFavorites([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.readJsonData('institution-formats')
      .then(data => {
        if (cancelled) return;
        const formats = Array.isArray(data)
          ? data.filter(item => item && typeof item === 'object').map(item => normalizeInstitutionFormat(item as Record<string, unknown>))
          : [];
        setInstitutionFormats(formats);
      })
      .catch(() => { if (!cancelled) setInstitutionFormats([]); });
    return () => { cancelled = true; };
  }, []);

  // 문서 종류를 바꾸면 그 문서에 맞는 서식을 다시 고르게 한다.
  useEffect(() => {
    setFormatChoice('');
    setFormatDraft(EMPTY_INSTITUTION_FORMAT_DRAFT);
  }, [activeTab]);

  const saveInstitutionFormats = async (formats: InstitutionFormat[]) => {
    setInstitutionFormats(formats);
    await window.electronAPI.writeJsonData('institution-formats', formats);
  };

  // 드롭다운에서 고른 서식을 편집 칸에 채운다. 직접 입력을 고르면 지금 값을 그대로 두고
  // 사용자가 이어서 고쳐 쓸 수 있게 한다.
  const handleFormatChoiceChange = (value: string) => {
    setFormatChoice(value);
    if (!value) {
      setFormatDraft(EMPTY_INSTITUTION_FORMAT_DRAFT);
      return;
    }
    if (value === FORMAT_CHOICE_CUSTOM) return;
    const preset = value.startsWith(FORMAT_CHOICE_PRESET_PREFIX)
      ? presetById(value.slice(FORMAT_CHOICE_PRESET_PREFIX.length))
      : undefined;
    if (preset) {
      setFormatDraft(draftFromPreset(preset));
      return;
    }
    const saved = institutionFormats.find(item => item.id === value);
    if (saved) {
      setFormatDraft({
        name: saved.name,
        outline: saved.outline,
        bulletStyle: saved.bulletStyle,
        fontSize: saved.fontSize,
        endingStyle: saved.endingStyle,
      });
    }
  };

  const handleSaveInstitutionFormat = async () => {
    if (!formatDraft.name.trim()) return;
    const format = normalizeInstitutionFormat({
      id: `format-${Date.now()}`,
      docType: activeTab,
      ...formatDraft,
    });
    await saveInstitutionFormats([format, ...institutionFormats.filter(item => !(item.docType === activeTab && item.name === format.name))]);
    setFormatChoice(format.id);
  };

  const handleDeleteInstitutionFormat = async () => {
    if (!savedFormatSelected) return;
    await saveInstitutionFormats(institutionFormats.filter(item => item.id !== formatChoice));
    setFormatChoice('');
    setFormatDraft(EMPTY_INSTITUTION_FORMAT_DRAFT);
  };

  const saveTemplateFavorites = (next: DocTemplateFavorite[]) => {
    safeSetItem(DOC_TEMPLATE_FAVORITES_KEY, JSON.stringify(next.slice(0, 20)));
    setTemplateFavorites(next.slice(0, 20));
  };

  const handleSaveTemplateFavorite = () => {
    const text = templateText.trim();
    if (!text) return;
    const title = window.prompt('템플릿 이름을 입력하세요.', text.split('\n')[0]?.slice(0, 30) || '문서 템플릿');
    if (!title) return;
    const now = new Date();
    saveTemplateFavorites([
      { id: `${now.getTime()}`, docType: activeTab, title, text, createdAt: now.toISOString() },
      ...templateFavorites,
    ]);
  };

  const handleLoadTemplateFavorite = (id: string) => {
    const favorite = templateFavorites.find(item => item.id === id);
    if (!favorite) return;
    setTemplateTextByTab(prev => ({ ...prev, [activeTab]: favorite.text }));
  };

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

  // 연수자료는 제목·기관명·연수 내용을 필수로 하고, 나머지는 사용자가 직접 선택한다.
  const [trainingMaterialData, setTrainingMaterialData] = useState<TrainingMaterialInputs>({
    topic: '',
    target: '',
    extraInfo: '',
    sections: { ...DEFAULT_TRAINING_MATERIAL_SECTIONS },
  });

  // Report form
  const [reportData, setReportData] = useState<ReportInputs>({
    topic: '',
    target: '',
    budget: '',
    extraInfo: '',
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
    isReply: false,
    receivedMessage: '',
    relationship: MessageRelationship.PARENT,
  });
  const [msgSubTab, setMsgSubTab] = useState<'sms' | 'social'>('sms');

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
    title: '',
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

  // Load saved user info from config on mount
  useEffect(() => {
    Promise.all([
      window.electronAPI.getConfig('institution'),
      window.electronAPI.getConfig('schoolName'),
    ]).then(([institution, schoolName]) => {
      const school = String(institution || schoolName || '');
      setSettingsProfile({
        institution: school,
      });
      setMeetingMinutesData(prev => ({ ...prev, schoolName: prev.schoolName || school }));
      setPromotionData(prev => ({ ...prev, schoolName: prev.schoolName || school }));
    });
  }, []);

  useEffect(() => {
    const handler = () => setIsGenerating(false);
    window.addEventListener('edunote-generation-reset', handler);
    return () => window.removeEventListener('edunote-generation-reset', handler);
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

  // 빈 입력 필드는 '(미입력)'으로 표기한다 — AI가 제목·주제에 맞춰 추정해 채우도록
  // 프롬프트 전역 지침(geminiService의 EMPTY_FIELD_INSTRUCTION)과 짝을 이룬다.
  const field = (label: string, value: string | undefined): string =>
    `[${label}]: ${value?.trim() ? value : '(미입력)'}`;

  const buildPromptContext = (): string => {
    switch (activeTab) {
      case DocType.GONGMUN: {
        const gongmunTypeLabel = gongmunData.type === GongmunType.INTERNAL ? '내부결재' : '외부발송';
        return `[공문 유형]: ${gongmunTypeLabel}\n${field('제목', gongmunData.title)}\n${field('본문 요청사항', gongmunData.bodyContext)}`;
      }
      case DocType.PLAN:
        return `${field('주제/사업명', planData.topic)}\n${field('대상', planData.target)}\n${field('예산', planData.budget)}\n${field('추가 사항', planData.extraInfo)}`;
      case DocType.TRAINING_MATERIAL: {
        return buildTrainingMaterialPromptContext(trainingMaterialData, settingsProfile.institution);
      }
      case DocType.REPORT:
        return `${field('주제/사업명', reportData.topic)}\n${field('대상', reportData.target)}\n${field('예산', reportData.budget)}\n${field('운영 결과 및 주요 내용', reportData.summary)}\n${field('추가 사항', reportData.extraInfo)}`;
      case DocType.NEWSLETTER:
        return `${field('제목', newsletterData.title)}\n${field('대상', newsletterData.target)}\n${field('내용', newsletterData.context)}`;
      case DocType.MESSAGE: {
        if (msgSubTab === 'social') {
          let msgCtx = `[유형]: 소통 메세지\n${field('나와의 관계', messageData.relationship)}\n${field('작성 내용', messageData.context)}`;
          if (messageData.isReply && messageData.receivedMessage.trim()) {
            msgCtx += `\n[답장 생성]: 예\n[받은 메시지]: ${messageData.receivedMessage}`;
          }
          return msgCtx;
        }
        const typeLabel = messageData.type === MessageType.SMS ? '단문(SMS)' : '장문(LMS)';
        let msgCtx = `${field('수신 대상', messageData.target)}\n[문자 유형]: ${typeLabel}\n${field('내용', messageData.context)}`;
        if (messageData.isReply && messageData.receivedMessage.trim()) {
          msgCtx += `\n[답장 생성]: 예\n[나와의 관계]: ${messageData.relationship}\n[받은 메시지]: ${messageData.receivedMessage}`;
        }
        return msgCtx;
      }
      case DocType.PUMUI: {
        let ctx = `[품의 유형]: ${pumuiData.type}\n${field('품의 제목/건명', pumuiData.title)}\n${field('관련 공문/근거', pumuiData.relatedDoc)}\n${field('소요 예산', pumuiData.budget ? `${pumuiData.budget}원` : '')}\n${field('산출 내역', pumuiData.calcDetails)}`;
        if (pumuiData.type === PumuiType.GOODS) {
          ctx += `\n${field('세부 내역(물품명, 수량, 단가)', pumuiData.details)}\n${field('구입 목적', pumuiData.purpose)}`;
        } else if (pumuiData.type === PumuiType.ALLOWANCE) {
          ctx += `\n${field('지급 대상', pumuiData.target)}\n${field('사업 일시', pumuiData.datetime)}`;
        } else if (pumuiData.type === PumuiType.BIZ_PROMOTION) {
          ctx += `\n${field('일시', pumuiData.datetime)}\n${field('장소', pumuiData.place)}\n${field('협의 안건', pumuiData.agenda)}\n${field('참석자', pumuiData.attendees)}`;
        }
        return ctx;
      }
      case DocType.MEETING_MINUTES:
        return `${field('제목', meetingMinutesData.title)}\n${field('학교명', meetingMinutesData.schoolName)}\n${field('일시', meetingMinutesData.datetime)}\n${field('장소', meetingMinutesData.place)}\n${field('출석자', meetingMinutesData.attendees)}\n${field('회의 안건', meetingMinutesData.topic)}\n${field('회의 내용', meetingMinutesData.context)}`;
      case DocType.PROMOTION:
        return `${field('제목', promotionData.title)}\n${field('학교명', promotionData.schoolName)}\n${field('행사 일시', promotionData.datetime)}\n${field('대상', promotionData.target)}\n${field('내용', promotionData.content)}\n${field('목적/의의', promotionData.purpose)}\n${field('인터뷰 대상자', promotionData.interview)}`;
      default:
        return '';
    }
  };

  const buildProfileContext = (): string => {
    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const lines = [
      `학년도: ${schoolYear}학년도`,
      `오늘 날짜: ${today}`,
      settingsProfile.institution ? `소속기관: ${settingsProfile.institution}` : '',
    ].filter(Boolean);
    return `[참고 기본정보]\n${lines.join('\n')}\n위 정보는 문서 맥락상 필요한 경우에만 반영하세요.`;
  };

  const buildContextWithProfile = (): string => {
    const profileContext = buildProfileContext();
    const promptContext = buildPromptContext();
    return [profileContext, promptContext].filter(Boolean).join('\n\n');
  };

  // ─── Get HWPX data for template filling ───────────────────────────────────

  const getHwpxTitleFromContent = (content: string, tab: DocType): string => {
    let title = '';
    if (tab === DocType.GONGMUN) title = gongmunData.title;
    else if (tab === DocType.PLAN) title = planData.topic;
    else if (tab === DocType.TRAINING_MATERIAL) title = trainingMaterialData.topic;
    else if (tab === DocType.REPORT) title = reportData.topic || reportData.summary.substring(0, 30);
    else if (tab === DocType.NEWSLETTER) title = newsletterData.title;
    else if (tab === DocType.MESSAGE) title = messageData.context.substring(0, 20);
    else if (tab === DocType.PUMUI) title = pumuiData.title;
    else if (tab === DocType.MEETING_MINUTES) title = meetingMinutesData.title;
    else if (tab === DocType.PROMOTION) title = promotionData.title || promotionData.content.substring(0, 30);
    else if (tab === DocType.GONGGO) title = gonggoData.title;
    return title || 'document';
  };

  const extractResult = (raw: string): { cleanContent: string; fillData: any[] | null } => {
    const START = '___HWPX_FILL_START___';
    const END = '___HWPX_FILL_END___';
    const si = raw.indexOf(START);
    const ei = raw.indexOf(END);
    if (si === -1 || ei === -1 || ei <= si) return { cleanContent: stripGeneratedCodeFences(raw), fillData: null };
    const jsonStr = raw.substring(si + START.length, ei).trim();
    const cleanContent = stripGeneratedCodeFences(raw.substring(0, si));
    try {
      const parsed = JSON.parse(jsonStr);
      return { cleanContent, fillData: Array.isArray(parsed) ? parsed : null };
    } catch {
      return { cleanContent, fillData: null };
    }
  };

  // ─── Handle Generate ───────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setError(null);
    setStreamPreview('');
    setIsGenerating(true);
    startGeneration(`SCHOOL_DOC_${activeTab}`);
    // 웹 검색 참조는 연수자료에서 사용자가 켠 경우에만 쓴다.
    const withWebSearch = activeTab === DocType.TRAINING_MATERIAL && useWebSearch;
    // 저장한 서식뿐 아니라 기본 제공 서식과 직접 입력한 값도 그대로 생성에 쓴다.
    const savedFormatInstruction = formatInstruction;
    try {
      let result: { text: string; model: string; grounding?: GroundingInfo };
      if (activeTab === DocType.GONGGO) {
        result = await generateDocument(
          activeTab,
          buildProfileContext(),
          undefined,
          pageCount,
          schoolYear,
          uploadedFiles,
          uploadedTemplates,
          templateText,
          GongmunComplexity.MEDIUM,
          gonggoData,
          setStreamPreview,
          withWebSearch,
          undefined,
          savedFormatInstruction,
        );
      } else {
        const context = buildContextWithProfile();
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
          setStreamPreview,
          withWebSearch,
          activeTab === DocType.TRAINING_MATERIAL ? trainingMaterialData.sections : undefined,
          savedFormatInstruction,
        );
      }
      const { cleanContent, fillData } = extractResult(result.text);
      // 계획서·보고서·연수자료·공고문은 1. → 가. → 1) → 가) 말머리 위계가 그대로 보여야
      // 하므로, AI가 단계별 들여쓰기·글자 크기를 빠뜨렸으면 같은 서식으로 보정해서 보여준다.
      const displayContent = OUTLINE_FORMATTED_DOC_TYPES.includes(activeTab)
        && uploadedTemplates.length === 0
        && !templateText.trim()
        && !savedFormatInstruction.trim()
        ? applyOutlineStyles(cleanContent)
        : cleanContent;
      setContentByTab(prev => ({ ...prev, [activeTab]: displayContent }));
      setModelByTab(prev => ({ ...prev, [activeTab]: result.model }));
      setGroundingByTab(prev => ({ ...prev, [activeTab]: result.grounding }));
      setHwpxFillDataByTab(prev => ({ ...prev, [activeTab]: fillData }));
      playSuccessSound();
    } catch (err: any) {
      const message = err.message || 'AI 문서 생성 중 오류가 발생했습니다.';
      // 검색 도구를 지원하지 않는 모델이거나 검색 한도를 넘긴 경우가 있어, 끄고 다시 시도할 수 있게 안내한다.
      setError(withWebSearch ? `${message} (웹 검색 참조를 끄고 다시 시도해 보세요.)` : message);
    } finally {
      setIsGenerating(false);
      setStreamPreview('');
      endGeneration();
    }
  };

  // ─── Tab definitions ───────────────────────────────────────────────────────

  const tabs = [
    { type: DocType.GONGMUN, icon: FileText, label: '공문서 작성' },
    { type: DocType.PLAN, icon: ClipboardList, label: '계획서 작성' },
    { type: DocType.TRAINING_MATERIAL, icon: GraduationCap, label: '연수자료 제작' },
    { type: DocType.REPORT, icon: FileOutput, label: '보고서 작성' },
    { type: DocType.PUMUI, icon: Receipt, label: '품의서 작성' },
    { type: DocType.MEETING_MINUTES, icon: Users, label: '협의록 작성' },
    { type: DocType.PROMOTION, icon: Megaphone, label: '보도자료 작성' },
    { type: DocType.NEWSLETTER, icon: Mail, label: '가정통신문 작성' },
    { type: DocType.MESSAGE, icon: Smartphone, label: '메세지' },
    { type: DocType.GONGGO, icon: MegaphoneIcon, label: '공고문 작성' },
  ];

  // ─── Style helpers ─────────────────────────────────────────────────────────

  const inputClass = 'w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-md bg-white dark:bg-[#171210] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] dark:placeholder-[#6B5E57] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-xs font-semibold text-[#78716C] dark:text-[#9C8F87] mb-1 uppercase tracking-wide';
  const sectionClass = 'mb-4';

  // ─── Render ────────────────────────────────────────────────────────────────

  const hwpxTemplateFile = uploadedTemplates.length > 0 ? uploadedTemplates[0].file : undefined;
  const previewHtml = EXAMPLE_DOCS[activeTab]?.replace(
    /<body([^>]*)>/i,
    `<body$1 style="margin:0; background:#f3f4f6; color:#000000; padding:24px;">
      <style>
        .edunote-doc-page{max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:22mm 18mm;box-sizing:border-box;box-shadow:0 8px 24px rgba(15,23,42,.16);word-break:keep-all;overflow-wrap:break-word;}
        .edunote-doc-page table{width:100%;border-collapse:collapse;margin:10pt 0 14pt;}
        .edunote-doc-page th,.edunote-doc-page td{padding:8pt 10pt;vertical-align:middle;}
        .edunote-doc-page p{margin:0 0 8pt;line-height:1.75;}
      </style>
      <div class="edunote-doc-page">`,
  )?.replace(/<\/body>/i, '</div></body>');

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210]">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left: input panel */}
        {inputPanelCollapsed && (
          <div className="w-11 shrink-0 bg-white dark:bg-[#221E1B] rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm flex justify-center py-3">
            <button
              onClick={() => setInputPanelCollapsed(false)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1] dark:hover:bg-[#2A2420] transition-colors"
              title="입력 패널 펼치기"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
        {!inputPanelCollapsed && (
        <div data-tour="school-doc-input" className="w-[420px] shrink-0 bg-white dark:bg-[#221E1B] rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="h-14 bg-[#FAF9F7] dark:bg-[#171210] border-b border-[#EDE8E1] dark:border-[#2E2822] px-4 shrink-0 flex items-center">
            <div className="flex items-center justify-between gap-2 w-full">
              <h3 className="text-sm font-bold text-[#44403C] dark:text-[#F0EBE6] flex items-center gap-2">
                <PenTool className="w-4 h-4 text-blue-500" />
                입력 정보
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => startTour('school-doc')}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-xs font-semibold text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title="이 화면 사용법을 단계별로 안내합니다"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  튜토리얼
                </button>
                <button
                  onClick={() => setInputPanelCollapsed(true)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1] dark:hover:bg-[#2A2420] transition-colors"
                  title="입력 패널 접기"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>
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
              {(activeTab === DocType.PLAN || activeTab === DocType.TRAINING_MATERIAL || activeTab === DocType.REPORT || activeTab === DocType.PROMOTION) && (
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

            <hr className="border-[#EDE8E1] dark:border-[#2E2822]" />

            {/* Dynamic form by tab */}

            {/* 공문서 */}
            {activeTab === DocType.GONGMUN && (
              <div className="space-y-4">
                <div className={sectionClass}>
                  <label className={labelClass}>공문 유형</label>
                  <div className="flex gap-2">
                    {[
                      { val: GongmunType.INTERNAL, label: '내부결재', tooltip: '기관 안에서 결재만 받는 공문.\n수신은 (내부결재)로, 본문은 "~하고자 합니다."로 끝납니다.' },
                      { val: GongmunType.EXTERNAL, label: '외부발송', tooltip: '다른 기관·학교로 보내는 공문.\n수신은 "수신자 참조"로 쓰고, 제목에 [안내]·[알림] 같은 말머리가 붙으며, 본문은 "~하여 주시기 바랍니다."로 끝납니다.' },
                    ].map(opt => (
                      <div key={opt.val} className="flex-1 relative group">
                        <button
                          onClick={() => setGongmunData({ ...gongmunData, type: opt.val })}
                          className={`w-full py-1.5 text-xs rounded-md border transition-all ${
                            gongmunData.type === opt.val
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 px-2.5 py-2 text-[11px] leading-relaxed text-white bg-[#1C1917] dark:bg-[#2E2822] rounded-lg shadow-lg hidden group-hover:block z-20 pointer-events-none whitespace-pre-line">
                          {opt.tooltip}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#1C1917] dark:border-b-[#2E2822]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={sectionClass}>
                  <label className={labelClass}>공문 복잡도</label>
                  <div className="flex gap-2">
                    {[
                      { val: GongmunComplexity.SIMPLE, label: '간단', tooltip: '관련·시행문·붙임으로 구성.\n세부 내용은 붙임으로 넘기는 짧은 공문.' },
                      { val: GongmunComplexity.MEDIUM, label: '중간', tooltip: '관련·본문·개요(가/나/다 3~5항목)·붙임으로 구성.\n일시·장소·대상 등 기본 정보가 담긴 일반 공문.' },
                      { val: GongmunComplexity.DETAILED, label: '상세', tooltip: '관련·본문·개요(5~7항목, 마지막에 행정사항)·붙임으로 구성.\n제출 기한·협조 사항까지 담는 공문이며, 세부추진계획이 있을 때만 그 부분에 표가 포함됩니다.' },
                    ].map(opt => (
                      <div key={opt.val} className="flex-1 relative group">
                        <button
                          onClick={() => setGongmunData({ ...gongmunData, complexity: opt.val })}
                          className={`w-full py-1.5 text-xs rounded-md border transition-all ${
                            gongmunData.complexity === opt.val
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 px-2.5 py-2 text-[11px] leading-relaxed text-white bg-[#1C1917] dark:bg-[#2E2822] rounded-lg shadow-lg hidden group-hover:block z-20 pointer-events-none whitespace-pre-line">
                          {opt.tooltip}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#1C1917] dark:border-b-[#2E2822]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>제목 (건명)</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 AI활용 수업 연수계획" value={gongmunData.title} onChange={e => setGongmunData({ ...gongmunData, title: e.target.value })} />
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

            {/* 연수자료 */}
            {activeTab === DocType.TRAINING_MATERIAL && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>제목</label>
                  <div className="flex items-center gap-1.5">
                    <input type="text" className={inputClass} placeholder="예: 정보통신윤리교육, 청렴교육, 개인정보보호교육" value={trainingMaterialData.topic} onChange={e => setTrainingMaterialData({ ...trainingMaterialData, topic: e.target.value })} />
                    <button
                      type="button"
                      onClick={() => window.electronAPI.openEduReferenceSearchWindow(trainingMaterialData.topic)}
                      disabled={!trainingMaterialData.topic.trim()}
                      className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E7E5E4] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#78716C]"
                      title="교육부·교육청(go.kr) 자료 검색 — 기본 브라우저에서 열립니다. 받은 자료를 아래 참고 자료로 첨부하면 그 내용이 우선 반영됩니다."
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>기관명</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="예: 해솔초등학교"
                    value={settingsProfile.institution}
                    onChange={e => setSettingsProfile({ ...settingsProfile, institution: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>연수 대상 (선택)</label>
                  <input type="text" className={inputClass} placeholder="예: 전 교직원, 신규 교사, 교육공무직원" value={trainingMaterialData.target} onChange={e => setTrainingMaterialData({ ...trainingMaterialData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>연수 내용</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="연수에서 반드시 다룰 핵심 내용과 강조점을 적어주세요. 교육부·교육청 최신 자료를 아래 '참고 자료'에 첨부하면 그 내용을 우선 반영합니다." value={trainingMaterialData.extraInfo} onChange={e => setTrainingMaterialData({ ...trainingMaterialData, extraInfo: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>추가로 포함할 항목 (선택)</label>
                  <p className="text-xs text-[#78716C] dark:text-[#9C8F87] mb-2 leading-relaxed">
                    제목·기관명·충분한 분량의 연수 내용은 항상 들어갑니다. 아래 항목은 선택한 것만 추가됩니다.
                  </p>
                  <div className="space-y-1.5">
                    {TRAINING_SECTION_OPTIONS.map(option => (
                      <label key={option.key} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={trainingMaterialData.sections[option.key]}
                          onChange={e => setTrainingMaterialData({
                            ...trainingMaterialData,
                            sections: { ...trainingMaterialData.sections, [option.key]: e.target.checked },
                          })}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                        />
                        <span className="text-xs leading-relaxed text-[#44403C] dark:text-[#C4B8B0]">
                          <span className="font-bold">{option.label}</span>
                          <span className="block text-[#78716C] dark:text-[#9C8F87]">{option.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useWebSearch}
                      onChange={e => setUseWebSearch(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <span className="text-xs leading-relaxed text-[#44403C] dark:text-[#C4B8B0]">
                      <span className="font-bold">웹 검색으로 최신 자료 참조</span>
                      <span className="block mt-1 text-[#78716C] dark:text-[#9C8F87]">
                        AI가 직접 웹을 검색해 근거를 확인하고, 참고한 자료 목록을 결과 화면에 표시합니다.
                        검색 건수만큼 API 요금이 추가로 발생하고 무료 키는 한도를 넘으면 생성이 실패할 수 있어,
                        유료 키 사용 시 권장합니다. 모델에 따라 검색이 지원되지 않을 수도 있습니다.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* 보고서 */}
            {activeTab === DocType.REPORT && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>주제 / 사업명</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 독서교육 활성화 운영 결과 보고" value={reportData.topic} onChange={e => setReportData({ ...reportData, topic: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>대상</label>
                  <input type="text" className={inputClass} placeholder="예: 전교생, 3학년, 교직원, 참여 학생 120명" value={reportData.target} onChange={e => setReportData({ ...reportData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>예산 / 집행액 (원)</label>
                  <input type="text" className={inputClass} placeholder="예: 계획액 1,500,000원 / 집행액 1,480,000원" value={reportData.budget} onChange={e => setReportData({ ...reportData, budget: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>운영 결과 및 주요 내용</label>
                  <textarea className={`${inputClass} min-h-[140px] resize-none`} placeholder="행사명, 일시, 장소, 참여 인원, 운영 내용, 주요 성과, 만족도, 개선 사항 등을 입력하세요." value={reportData.summary} onChange={e => setReportData({ ...reportData, summary: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>추가 사항 (선택)</label>
                  <textarea className={`${inputClass} min-h-[100px] resize-none`} placeholder="보고서에 포함되어야 할 특이사항, 사진 설명, 차기 계획, 정산 참고사항 등을 자유롭게 입력하세요." value={reportData.extraInfo} onChange={e => setReportData({ ...reportData, extraInfo: e.target.value })} />
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
                            : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
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

            {/* 협의록 */}
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

            {/* 보도자료 */}
            {activeTab === DocType.PROMOTION && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>제목</label>
                  <input type="text" className={inputClass} placeholder="예: ○○초, 지역과 함께하는 AI 체험 한마당 개최" value={promotionData.title} onChange={e => setPromotionData({ ...promotionData, title: e.target.value })} />
                </div>
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

            {/* 메세지 */}
            {activeTab === DocType.MESSAGE && (
              <div className="space-y-4">
                {/* 서브탭 */}
                <div className="flex rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] overflow-hidden">
                  {([
                    { key: 'sms' as const, label: '문자' },
                    { key: 'social' as const, label: '소통메세지' },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => { setMsgSubTab(tab.key); setMessageData(d => ({ ...d, isReply: false, context: '', receivedMessage: '' })); }}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                        msgSubTab === tab.key
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 문자 (SMS/LMS) */}
                {msgSubTab === 'sms' && (
                  <>
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
                                : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
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
                                : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-2 border-t border-[#EDE8E1] dark:border-[#2E2822]">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={messageData.isReply}
                          onChange={e => setMessageData({ ...messageData, isReply: e.target.checked })}
                          className="w-4 h-4 rounded border-[#E7E5E4] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0]">답장 생성</span>
                      </label>
                      <span className="text-xs text-[#A8A29E] dark:text-[#6B5E57]">받은 메시지에 대한 답장을 생성합니다.</span>
                    </div>
                    {messageData.isReply && (
                      <div className="space-y-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-3">
                        <div>
                          <label className={labelClass}>나와의 관계</label>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.values(MessageRelationship).map(r => (
                              <button
                                key={r}
                                onClick={() => setMessageData({ ...messageData, relationship: r })}
                                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                                  messageData.relationship === r
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>받은 메시지</label>
                          <textarea
                            className={`${inputClass} min-h-[80px] resize-none`}
                            placeholder="답장할 메시지를 붙여넣기 하세요."
                            value={messageData.receivedMessage}
                            onChange={e => setMessageData({ ...messageData, receivedMessage: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className={labelClass}>{messageData.isReply ? '답장 내용 / 추가 요청사항' : '전달 내용'}</label>
                      <textarea
                        className={`${inputClass} min-h-[100px] resize-none`}
                        placeholder={messageData.isReply ? '답장에 포함할 내용이나 요청사항을 입력하세요. (비워도 됩니다)' : '문자에 담을 내용을 입력하세요.'}
                        value={messageData.context}
                        onChange={e => setMessageData({ ...messageData, context: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* 소통메세지 */}
                {msgSubTab === 'social' && (
                  <>
                    <div>
                      <label className={labelClass}>나와의 관계</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[MessageRelationship.SUPERIOR, MessageRelationship.COLLEAGUE, MessageRelationship.PARENT, MessageRelationship.STUDENT, MessageRelationship.FRIEND].map(r => (
                          <button
                            key={r}
                            onClick={() => setMessageData({ ...messageData, relationship: r })}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                              messageData.relationship === r
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-2 border-t border-[#EDE8E1] dark:border-[#2E2822]">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={messageData.isReply}
                          onChange={e => setMessageData({ ...messageData, isReply: e.target.checked })}
                          className="w-4 h-4 rounded border-[#E7E5E4] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0]">답장 생성</span>
                      </label>
                      <span className="text-xs text-[#A8A29E] dark:text-[#6B5E57]">받은 메시지에 대한 답장을 생성합니다.</span>
                    </div>
                    {messageData.isReply && (
                      <div className="space-y-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-3">
                        <label className={labelClass}>받은 메시지</label>
                        <textarea
                          className={`${inputClass} min-h-[80px] resize-none`}
                          placeholder="답장할 메시지를 붙여넣기 하세요."
                          value={messageData.receivedMessage}
                          onChange={e => setMessageData({ ...messageData, receivedMessage: e.target.value })}
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelClass}>{messageData.isReply ? '답장 내용 / 추가 요청사항' : '작성 내용 / 요청사항'}</label>
                      <textarea
                        className={`${inputClass} min-h-[100px] resize-none`}
                        placeholder={messageData.isReply ? '답장에 포함할 내용이나 요청사항을 입력하세요.' : '메세지의 목적이나 내용을 입력하세요.'}
                        value={messageData.context}
                        onChange={e => setMessageData({ ...messageData, context: e.target.value })}
                      />
                    </div>
                  </>
                )}
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

            <hr className="border-[#EDE8E1] dark:border-[#2E2822]" />

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
                <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs text-blue-800 dark:text-blue-200">기관별 작성 서식</strong>
                    <span className="text-[10px] text-blue-600">우선순위: 업로드 양식 → 현재 입력 → 선택 서식 → 기본값</span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={formatChoice}
                      onChange={event => handleFormatChoiceChange(event.target.value)}
                      title="서식을 고르면 아래 칸이 채워지고, 그 값을 고쳐서 바로 쓸 수 있습니다."
                      className="flex-1 rounded-md border border-blue-200 bg-white dark:bg-[#221E1B] px-2 py-1.5 text-xs"
                    >
                      <option value="">서식 사용 안 함 (기본 형식)</option>
                      <option value={FORMAT_CHOICE_CUSTOM}>직접 입력</option>
                      {recommendedPresets.length > 0 && (
                        <optgroup label="이 문서에 맞는 기본 서식">
                          {recommendedPresets.map(preset => (
                            <option key={preset.id} value={`${FORMAT_CHOICE_PRESET_PREFIX}${preset.id}`}>{preset.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {activeInstitutionFormats.length > 0 && (
                        <optgroup label="내가 저장한 서식">
                          {activeInstitutionFormats.map(format => (
                            <option key={format.id} value={format.id}>{format.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {otherPresets.length > 0 && (
                        <optgroup label="다른 문서용 기본 서식">
                          {otherPresets.map(preset => (
                            <option key={preset.id} value={`${FORMAT_CHOICE_PRESET_PREFIX}${preset.id}`}>{preset.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button onClick={handleDeleteInstitutionFormat} disabled={!savedFormatSelected} title="내가 저장한 서식만 삭제할 수 있습니다." className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-40">삭제</button>
                  </div>
                  {formatChoice ? (
                    <>
                      <div className="space-y-2">
                        <input
                          value={formatDraft.name}
                          onChange={event => setFormatDraft(previous => ({ ...previous, name: event.target.value }))}
                          placeholder="서식 이름 (예: 우리 학교 계획서)"
                          className="w-full rounded-md border px-2 py-1.5 text-xs dark:bg-[#221E1B]"
                        />
                        <textarea
                          value={formatDraft.outline}
                          onChange={event => setFormatDraft(previous => ({ ...previous, outline: event.target.value }))}
                          placeholder="목차 (예: 1. 추진 배경 / 2. 목적 / 3. 세부 추진 계획)"
                          className="w-full min-h-[56px] resize-none rounded-md border px-2 py-1.5 text-xs dark:bg-[#221E1B]"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            list="institution-format-bullets"
                            value={formatDraft.bulletStyle}
                            onChange={event => setFormatDraft(previous => ({ ...previous, bulletStyle: event.target.value }))}
                            placeholder="글머리표 (예: 1. → 가. → 1))"
                            className="rounded-md border px-2 py-1.5 text-xs dark:bg-[#221E1B]"
                          />
                          <input
                            list="institution-format-endings"
                            value={formatDraft.endingStyle}
                            onChange={event => setFormatDraft(previous => ({ ...previous, endingStyle: event.target.value }))}
                            placeholder="문장 종결 (예: 명사형 개조식)"
                            className="rounded-md border px-2 py-1.5 text-xs dark:bg-[#221E1B]"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#78716C] dark:text-[#9C8F87]">기본 글자 크기</span>
                          <input
                            type="number"
                            min="8"
                            max="30"
                            value={formatDraft.fontSize}
                            onChange={event => setFormatDraft(previous => ({ ...previous, fontSize: Number(event.target.value) }))}
                            className="w-20 rounded-md border px-2 py-1.5 text-xs dark:bg-[#221E1B]"
                          />
                          <span className="text-[11px] text-[#78716C] dark:text-[#9C8F87]">pt</span>
                        </div>
                        <datalist id="institution-format-bullets">
                          {BULLET_STYLE_OPTIONS.map(option => <option key={option} value={option} />)}
                        </datalist>
                        <datalist id="institution-format-endings">
                          {ENDING_STYLE_OPTIONS.map(option => <option key={option} value={option} />)}
                        </datalist>
                      </div>
                      <div className="rounded-md bg-white dark:bg-[#221E1B] border border-blue-100 dark:border-blue-900 p-2" style={{ fontSize: `${formatDraft.fontSize}px` }}>
                        <strong>{formatDraft.outline || '1. 문서 제목'}</strong>
                        <p className="mt-1">{(formatDraft.bulletStyle || '가.').split('→')[0].trim()} 서식 미리보기 문장 {formatDraft.endingStyle || '~함'}</p>
                      </div>
                      {!formatInstruction && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-300">목차·글머리표·문장 종결 중 하나는 채워야 서식이 생성에 반영됩니다.</p>
                      )}
                      <button onClick={handleSaveInstitutionFormat} disabled={!formatDraft.name.trim()} className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">이 서식을 내 서식으로 저장</button>
                      <p className="text-[10px] text-[#78716C]">저장하지 않아도 지금 화면의 값이 이번 생성에 그대로 쓰입니다. 저장하면 다음에도 목록에서 바로 고를 수 있고, 서식 규칙만 저장하며 문서 본문·학생 정보·인명은 저장하지 않습니다.</p>
                    </>
                  ) : (
                    <p className="text-[10px] text-[#78716C]">기본 서식을 고르면 목차·글머리표·글자 크기·문장 종결이 채워집니다. 값을 고쳐 쓰거나 `직접 입력`으로 처음부터 작성할 수 있습니다.</p>
                  )}
                </div>
                <div className="hidden">
                  <button
                    type="button"
                    onClick={handleSaveTemplateFavorite}
                    disabled={!templateText.trim()}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:text-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900"
                  >
                    현재 양식 즐겨찾기 저장
                  </button>
                  {activeTemplateFavorites.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={e => {
                        handleLoadTemplateFavorite(e.target.value);
                        e.currentTarget.value = '';
                      }}
                      className="w-full rounded-md border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] px-2 py-1.5 text-xs text-[#44403C] dark:text-[#C4B8B0]"
                    >
                      <option value="">저장한 양식 불러오기</option>
                      {activeTemplateFavorites.map(item => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-200">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="px-4 py-3 border-t border-[#EDE8E1] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210] shrink-0">
            <button
              data-tour="school-doc-generate"
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                isGenerating
                  ? 'bg-[#E7E5E4] dark:bg-[#2E2822] text-[#78716C] dark:text-[#9C8F87] cursor-not-allowed'
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
                   activeTab === DocType.TRAINING_MATERIAL ? '연수자료 생성' :
                   activeTab === DocType.REPORT ? '보고서 생성' :
                   activeTab === DocType.PUMUI ? '품의서 생성' :
                   activeTab === DocType.MEETING_MINUTES ? '협의록 생성' :
                   activeTab === DocType.PROMOTION ? '보도자료 생성' :
                   activeTab === DocType.NEWSLETTER ? '가정통신문 생성' :
                   activeTab === DocType.MESSAGE ? '메세지 생성' :
                   activeTab === DocType.GONGGO ? '공고문 생성' :
                   '문서 생성'}
                </>
              )}
            </button>
          </div>
        </div>
        )}

        {/* Right: output panel */}
        <div data-tour="school-doc-output" className="flex-1 flex flex-col overflow-hidden">
          {generatedContent ? (
            <GeneratedDisplay
              content={generatedContent}
              hwpxFillData={hwpxFillData}
              hwpxTemplate={hwpxTemplateFile}
              title={getHwpxTitleFromContent(generatedContent, activeTab)}
              enableTranslation={activeTab === DocType.NEWSLETTER || activeTab === DocType.MESSAGE}
              model={generatedModel}
              grounding={generatedGrounding}
              reviewKind="document"
            />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#221E1B] rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm">
              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <svg className="animate-spin w-8 h-8 text-blue-500 mb-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-1">문서를 생성하는 중...</p>
                  <p className="text-sm text-[#A8A29E] dark:text-[#6B5E57]">{loadingMessage}</p>
                  {streamPreview && (
                    <div className="mt-4 w-full max-w-lg max-h-44 overflow-hidden rounded-md border border-[#E7E5E4] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210] p-3 text-left">
                      <p className="text-[10px] font-bold text-[#A8A29E] dark:text-[#6B5E57] mb-1 uppercase tracking-wide">생성 중 미리보기</p>
                      <pre className="text-[11px] leading-relaxed text-[#78716C] dark:text-[#9C8F87] whitespace-pre-wrap break-all font-sans">{streamPreview.slice(-600)}</pre>
                    </div>
                  )}
                </div>
              ) : EXAMPLE_DOCS[activeTab] ? (
                <>
                  <div className="shrink-0 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 px-4 py-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-200 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full uppercase tracking-wide">예시 문서</span>
                    <span className="text-xs text-blue-500 dark:text-blue-300">정보를 입력하고 생성하면 아래와 유사한 형식으로 만들어집니다.</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      srcDoc={previewHtml}
                      sandbox=""
                      className="w-full h-full border-0 bg-white"
                      title="예시 문서"
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-full mb-4">
                    <FileText className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-2">문서를 생성해 주세요</h3>
                  <p className="text-sm text-[#A8A29E] dark:text-[#6B5E57] max-w-xs break-keep">
                    왼쪽 패널에서 필요한 정보를 입력한 후 생성 버튼을 눌러주세요.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchoolDocPanel;
