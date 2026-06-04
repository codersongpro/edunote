export interface PrintFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'select' | 'participants' | 'table';
  placeholder?: string;
  options?: string[];
  rows?: number;
  // type === 'table' 전용: 한 줄에 한 행, '/'로 칸을 나눠 입력하면 columns 머리글의 표로 만든다.
  columns?: string[];
  minRows?: number;
}

export interface PrintForm {
  id: string;
  category: string;
  title: string;
  fields: PrintFormField[];
  htmlTemplate: string;
}

const baseStyle = `
<style>
  @page { size: A4 portrait; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 100%; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
    font-size: 11pt;
    line-height: 1.7;
    color: #000;
    min-height: 297mm;
    padding: 14mm 16mm;
    display: flex;
    flex-direction: column;
  }
  .page-wrap { flex: 1; height: 269mm; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  h2 { font-size: 11.5pt; font-weight: bold; margin: 10pt 0 4pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
  th, td { border: 1px solid #555; padding: 5pt 7pt; vertical-align: middle; }
  th { background: #f0f0f0; font-weight: bold; text-align: center; white-space: nowrap; }
  td.lbl { font-weight: bold; background: #f7f7f7; white-space: nowrap; text-align: center; width: 18%; }
  .flex-area { flex: 1; border: 1px solid #555; padding: 8pt; margin-bottom: 6pt; }
  .grow-area { border: 1px solid #555; padding: 8pt; margin-bottom: 6pt; }
  .lined { background-image: repeating-linear-gradient(transparent, transparent 27px, #ccc 27px, #ccc 28px); line-height: 28px; }
  .title-box { border: 2px solid #222; padding: 6pt 12pt; text-align: center; font-size: 16pt; font-weight: bold; letter-spacing: 3px; margin-bottom: 12pt; }
  .sig-row { display: flex; justify-content: flex-end; gap: 24pt; margin-top: 12pt; }
  .sig-box { text-align: center; width: 60pt; }
  .sig-line { border-bottom: 1px solid #555; height: 30pt; margin-bottom: 4pt; }
  .small { font-size: 9pt; color: #555; }
  td { white-space: pre-wrap; word-break: break-all; }
  td.nowrap { white-space: nowrap; }
  @media print {
    body { min-height: auto; padding: 0; }
    .page-wrap { height: 269mm; page-break-inside: avoid; }
  }
</style>
`;

