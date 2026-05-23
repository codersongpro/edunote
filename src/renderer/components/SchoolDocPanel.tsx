import React, { useState, useRef, useEffect } from 'react';
import { FileText, PenTool, ClipboardList, Wand2, AlertCircle, Layers, FileOutput, ArrowRight, Layout, MessageSquare, Calendar, AlignLeft, AlignJustify, List, CheckCircle, AlertTriangle, Receipt, Users, Megaphone, Mail, Smartphone, Monitor, Megaphone as MegaphoneIcon } from 'lucide-react';
import { DocType, GongmunInputs, PlanInputs, ReportInputs, MessageInputs, NewsletterInputs, PumuiInputs, MeetingMinutesInputs, PromotionInputs, GonggoInputs, FileData, GongmunType, MessageTarget, MessageType, MessageRelationship, GongmunComplexity, PumuiType, AppMode } from '../types';
import { generateDocument } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { GeneratedDisplay } from './GeneratedDisplay';
import { LOADING_MESSAGES } from '../constants';
import { useGenerationTracker } from '../hooks/useGenerationTracker';

// ─── Example Documents ───────────────────────────────────────────────────────

const EXAMPLE_DOCS: Partial<Record<DocType, string>> = {
  [DocType.GONGMUN]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12pt;margin:40px;color:#111;line-height:1.8}h1{font-size:14pt;text-align:center;font-weight:bold;margin:20px 0 30px}table{width:100%;border-collapse:collapse;margin-bottom:18px}td{padding:6px 10px;border:1px solid #444;vertical-align:top}td.label{background:#f5f5f5;font-weight:bold;width:100px;text-align:center}.content{padding:20px 0}.sig{text-align:right;margin-top:40px;font-size:11pt}</style></head><body><p style="text-align:right;font-size:11pt">수신: 교육지원청 교육장<br>참조: 초등교육과장<br>제목: 2026학년도 학부모 공개수업 운영 계획 제출</p><table><tr><td class="label">수신</td><td>교육지원청 교육장(경유)</td></tr><tr><td class="label">제목</td><td>2026학년도 학부모 공개수업 운영 계획 제출</td></tr></table><div class="content"><p>1. 관련: 초등교육과-2026-0312(2026.03.01.)</p><p>2. 위 관련에 의거 2026학년도 학부모 공개수업 운영 계획을 붙임과 같이 제출합니다.</p><p>붙 임: 학부모 공개수업 운영 계획서 1부. 끝.</p></div><div class="sig">○○초등학교장<br>(직인)</div></body></html>`,

  [DocType.PLAN]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12pt;margin:40px;color:#111;line-height:1.8}h1{font-size:15pt;text-align:center;font-weight:bold;margin:10px 0 6px}h2{font-size:13pt;margin:18px 0 8px;border-bottom:2px solid #333;padding-bottom:3px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#e8e8e8;border:1px solid #555;padding:6px 10px;font-weight:bold;text-align:center}td{border:1px solid #555;padding:6px 10px;vertical-align:top}ul{margin:4px 0;padding-left:20px}</style></head><body><h1>2026학년도 독서 교육 활성화 계획</h1><p style="text-align:center">○○초등학교</p><h2>1. 목적</h2><p>독서 교육을 통해 학생의 언어 능력과 창의적 사고력을 신장하고, 올바른 독서 습관 형성을 지원한다.</p><h2>2. 방침</h2><ul><li>학교 도서관 활용 수업과 연계하여 독서 교육 활성화</li><li>학년별 권장 도서 목록을 제공하고 독서 기록 생활화</li><li>가정과 연계한 독서 환경 조성 지원</li></ul><h2>3. 세부 추진 계획</h2><table><tr><th>구분</th><th>내용</th><th>시기</th><th>담당</th></tr><tr><td>도서관 활용 수업</td><td>학급별 월 2회 이상 운영</td><td>3~12월</td><td>담임교사</td></tr><tr><td>독서 골든벨</td><td>학년별 독서 퀴즈 대회</td><td>6월, 11월</td><td>사서교사</td></tr><tr><td>독서 주간 운영</td><td>주제별 독서 행사 및 전시</td><td>4월, 9월</td><td>교육과정부</td></tr></table><h2>4. 기대 효과</h2><p>학생의 자기 주도적 독서 습관 형성 및 언어 능력 향상</p></body></html>`,

  [DocType.REPORT]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12pt;margin:40px;color:#111;line-height:1.8}h1{font-size:15pt;text-align:center;font-weight:bold;margin:10px 0 6px}h2{font-size:13pt;margin:18px 0 8px;border-bottom:2px solid #333;padding-bottom:3px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#e8e8e8;border:1px solid #555;padding:6px 10px;font-weight:bold;text-align:center}td{border:1px solid #555;padding:6px 10px;vertical-align:top}ul{margin:4px 0;padding-left:20px}</style></head><body><h1>2026학년도 1학기 현장체험학습 결과 보고</h1><p style="text-align:center">○○초등학교 5학년 담임교사 홍길동</p><h2>1. 행사 개요</h2><table><tr><th width="120">항목</th><th>내용</th></tr><tr><td>일시</td><td>2026년 5월 14일(목) 08:30~17:00</td></tr><tr><td>장소</td><td>국립과천과학관 및 서울대공원</td></tr><tr><td>참가 인원</td><td>5학년 전체 120명(교직원 8명 포함)</td></tr><tr><td>목적</td><td>과학·환경 체험을 통한 탐구력 신장</td></tr></table><h2>2. 주요 활동 내용</h2><ul><li>국립과천과학관 상설전시관 관람 및 체험 활동</li><li>환경 생태원 탐방 및 생태 그림 그리기</li><li>모둠별 탐구 활동지 작성 및 발표</li></ul><h2>3. 성과 및 평가</h2><p>학생들의 과학에 대한 흥미와 호기심이 크게 증가하였으며, 모둠 협력 활동을 통해 의사소통 능력이 향상되었음. 일부 안전 사고 없이 원활히 마무리됨.</p><h2>4. 건의 사항</h2><p>이동 시 버스 대수 증편 필요(학생 이동 시간 단축)</p></body></html>`,

  [DocType.PUMUI]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12pt;margin:40px;color:#111;line-height:1.8}h1{font-size:15pt;text-align:center;font-weight:bold;margin:10px 0 20px}table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#e8e8e8;border:1px solid #555;padding:7px 10px;font-weight:bold;text-align:center}td{border:1px solid #555;padding:7px 10px;vertical-align:top}td.label{background:#f5f5f5;font-weight:bold;text-align:center;width:120px}.sig{text-align:right;margin-top:30px;line-height:2}</style></head><body><h1>물품 구입 품의서</h1><table><tr><td class="label">품 의 제 목</td><td>2026학년도 1학기 수업 준비물 구입 품의</td></tr><tr><td class="label">관련 근거</td><td>2026학년도 학교 교육비 예산 편성 계획</td></tr><tr><td class="label">소요 예산</td><td>₩ 320,000원 (교육활동비)</td></tr></table><table><tr><th>No.</th><th>품명</th><th>규격</th><th>수량</th><th>단가</th><th>금액</th></tr><tr><td style="text-align:center">1</td><td>색연필 세트</td><td>12색</td><td>30세트</td><td>5,000</td><td>150,000</td></tr><tr><td style="text-align:center">2</td><td>포스터보드</td><td>B4</td><td>100장</td><td>500</td><td>50,000</td></tr><tr><td style="text-align:center">3</td><td>수채화 물감</td><td>12색</td><td>20세트</td><td>6,000</td><td>120,000</td></tr><tr><td style="text-align:center" colspan="5"><b>합 계</b></td><td><b>320,000</b></td></tr></table><p>위와 같이 물품 구입을 품의하오니 허가하여 주시기 바랍니다.</p><div class="sig">2026년 3월 15일<br>담임교사 홍 길 동 (인)<br>교감 이 영 희 (인)<br>교장 김 철 수 (인)</div></body></html>`,

  [DocType.MEETING_MINUTES]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12pt;margin:40px;color:#111;line-height:1.8}h1{font-size:15pt;text-align:center;font-weight:bold;margin:10px 0 20px}table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#e8e8e8;border:1px solid #555;padding:7px 10px;font-weight:bold;text-align:center}td{border:1px solid #555;padding:7px 10px;vertical-align:top}td.label{background:#f5f5f5;font-weight:bold;text-align:center;width:100px}h2{font-size:13pt;margin:16px 0 6px;font-weight:bold}ul{margin:4px 0;padding-left:20px}</style></head><body><h1>2026학년도 1학기 제1차 교직원 협의회 회의록</h1><table><tr><td class="label">일시</td><td>2026년 3월 5일(목) 15:30~17:00</td><td class="label">장소</td><td>○○초등학교 회의실</td></tr><tr><td class="label">참석자</td><td colspan="3">교장, 교감, 교육과정부장, 담임교사 20명, 전담교사 4명 (총 26명)</td></tr></table><h2>1. 심의·의결 사항</h2><ul><li>[안건 1] 2026학년도 학교 교육계획 심의 → 원안 가결</li><li>[안건 2] 학급 배정 및 담임 배정 → 원안 가결</li></ul><h2>2. 토의 사항</h2><ul><li>2026 개정 교육과정 적용 방안 논의: 학년별 교육과정 재구성 TF팀 구성하기로 함</li><li>학부모 공개수업 일정: 4월 중 실시 예정, 세부 일정 추후 공지</li></ul><h2>3. 전달 사항</h2><ul><li>3월 학교 안전교육 주간 운영 안내(3.10.~3.14.)</li><li>학생 건강검진 일정 안내</li></ul><p style="text-align:right;margin-top:20px">기록: 교육과정부장 박민준</p></body></html>`,

  [DocType.PROMOTION]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;margin:0;padding:0;background:#fff}*{box-sizing:border-box}.wrap{max-width:600px;margin:0 auto;padding:30px}.header{background:linear-gradient(135deg,#1a73e8,#0d47a1);color:#fff;padding:32px 28px;border-radius:12px;text-align:center;margin-bottom:24px}.header h1{font-size:22pt;font-weight:900;margin:0 0 8px}.header p{font-size:11pt;margin:0;opacity:.9}.section{background:#f8f9fa;border-radius:10px;padding:20px 24px;margin-bottom:16px;border-left:4px solid #1a73e8}.section h2{font-size:13pt;font-weight:bold;color:#1a73e8;margin:0 0 10px}.section ul{margin:0;padding-left:18px;line-height:1.9;font-size:11pt}.highlight{background:#e3f2fd;border-radius:8px;padding:14px 20px;text-align:center;font-size:12pt;font-weight:bold;color:#0d47a1;margin-bottom:16px}.footer{text-align:center;font-size:10pt;color:#888;margin-top:20px}</style></head><body><div class="wrap"><div class="header"><h1>○○초등학교 방과후학교 프로그램 안내</h1><p>2026학년도 1학기 수강생 모집</p></div><div class="highlight">접수 기간: 2026. 3. 4.(화) ~ 3. 7.(금) / 선착순 모집</div><div class="section"><h2>📚 개설 프로그램</h2><ul><li>영어 회화반 — 월·수 15:00~16:00</li><li>수학 사고력반 — 화·목 15:00~16:00</li><li>창의 미술반 — 금 14:00~16:00</li><li>소프트웨어 코딩반 — 수·금 15:00~16:00</li></ul></div><div class="section"><h2>📌 신청 방법</h2><ul><li>학교 홈페이지 → 방과후학교 → 수강 신청</li><li>문의: 방과후 담당교사 ☎ 02-XXX-XXXX</li></ul></div><div class="footer">○○초등학교 | 서울시 ○○구 ○○로 123</div></div></body></html>`,

  [DocType.NEWSLETTER]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;margin:0;padding:0}*{box-sizing:border-box}.wrap{max-width:580px;margin:0 auto;padding:24px}.header{background:#1565c0;color:#fff;padding:22px 24px;border-radius:10px;margin-bottom:18px;text-align:center}.header .school{font-size:10pt;opacity:.85;margin-bottom:4px}.header h1{font-size:16pt;font-weight:900;margin:0 0 4px}.header .date{font-size:9pt;opacity:.8}.section{background:#f5f7ff;border:1px solid #dde3f5;border-radius:8px;padding:16px 20px;margin-bottom:14px}.section h2{font-size:12pt;font-weight:bold;color:#1565c0;margin:0 0 10px;display:flex;align-items:center;gap:6px}.section p,.section ul{font-size:10.5pt;line-height:1.85;margin:0;padding-left:0}.section ul{padding-left:18px}.footer{text-align:center;font-size:9pt;color:#999;margin-top:16px;border-top:1px solid #ddd;padding-top:12px}</style></head><body><div class="wrap"><div class="header"><div class="school">○○초등학교 3학년 3반</div><h1>3월 학급 가정통신문</h1><div class="date">2026년 3월 1일</div></div><div class="section"><h2>🌸 새 학년을 시작하며</h2><p>안녕하세요, 학부모님. 2026학년도 3학년 3반 담임교사 홍길동입니다. 우리 반 학생들이 건강하고 즐겁게 학교생활을 할 수 있도록 최선을 다하겠습니다.</p></div><div class="section"><h2>📅 3월 주요 일정</h2><ul><li>3. 2.(월): 입학식·시업식</li><li>3. 5.(목): 학급 임원 선출</li><li>3. 10.~14.: 학교 안전교육 주간</li><li>3. 20.(금): 학부모 상담 주간 시작</li></ul></div><div class="section"><h2>📌 가정에서 지도해 주세요</h2><ul><li>학용품에 이름을 꼭 적어주세요.</li><li>등교 시간: 오전 8:30~8:50</li><li>알림장을 매일 확인해 주시기 바랍니다.</li></ul></div><div class="footer">○○초등학교 ☎ 02-XXX-XXXX | 담임 홍길동</div></div></body></html>`,

  [DocType.MESSAGE]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;margin:30px;color:#111;line-height:1.9;font-size:12pt}.bubble{background:#f0f0f0;border-radius:14px;padding:18px 22px;max-width:400px;margin:10px auto;position:relative}.bubble::before{content:'문자 메시지 예시';display:block;font-size:9pt;color:#888;margin-bottom:8px}.title{font-weight:bold;color:#1a237e;margin-bottom:8px}ul{margin:8px 0;padding-left:18px}p{margin:6px 0}.note{font-size:9pt;color:#666;text-align:center;margin-top:20px}</style></head><body><div class="bubble"><div class="title">[○○초등학교] 안내 말씀</div><p>안녕하세요, 학부모님. 3학년 3반 담임 홍길동입니다.</p><p>내일(3/20) 학부모 참관 수업이 진행됩니다.</p><ul><li>일시: 3. 20.(목) 10:00~11:00</li><li>장소: 3학년 3반 교실</li></ul><p>바쁘시더라도 참석해 주시면 감사하겠습니다.</p><p>문의: 02-XXX-XXXX</p></div><div class="note">SMS/LMS 형식 예시 — 실제 발송 시 문자 앱을 이용하세요.</div></body></html>`,

  [DocType.GONGGO]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:12pt;margin:40px;color:#111;line-height:1.8}h1{font-size:16pt;text-align:center;font-weight:bold;margin:10px 0 4px}h2{font-size:13pt;text-align:center;font-weight:normal;margin:0 0 4px;color:#333}.num{text-align:center;color:#555;font-size:10pt;margin-bottom:24px}hr{border:none;border-top:2px solid #222;margin:16px 0}h3{font-size:13pt;margin:14px 0 6px}ul{margin:4px 0;padding-left:20px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#e8e8e8;border:1px solid #555;padding:6px 10px;font-weight:bold;text-align:center}td{border:1px solid #555;padding:6px 10px;vertical-align:top;text-align:center}.sig{text-align:center;margin-top:40px;font-size:12pt;font-weight:bold;line-height:2.2}</style></head><body><h1>공 고</h1><h2>2026학년도 학생회 임원 선거 공고</h2><div class="num">제2026-001호</div><hr><h3>1. 선거 일정</h3><table><tr><th>구분</th><th>일시</th><th>장소</th></tr><tr><td>후보자 등록</td><td>2026. 3. 10.(화) ~ 3. 11.(수)</td><td>교무실</td></tr><tr><td>선거 운동</td><td>2026. 3. 13.(금) ~ 3. 17.(화)</td><td>학교 내</td></tr><tr><td>투표</td><td>2026. 3. 19.(목) 10:00~12:00</td><td>강당</td></tr><tr><td>개표 및 당선 발표</td><td>2026. 3. 19.(목) 13:00</td><td>방송</td></tr></table><h3>2. 모집 임원</h3><ul><li>회장: 1명(5~6학년 중 1명)</li><li>부회장: 2명(학년별 1명)</li></ul><h3>3. 지원 자격</h3><ul><li>품행이 단정하고 학교생활에 모범이 되는 학생</li><li>결석·징계 이력이 없는 학생</li></ul><div class="sig">2026년 3월 1일<br>○○초등학교장</div></body></html>`,
};

