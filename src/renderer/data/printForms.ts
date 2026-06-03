export interface PrintFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'select';
  placeholder?: string;
  options?: string[];
  rows?: number;
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
    @page { size: A4; margin: 15mm 20mm; }
    body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.8; color: #000; margin: 0; padding: 0; }
    h1 { text-align: center; font-size: 16pt; font-weight: bold; margin: 0 0 16pt; letter-spacing: 2px; }
    h2 { font-size: 12pt; font-weight: bold; margin: 12pt 0 4pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
    th, td { border: 1px solid #555; padding: 5pt 8pt; vertical-align: top; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; white-space: nowrap; }
    .field-label { font-weight: bold; width: 80pt; background: #f7f7f7; }
    .field-value { min-height: 18pt; }
    .content-area { border: 1px solid #555; min-height: 120pt; padding: 8pt; margin-bottom: 8pt; }
    .lined { background-image: repeating-linear-gradient(transparent, transparent 27px, #ddd 27px, #ddd 28px); line-height: 28px; }
    .signature-row { display: flex; justify-content: flex-end; gap: 24pt; margin-top: 12pt; }
    .sig-box { text-align: center; width: 60pt; }
    .sig-line { border-bottom: 1px solid #555; height: 36pt; margin-bottom: 4pt; }
    .title-box { border: 2px solid #222; padding: 6pt 12pt; text-align: center; font-size: 16pt; font-weight: bold; letter-spacing: 3px; margin-bottom: 16pt; }
    .small { font-size: 9pt; color: #555; }
  </style>
`;

export const PRINT_FORMS: PrintForm[] = [
  // ── 글쓰기 ─────────────────────────────────────────────────
  {
    id: 'diary',
    category: '글쓰기',
    title: '일기',
    fields: [
      { key: '날짜', label: '날짜', type: 'date' },
      { key: '학년반', label: '학년/반', type: 'text', placeholder: '예: 3학년 2반' },
      { key: '이름', label: '이름', type: 'text', placeholder: '홍길동' },
      { key: '날씨', label: '날씨', type: 'select', options: ['맑음', '흐림', '비', '눈', '바람'] },
      { key: '제목', label: '제목', type: 'text', placeholder: '일기 제목' },
      { key: '내용', label: '내용', type: 'textarea', rows: 10, placeholder: '오늘 있었던 일을 자유롭게 써보세요.' },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="title-box">일 기</div>
<table>
  <tr>
    <th class="field-label">날짜</th><td class="field-value">{{날짜}}</td>
    <th class="field-label">날씨</th><td class="field-value">{{날씨}}</td>
    <th class="field-label">이름</th><td class="field-value">{{이름}}</td>
  </tr>
  <tr>
    <th class="field-label">학년/반</th><td colspan="3" class="field-value">{{학년반}}</td>
  </tr>
  <tr>
    <th class="field-label">제목</th><td colspan="3" class="field-value"><strong>{{제목}}</strong></td>
  </tr>
</table>
<div class="content-area lined" style="min-height:200pt;">{{내용}}</div>
</body></html>`,
  },
  {
    id: 'book-report',
    category: '글쓰기',
    title: '독서감상문',
    fields: [
      { key: '날짜', label: '작성일', type: 'date' },
      { key: '학년반', label: '학년/반', type: 'text', placeholder: '3학년 2반' },
      { key: '이름', label: '이름', type: 'text', placeholder: '홍길동' },
      { key: '책제목', label: '책 제목', type: 'text', placeholder: '책 제목' },
      { key: '저자', label: '저자', type: 'text', placeholder: '지은이' },
      { key: '줄거리', label: '줄거리', type: 'textarea', rows: 4, placeholder: '책의 주요 내용을 써보세요.' },
      { key: '인상깊은내용', label: '인상 깊은 내용', type: 'textarea', rows: 3, placeholder: '가장 기억에 남는 장면이나 문장' },
      { key: '느낀점', label: '나의 생각·느낀 점', type: 'textarea', rows: 4, placeholder: '읽고 느낀 점을 써보세요.' },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="title-box">독서감상문</div>
<table>
  <tr>
    <th class="field-label">작성일</th><td class="field-value">{{날짜}}</td>
    <th class="field-label">학년/반</th><td class="field-value">{{학년반}}</td>
    <th class="field-label">이름</th><td class="field-value">{{이름}}</td>
  </tr>
  <tr>
    <th class="field-label">책 제목</th><td class="field-value" colspan="2">{{책제목}}</td>
    <th class="field-label">저자</th><td class="field-value">{{저자}}</td>
  </tr>
</table>
<h2>줄거리</h2>
<div class="content-area" style="min-height:80pt;">{{줄거리}}</div>
<h2>인상 깊은 내용</h2>
<div class="content-area" style="min-height:60pt;">{{인상깊은내용}}</div>
<h2>나의 생각 · 느낀 점</h2>
<div class="content-area lined" style="min-height:80pt;">{{느낀점}}</div>
</body></html>`,
  },
  {
    id: 'letter',
    category: '글쓰기',
    title: '편지',
    fields: [
      { key: '날짜', label: '작성일', type: 'date' },
      { key: '학년반', label: '학년/반', type: 'text', placeholder: '3학년 2반' },
      { key: '이름', label: '쓴 사람', type: 'text', placeholder: '홍길동' },
      { key: '받는사람', label: '받는 사람', type: 'text', placeholder: '받는 분 이름' },
      { key: '첫인사', label: '첫인사', type: 'textarea', rows: 2, placeholder: '안녕하세요. ...' },
      { key: '본문', label: '본문', type: 'textarea', rows: 8, placeholder: '하고 싶은 말을 써보세요.' },
      { key: '끝인사', label: '끝인사', type: 'textarea', rows: 2, placeholder: '건강하세요. ...' },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="title-box">편 지</div>
<table style="margin-bottom:12pt;">
  <tr>
    <th class="field-label">작성일</th><td class="field-value">{{날짜}}</td>
    <th class="field-label">학년/반</th><td class="field-value">{{학년반}}</td>
    <th class="field-label">쓴 사람</th><td class="field-value">{{이름}}</td>
  </tr>
</table>
<p style="font-size:12pt;"><strong>{{받는사람}}</strong>께</p>
<div class="content-area lined" style="min-height:40pt; margin-bottom:6pt;">{{첫인사}}</div>
<div class="content-area lined" style="min-height:160pt; margin-bottom:6pt;">{{본문}}</div>
<div class="content-area lined" style="min-height:40pt;">{{끝인사}}</div>
<div class="signature-row"><div><p style="text-align:right; margin-top:12pt;">{{날짜}}</p><p style="text-align:right;">{{이름}} 올림</p></div></div>
</body></html>`,
  },
  // ── 학급 활동 ──────────────────────────────────────────────
  {
    id: 'reading-log',
    category: '학급 활동',
    title: '독서 기록장',
    fields: [
      { key: '학기', label: '학기', type: 'text', placeholder: '2026학년도 1학기' },
      { key: '학년반번호', label: '학년·반·번호', type: 'text', placeholder: '3학년 2반 15번' },
      { key: '이름', label: '이름', type: 'text', placeholder: '홍길동' },
      { key: '날짜', label: '독서 날짜', type: 'date' },
      { key: '책제목', label: '책 제목', type: 'text' },
      { key: '저자', label: '저자', type: 'text' },
      { key: '쪽수', label: '읽은 쪽', type: 'text', placeholder: 'p.1 ~ p.50' },
      { key: '내용', label: '인상 깊은 내용·느낀 점', type: 'textarea', rows: 6 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="title-box">독서 기록장</div>
<table>
  <tr>
    <th class="field-label">학기</th><td colspan="3">{{학기}}</td>
  </tr>
  <tr>
    <th class="field-label">학년·반·번호</th><td>{{학년반번호}}</td>
    <th class="field-label">이름</th><td>{{이름}}</td>
  </tr>
  <tr>
    <th class="field-label">독서 날짜</th><td>{{날짜}}</td>
    <th class="field-label">읽은 쪽</th><td>{{쪽수}}</td>
  </tr>
  <tr>
    <th class="field-label">책 제목</th><td colspan="2">{{책제목}}</td>
    <th class="field-label" style="width:60pt;">저자</th><td>{{저자}}</td>
  </tr>
</table>
<h2>인상 깊은 내용 · 느낀 점</h2>
<div class="content-area lined" style="min-height:160pt;">{{내용}}</div>
</body></html>`,
  },
  {
    id: 'self-evaluation',
    category: '학급 활동',
    title: '수업 자기평가지',
    fields: [
      { key: '과목', label: '과목', type: 'text', placeholder: '국어' },
      { key: '단원', label: '단원·주제', type: 'text', placeholder: '1단원 - 이야기의 흐름' },
      { key: '날짜', label: '날짜', type: 'date' },
      { key: '학년반', label: '학년/반', type: 'text' },
      { key: '이름', label: '이름', type: 'text' },
      { key: '학습목표1', label: '학습 목표 1', type: 'text', placeholder: '이야기의 흐름을 파악할 수 있다.' },
      { key: '학습목표2', label: '학습 목표 2', type: 'text', placeholder: '인물의 마음을 이해할 수 있다.' },
      { key: '학습목표3', label: '학습 목표 3', type: 'text', placeholder: '' },
      { key: '느낀점', label: '오늘 수업에서 느낀 점', type: 'textarea', rows: 3 },
      { key: '더배우고싶은것', label: '더 배우고 싶은 것', type: 'textarea', rows: 2 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}<style>
.eval-table td { text-align: center; }
.star-row td { font-size: 14pt; letter-spacing: 4px; }
</style></head><body>
<div class="title-box">수업 자기평가지</div>
<table>
  <tr>
    <th class="field-label">과목</th><td>{{과목}}</td>
    <th class="field-label">날짜</th><td>{{날짜}}</td>
    <th class="field-label">이름</th><td>{{이름}}</td>
  </tr>
  <tr>
    <th class="field-label">단원·주제</th><td colspan="5">{{단원}}</td>
  </tr>
</table>
<h2>학습 목표 달성도</h2>
<table class="eval-table">
  <tr>
    <th style="width:60%;">학습 목표</th>
    <th>매우 잘함 ★★★</th><th>잘함 ★★</th><th>노력 필요 ★</th>
  </tr>
  <tr class="star-row">
    <td style="text-align:left;">{{학습목표1}}</td>
    <td>○</td><td>○</td><td>○</td>
  </tr>
  <tr class="star-row">
    <td style="text-align:left;">{{학습목표2}}</td>
    <td>○</td><td>○</td><td>○</td>
  </tr>
  <tr class="star-row">
    <td style="text-align:left;">{{학습목표3}}</td>
    <td>○</td><td>○</td><td>○</td>
  </tr>
</table>
<h2>오늘 수업에서 느낀 점</h2>
<div class="content-area" style="min-height:60pt;">{{느낀점}}</div>
<h2>더 배우고 싶은 것</h2>
<div class="content-area" style="min-height:40pt;">{{더배우고싶은것}}</div>
</body></html>`,
  },
  {
    id: 'group-activity',
    category: '학급 활동',
    title: '모둠 활동 기록지',
    fields: [
      { key: '과목', label: '과목', type: 'text' },
      { key: '주제', label: '활동 주제', type: 'text' },
      { key: '날짜', label: '날짜', type: 'date' },
      { key: '모둠명', label: '모둠명', type: 'text', placeholder: '1모둠' },
      { key: '모둠원', label: '모둠원 이름', type: 'text', placeholder: '홍길동, 이순신, 김유신' },
      { key: '역할분담', label: '역할 분담', type: 'textarea', rows: 3, placeholder: '홍길동: 발표자 / 이순신: 기록자 / ...' },
      { key: '활동내용', label: '활동 내용', type: 'textarea', rows: 5 },
      { key: '결과정리', label: '활동 결과 정리', type: 'textarea', rows: 4 },
      { key: '소감', label: '활동 소감', type: 'textarea', rows: 3 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="title-box">모둠 활동 기록지</div>
<table>
  <tr>
    <th class="field-label">과목</th><td>{{과목}}</td>
    <th class="field-label">날짜</th><td>{{날짜}}</td>
  </tr>
  <tr>
    <th class="field-label">활동 주제</th><td colspan="3">{{주제}}</td>
  </tr>
  <tr>
    <th class="field-label">모둠명</th><td>{{모둠명}}</td>
    <th class="field-label">모둠원</th><td>{{모둠원}}</td>
  </tr>
</table>
<h2>역할 분담</h2>
<div class="content-area" style="min-height:60pt;">{{역할분담}}</div>
<h2>활동 내용</h2>
<div class="content-area" style="min-height:100pt;">{{활동내용}}</div>
<h2>활동 결과 정리</h2>
<div class="content-area" style="min-height:80pt;">{{결과정리}}</div>
<h2>활동 소감</h2>
<div class="content-area lined" style="min-height:60pt;">{{소감}}</div>
</body></html>`,
  },
  {
    id: 'counseling-log',
    category: '학급 활동',
    title: '상담 기록지',
    fields: [
      { key: '상담일시', label: '상담 일시', type: 'date' },
      { key: '담임', label: '담임교사', type: 'text' },
      { key: '학년반번호', label: '학년·반·번호', type: 'text', placeholder: '3학년 2반 15번' },
      { key: '이름', label: '학생 이름', type: 'text' },
      { key: '상담구분', label: '상담 구분', type: 'select', options: ['학교생활', '학습', '진로', '교우관계', '가정', '정서·심리', '기타'] },
      { key: '상담방법', label: '상담 방법', type: 'select', options: ['개인상담', '집단상담', '전화상담', '서면상담'] },
      { key: '상담내용', label: '상담 내용', type: 'textarea', rows: 5 },
      { key: '조치사항', label: '조치 및 후속 사항', type: 'textarea', rows: 3 },
      { key: '비고', label: '비고', type: 'textarea', rows: 2 },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}</head><body>
<div class="title-box">상담 기록지</div>
<table>
  <tr>
    <th class="field-label">상담 일시</th><td>{{상담일시}}</td>
    <th class="field-label">담임교사</th><td>{{담임}}</td>
  </tr>
  <tr>
    <th class="field-label">학년·반·번호</th><td>{{학년반번호}}</td>
    <th class="field-label">학생 이름</th><td>{{이름}}</td>
  </tr>
  <tr>
    <th class="field-label">상담 구분</th><td>{{상담구분}}</td>
    <th class="field-label">상담 방법</th><td>{{상담방법}}</td>
  </tr>
</table>
<h2>상담 내용</h2>
<div class="content-area" style="min-height:110pt;">{{상담내용}}</div>
<h2>조치 및 후속 사항</h2>
<div class="content-area" style="min-height:60pt;">{{조치사항}}</div>
<h2>비고</h2>
<div class="content-area" style="min-height:40pt;">{{비고}}</div>
<div class="signature-row">
  <div class="sig-box"><div class="sig-line"></div><p class="small">담임교사</p></div>
  <div class="sig-box"><div class="sig-line"></div><p class="small">부장/교감</p></div>
</div>
</body></html>`,
  },
  // ── 교무 행정 ──────────────────────────────────────────────
  {
    id: 'training-log',
    category: '교무 행정',
    title: '연수 등록부',
    fields: [
      { key: '연수명', label: '연수명', type: 'text', placeholder: '2026년 1학기 직무연수' },
      { key: '연수기관', label: '연수 기관', type: 'text' },
      { key: '연수기간', label: '연수 기간', type: 'text', placeholder: '2026.03.10. ~ 2026.03.12.' },
      { key: '연수장소', label: '연수 장소', type: 'text' },
      { key: '연수시간', label: '연수 시간', type: 'text', placeholder: '15시간' },
    ],
    htmlTemplate: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${baseStyle}<style>
.reg-table th { font-size: 10pt; }
.reg-table td { height: 22pt; }
</style></head><body>
<div class="title-box">연수 등록부</div>
<table style="margin-bottom:10pt;">
  <tr>
    <th class="field-label">연수명</th><td colspan="3">{{연수명}}</td>
  </tr>
  <tr>
    <th class="field-label">연수 기관</th><td>{{연수기관}}</td>
    <th class="field-label">연수 시간</th><td>{{연수시간}}</td>
  </tr>
  <tr>
    <th class="field-label">연수 기간</th><td>{{연수기간}}</td>
    <th class="field-label">연수 장소</th><td>{{연수장소}}</td>
  </tr>
</table>
<table class="reg-table">
  <tr>
    <th style="width:30pt;">번호</th>
    <th>소속 학교</th>
    <th>직위</th>
    <th style="width:60pt;">성명</th>
    <th style="width:80pt;">서명</th>
  </tr>
  ${Array.from({ length: 20 }, (_, i) => `<tr><td style="text-align:center;">${i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
</table>
</body></html>`,
  },
];