export const PRINT_FORMS: PrintForm[] = [
  // ── 글쓰기 ──────────────────────────────────────────────────────────
  {
    id: 'diary',
    category: '글쓰기',
    title: '일기',
    fields: [
      { key: '날짜', label: '날짜', type: 'text', placeholder: '예: 2026년 6월 3일' },
      { key: '학년반', label: '학년/반', type: 'text', placeholder: '3학년 2반' },
      { key: '이름', label: '이름', type: 'text', placeholder: '홍길동' },
      { key: '날씨', label: '날씨', type: 'text', placeholder: '' },
      { key: '제목', label: '제목', type: 'text', placeholder: '일기 제목' },
      { key: '내용', label: '내용', type: 'textarea', rows: 12 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="page-wrap">
<div class="title-box">일 기</div>
<table>
  <tr>
    <th style="width:15%;">날짜</th><td class="nowrap" style="width:25%;">{{날짜}}</td>
    <th style="width:15%;">날씨</th><td class="nowrap" style="width:20%;">{{날씨}}</td>
    <th style="width:10%;">이름</th><td class="nowrap" style="width:15%;">{{이름}}</td>
  </tr>
  <tr>
    <th>학년/반</th><td colspan="5">{{학년반}}</td>
  </tr>
  <tr>
    <th>제목</th><td colspan="5" style="font-weight:bold;">{{제목}}</td>
  </tr>
</table>
<div class="flex-area lined" style="flex:1;">{{내용}}</div>
</div></body></html>`,
  },
  {
    id: 'book-report',
    category: '글쓰기',
    title: '독서감상문',
    fields: [
      { key: '날짜', label: '작성일', type: 'text', placeholder: '2026년 6월 3일' },
      { key: '학년반', label: '학년/반', type: 'text', placeholder: '3학년 2반' },
      { key: '이름', label: '이름', type: 'text', placeholder: '홍길동' },
      { key: '책제목', label: '책 제목', type: 'text' },
      { key: '저자', label: '저자', type: 'text' },
      { key: '줄거리', label: '줄거리', type: 'textarea', rows: 4 },
      { key: '인상깊은내용', label: '인상 깊은 내용', type: 'textarea', rows: 3 },
      { key: '느낀점', label: '나의 생각·느낀 점', type: 'textarea', rows: 5 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="page-wrap">
<div class="title-box">독서감상문</div>
<table>
  <tr>
    <th style="width:14%;">작성일</th><td class="nowrap" style="width:26%;">{{날짜}}</td>
    <th style="width:14%;">학년/반</th><td class="nowrap" style="width:20%;">{{학년반}}</td>
    <th style="width:10%;">이름</th><td class="nowrap" style="width:16%;">{{이름}}</td>
  </tr>
  <tr>
    <th>책 제목</th><td colspan="2">{{책제목}}</td>
    <th>저자</th><td colspan="2">{{저자}}</td>
  </tr>
</table>
<h2>줄거리</h2>
<div class="grow-area" style="min-height:70pt;">{{줄거리}}</div>
<h2>인상 깊은 내용</h2>
<div class="grow-area" style="min-height:60pt;">{{인상깊은내용}}</div>
<h2>나의 생각 · 느낀 점</h2>
<div class="flex-area lined" style="flex:1;">{{느낀점}}</div>
</div></body></html>`,
  },
  {
    id: 'letter',
    category: '글쓰기',
    title: '편지',
    fields: [
      { key: '날짜', label: '작성일', type: 'text', placeholder: '2026년 6월 3일' },
      { key: '학년반', label: '학년/반', type: 'text', placeholder: '3학년 2반' },
      { key: '이름', label: '쓴 사람', type: 'text', placeholder: '홍길동' },
      { key: '받는사람', label: '받는 사람', type: 'text', placeholder: '받는 분 이름' },
      { key: '첫인사', label: '첫인사', type: 'textarea', rows: 3 },
      { key: '본문', label: '본문', type: 'textarea', rows: 10 },
      { key: '끝인사', label: '끝인사', type: 'textarea', rows: 2 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="page-wrap">
<div class="title-box">편 지</div>
<table style="margin-bottom:10pt;">
  <tr>
    <th style="width:14%;">작성일</th><td class="nowrap" style="width:26%;">{{날짜}}</td>
    <th style="width:14%;">학년/반</th><td class="nowrap" style="width:20%;">{{학년반}}</td>
    <th style="width:14%;">쓴 사람</th><td class="nowrap" style="width:12%;">{{이름}}</td>
  </tr>
</table>
<p style="font-size:12pt; margin:0 0 6pt;"><strong>{{받는사람}}</strong>께</p>
<div class="grow-area lined" style="min-height:50pt;">{{첫인사}}</div>
<div class="flex-area lined" style="flex:1;">{{본문}}</div>
<div class="grow-area lined" style="min-height:40pt;">{{끝인사}}</div>
<p style="text-align:right; margin:8pt 0 0;">{{날짜}}&nbsp;&nbsp;&nbsp;{{이름}} 올림</p>
</div></body></html>`,
  },
  // ── 학급 활동 ──────────────────────────────────────────────────────
  {
    id: 'reading-log',
    category: '학급 활동',
    title: '독서 기록장',
    fields: [
      { key: '학기', label: '학기', type: 'text', placeholder: '2026학년도 1학기' },
      { key: '학년반번호', label: '학년·반·번호', type: 'text', placeholder: '3학년 2반 15번' },
      { key: '이름', label: '이름', type: 'text', placeholder: '홍길동' },
      { key: '날짜', label: '독서 날짜', type: 'text', placeholder: '2026년 6월 3일' },
      { key: '책제목', label: '책 제목', type: 'text' },
      { key: '저자', label: '저자', type: 'text' },
      { key: '쪽수', label: '읽은 쪽', type: 'text', placeholder: 'p.1 ~ p.50' },
      { key: '내용', label: '인상 깊은 내용·느낀 점', type: 'textarea', rows: 10 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="page-wrap">
<div class="title-box">독서 기록장</div>
<table>
  <tr>
    <th style="width:14%;">학기</th><td colspan="5">{{학기}}</td>
  </tr>
  <tr>
    <th>학년·반·번호</th><td class="nowrap" colspan="2">{{학년반번호}}</td>
    <th style="width:10%;">이름</th><td class="nowrap" colspan="2">{{이름}}</td>
  </tr>
  <tr>
    <th>독서 날짜</th><td class="nowrap" colspan="2">{{날짜}}</td>
    <th>읽은 쪽</th><td class="nowrap" colspan="2">{{쪽수}}</td>
  </tr>
  <tr>
    <th>책 제목</th><td colspan="3">{{책제목}}</td>
    <th>저자</th><td>{{저자}}</td>
  </tr>
</table>
<h2>인상 깊은 내용 · 느낀 점</h2>
<div class="flex-area lined" style="flex:1;">{{내용}}</div>
</div></body></html>`,
  },
  {
    id: 'self-evaluation',
    category: '학급 활동',
    title: '수업 자기평가지',
    fields: [
      { key: '과목', label: '과목', type: 'text', placeholder: '국어' },
      { key: '단원', label: '단원·주제', type: 'text', placeholder: '1단원 - 이야기의 흐름' },
      { key: '날짜', label: '날짜', type: 'text', placeholder: '2026년 6월 3일' },
      { key: '학년반', label: '학년/반', type: 'text' },
      { key: '이름', label: '이름', type: 'text' },
      { key: '학습목표1', label: '학습 목표 1', type: 'text', placeholder: '이야기의 흐름을 파악할 수 있다.' },
      { key: '학습목표2', label: '학습 목표 2', type: 'text', placeholder: '인물의 마음을 이해할 수 있다.' },
      { key: '학습목표3', label: '학습 목표 3', type: 'text', placeholder: '' },
      { key: '느낀점', label: '오늘 수업 느낀 점', type: 'textarea', rows: 4 },
      { key: '더배우고싶은것', label: '더 배우고 싶은 것', type: 'textarea', rows: 3 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}
<style>.eval-table td { text-align:center; } .circle { font-size:14pt; }</style>
</head><body>
<div class="page-wrap">
<div class="title-box">수업 자기평가지</div>
<table>
  <tr>
    <th style="width:12%;">과목</th><td class="nowrap" style="width:20%;">{{과목}}</td>
    <th style="width:12%;">날짜</th><td class="nowrap" style="width:24%;">{{날짜}}</td>
    <th style="width:10%;">이름</th><td class="nowrap" style="width:22%;">{{이름}}</td>
  </tr>
  <tr>
    <th>단원·주제</th><td colspan="5">{{단원}}</td>
  </tr>
</table>
<h2>학습 목표 달성도</h2>
<table class="eval-table">
  <tr>
    <th style="width:55%; text-align:left; padding-left:8pt;">학습 목표</th>
    <th>매우 잘함 ★★★</th><th>잘함 ★★</th><th>노력 필요 ★</th>
  </tr>
  <tr class="circle"><td style="text-align:left;">{{학습목표1}}</td><td>○</td><td>○</td><td>○</td></tr>
  <tr class="circle"><td style="text-align:left;">{{학습목표2}}</td><td>○</td><td>○</td><td>○</td></tr>
  <tr class="circle"><td style="text-align:left;">{{학습목표3}}</td><td>○</td><td>○</td><td>○</td></tr>
</table>
<h2>오늘 수업에서 느낀 점</h2>
<div class="grow-area" style="min-height:80pt;">{{느낀점}}</div>
<h2>더 배우고 싶은 것</h2>
<div class="flex-area" style="flex:1;">{{더배우고싶은것}}</div>
</div></body></html>`,
  },
  {
    id: 'group-activity',
    category: '학급 활동',
    title: '모둠 활동 기록지',
    fields: [
      { key: '과목', label: '과목', type: 'text' },
      { key: '주제', label: '활동 주제', type: 'text' },
      { key: '날짜', label: '날짜', type: 'text', placeholder: '2026년 6월 3일' },
      { key: '모둠명', label: '모둠명', type: 'text', placeholder: '1모둠' },
      { key: '모둠원', label: '모둠원', type: 'text', placeholder: '홍길동, 이순신, 김유신' },
      { key: '역할분담', label: '역할 분담', type: 'textarea', rows: 3, placeholder: '홍길동: 발표자 / 이순신: 기록자' },
      { key: '활동내용', label: '활동 내용', type: 'textarea', rows: 5 },
      { key: '결과정리', label: '활동 결과 정리', type: 'textarea', rows: 4 },
      { key: '소감', label: '활동 소감', type: 'textarea', rows: 3 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="page-wrap">
<div class="title-box">모둠 활동 기록지</div>
<table>
  <tr>
    <th style="width:12%;">과목</th><td class="nowrap" style="width:30%;">{{과목}}</td>
    <th style="width:12%;">날짜</th><td class="nowrap">{{날짜}}</td>
  </tr>
  <tr>
    <th>활동 주제</th><td colspan="3">{{주제}}</td>
  </tr>
  <tr>
    <th>모둠명</th><td class="nowrap">{{모둠명}}</td>
    <th>모둠원</th><td>{{모둠원}}</td>
  </tr>
</table>
<h2>역할 분담</h2>
<div class="grow-area" style="min-height:55pt;">{{역할분담}}</div>
<h2>활동 내용</h2>
<div class="grow-area" style="min-height:90pt;">{{활동내용}}</div>
<h2>활동 결과 정리</h2>
<div class="grow-area" style="min-height:75pt;">{{결과정리}}</div>
<h2>활동 소감</h2>
<div class="flex-area" style="flex:1;">{{소감}}</div>
</div></body></html>`,
  },
  {
    id: 'counseling-log',
    category: '학급 활동',
    title: '상담 기록지',
    fields: [
      { key: '상담일시', label: '상담 일시', type: 'text', placeholder: '2026년 6월 3일' },
      { key: '담임', label: '담임교사', type: 'text' },
      { key: '학년반번호', label: '학년·반·번호', type: 'text', placeholder: '3학년 2반 15번' },
      { key: '이름', label: '학생 이름', type: 'text' },
      { key: '상담구분', label: '상담 구분', type: 'select', options: ['학교생활', '학습', '진로', '교우관계', '가정', '정서·심리', '기타'] },
      { key: '상담방법', label: '상담 방법', type: 'select', options: ['개인상담', '집단상담', '전화상담', '서면상담'] },
      { key: '상담내용', label: '상담 내용', type: 'textarea', rows: 6 },
      { key: '조치사항', label: '조치 및 후속 사항', type: 'textarea', rows: 4 },
      { key: '비고', label: '비고', type: 'textarea', rows: 2 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="page-wrap">
<div class="title-box">상담 기록지</div>
<table>
  <tr>
    <th style="width:14%;">상담 일시</th><td class="nowrap" style="width:28%;">{{상담일시}}</td>
    <th style="width:14%;">담임교사</th><td class="nowrap">{{담임}}</td>
  </tr>
  <tr>
    <th>학년·반·번호</th><td class="nowrap">{{학년반번호}}</td>
    <th>학생 이름</th><td class="nowrap">{{이름}}</td>
  </tr>
  <tr>
    <th>상담 구분</th><td class="nowrap">{{상담구분}}</td>
    <th>상담 방법</th><td class="nowrap">{{상담방법}}</td>
  </tr>
</table>
<h2>상담 내용</h2>
<div class="grow-area" style="min-height:120pt;">{{상담내용}}</div>
<h2>조치 및 후속 사항</h2>
<div class="flex-area" style="flex:1;">{{조치사항}}</div>
<h2>비고</h2>
<div class="grow-area" style="min-height:40pt;">{{비고}}</div>
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><p class="small">담임교사</p></div>
  <div class="sig-box"><div class="sig-line"></div><p class="small">부장/교감</p></div>
</div>
</div></body></html>`,
  },
  // ── 교무 행정 ──────────────────────────────────────────────────────
  {
    id: 'training-log',
    category: '교무 행정',
    title: '연수 등록부',
    fields: [
      { key: '연수명', label: '연수명', type: 'text', placeholder: '2026년 1학기 직무연수' },
      { key: '연수장소', label: '연수 장소', type: 'text' },
      { key: '일시', label: '일시', type: 'text', placeholder: '2026.06.10. 09:00~17:00' },
      { key: '참가자목록', label: '참가자 명단 (한 줄에 한 명)', type: 'participants', rows: 10, placeholder: '홍길동\n이순신\n김유신' },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}
<style>
.reg-table th { font-size:10pt; }
.reg-table td { height:22pt; }
</style>
</head><body>
<div class="page-wrap">
<div class="title-box">연수 등록부</div>
<table style="margin-bottom:10pt;">
  <tr>
    <th style="width:14%;">연수명</th><td colspan="3">{{연수명}}</td>
  </tr>
  <tr>
    <th style="width:14%;">일시</th><td class="nowrap" style="width:36%;">{{일시}}</td>
    <th style="width:14%;">연수 장소</th><td class="nowrap">{{연수장소}}</td>
  </tr>
</table>
{{참가자행}}
</div></body></html>`,
  },
  // ── 학급 활동 (추가) ────────────────────────────────────────────────
  {
    id: 'class-meeting-log',
    category: '학급 활동',
    title: '학급 회의록',
    fields: [
      { key: '회의일시', label: '회의 일시', type: 'text', placeholder: '2026년 6월 3일 (수) 5교시' },
      { key: '학년반', label: '학년/반', type: 'text', placeholder: '3학년 2반' },
      { key: '사회', label: '사회', type: 'text', placeholder: '홍길동' },
      { key: '서기', label: '서기', type: 'text', placeholder: '이순신' },
      { key: '참석', label: '참석 현황', type: 'text', placeholder: '재적 25명 중 24명 참석' },
      { key: '지난회의실천', label: '지난 회의 실천 결과', type: 'textarea', rows: 3 },
      { key: '안건', label: '오늘의 안건', type: 'textarea', rows: 3 },
      { key: '협의내용', label: '협의 내용', type: 'textarea', rows: 6 },
      { key: '결정사항', label: '결정 사항', type: 'textarea', rows: 4 },
      { key: '건의사항', label: '선생님께 드리는 건의사항', type: 'textarea', rows: 3 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="page-wrap">
<div class="title-box">학급 회의록</div>
<table>
  <tr>
    <th style="width:14%;">회의 일시</th><td class="nowrap" style="width:36%;">{{회의일시}}</td>
    <th style="width:14%;">학년/반</th><td class="nowrap">{{학년반}}</td>
  </tr>
  <tr>
    <th>사회</th><td class="nowrap">{{사회}}</td>
    <th>서기</th><td class="nowrap">{{서기}}</td>
  </tr>
  <tr>
    <th>참석 현황</th><td colspan="3">{{참석}}</td>
  </tr>
</table>
<h2>지난 회의 실천 결과</h2>
<div class="grow-area" style="min-height:50pt;">{{지난회의실천}}</div>
<h2>오늘의 안건</h2>
<div class="grow-area" style="min-height:50pt;">{{안건}}</div>
<h2>협의 내용</h2>
<div class="grow-area" style="min-height:95pt;">{{협의내용}}</div>
<h2>결정 사항</h2>
<div class="grow-area" style="min-height:65pt;">{{결정사항}}</div>
<h2>선생님께 드리는 건의사항</h2>
<div class="flex-area" style="flex:1;">{{건의사항}}</div>
</div></body></html>`,
  },
  {
    id: 'class-roles',
    category: '학급 활동',
    title: '1인 1역할',
    fields: [
      { key: '학기', label: '학기', type: 'text', placeholder: '2026학년도 1학기' },
      { key: '학년반', label: '학년/반', type: 'text', placeholder: '3학년 2반' },
      { key: '작성일', label: '작성일', type: 'text', placeholder: '2026년 6월 3일' },
      {
        key: '역할표',
        label: '1인 1역할 (한 줄에 "역할/담당 학생")',
        type: 'table',
        columns: ['역할', '담당 학생'],
        minRows: 18,
        placeholder: '칠판 정리/홍길동\n우유 당번/이순신\n분리수거/김유신',
      },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="page-wrap">
<div class="title-box" style="font-size:15pt; letter-spacing:2px;">1인 1역할</div>
<table style="margin-bottom:8pt;">
  <tr>
    <th style="width:14%;">학기</th><td class="nowrap" style="width:36%;">{{학기}}</td>
    <th style="width:14%;">학년/반</th><td class="nowrap">{{학년반}}</td>
  </tr>
  <tr>
    <th>작성일</th><td class="nowrap" colspan="3">{{작성일}}</td>
  </tr>
</table>
<h2>1인 1역할</h2>
{{역할표}}
</div></body></html>`,
  },
];