// ─── SchoolDocPanel ──────────────────────────────────────────────────────────

interface SchoolDocPanelProps {
  initialTab?: DocType;
}

export const SchoolDocPanel: React.FC<SchoolDocPanelProps> = ({ initialTab }) => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.SCHOOL_DOC);
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
    isReply: false,
    receivedMessage: '',
    relationship: MessageRelationship.PARENT,
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
        let msgCtx = `[수신 대상]: ${messageData.target}\n[문자 유형]: ${typeLabel}\n[내용]: ${messageData.context}`;
        if (messageData.isReply && messageData.receivedMessage.trim()) {
          msgCtx += `\n[답장 생성]: 예\n[나와의 관계]: ${messageData.relationship}\n[받은 메시지]: ${messageData.receivedMessage}`;
        }
        return msgCtx;
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

  const extractResult = (raw: string): { cleanContent: string; fillData: any[] | null } => {
    const START = '___HWPX_FILL_START___';
    const END = '___HWPX_FILL_END___';
    const si = raw.indexOf(START);
    const ei = raw.indexOf(END);
    if (si === -1 || ei === -1 || ei <= si) return { cleanContent: raw.trim(), fillData: null };
    const jsonStr = raw.substring(si + START.length, ei).trim();
    const cleanContent = raw.substring(0, si).trim();
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
    setIsGenerating(true);
    startGeneration(`SCHOOL_DOC_${activeTab}`);
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
      const { cleanContent, fillData } = extractResult(result);
      setContentByTab(prev => ({ ...prev, [activeTab]: cleanContent }));
      setHwpxFillDataByTab(prev => ({ ...prev, [activeTab]: fillData }));
    } catch (err: any) {
      setError(err.message || 'AI 문서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      endGeneration();
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

                {/* Reply toggle */}
                <div className="flex items-center gap-2 py-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={messageData.isReply}
                      onChange={e => setMessageData({ ...messageData, isReply: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">답장 생성</span>
                  </label>
                  <span className="text-xs text-gray-400">받은 메시지에 대한 답장을 생성합니다.</span>
                </div>

                {messageData.isReply && (
                  <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
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
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
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
                  <textarea className={`${inputClass} min-h-[100px] resize-none`} placeholder={messageData.isReply ? '답장에 포함할 내용이나 요청사항을 입력하세요. (비워도 됩니다)' : '문자에 담을 내용을 입력하세요.'} value={messageData.context} onChange={e => setMessageData({ ...messageData, context: e.target.value })} />
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
            <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-lg border border-gray-300 shadow-sm">
              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <svg className="animate-spin w-8 h-8 text-blue-500 mb-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-600 mb-1">문서를 생성하는 중...</p>
                  <p className="text-sm text-gray-400">{loadingMessage}</p>
                </div>
              ) : EXAMPLE_DOCS[activeTab] ? (
                <>
                  <div className="shrink-0 bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wide">예시 문서</span>
                    <span className="text-xs text-blue-500">정보를 입력하고 생성하면 아래와 유사한 형식으로 만들어집니다.</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      srcDoc={EXAMPLE_DOCS[activeTab]}
                      sandbox=""
                      className="w-full h-full border-0"
                      title="예시 문서"
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="bg-blue-50 p-4 rounded-full mb-4">
                    <FileText className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-600 mb-2">문서를 생성해 주세요</h3>
                  <p className="text-sm text-gray-400 max-w-xs">
                    왼쪽 패널에서 필요한 정보를 입력한 후<br />생성 버튼을 눌러주세요.
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
