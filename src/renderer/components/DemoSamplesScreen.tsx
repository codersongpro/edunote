import React, { useCallback, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';

type Field = { label: string; value: string };
type Sample = {
  title: string;
  note?: string;
  desc?: string; // 이 시연이 어떤 기능인지 한 줄 설명
  steps?: string[]; // 사용 순서 (어느 메뉴/탭 → 무엇 입력 → 무엇 클릭)
  result?: string; // 어떤 결과가 나오는지(기대 결과)
  fields: Field[];
};
type Category = { id: string; icon: string; title: string; desc?: string; samples: Sample[] };

const DEMO_DATA: Category[] = [
  {
    id: 'settings',
    icon: '⚙️',
    title: '설정 화면',
    desc: '시연 전에 기본 정보를 넣어 두면, 이후 생성 결과에 교사·학교 정보가 자동으로 반영됩니다.',
    samples: [
      {
        title: '기본 교사 정보',
        desc: '이름·소속·학년/반을 저장하면 문서와 기록을 만들 때 자동으로 채워집니다.',
        steps: ['설정 메뉴를 엽니다.', '이름·소속 기관·학년/반을 입력합니다.', '저장 후 다른 메뉴에서 자동 반영되는지 확인합니다.'],
        result: '문서작성기·생기부 등에서 교사명과 학교명이 자동으로 들어갑니다.',
        fields: [
          { label: '이름', value: '박지은' },
          { label: '소속 기관', value: '충북초등학교' },
          { label: '학년/반', value: '5학년 2반' },
        ],
      },
      {
        title: '주의어 사전',
        note: '설정의 사용자 주의어/금지 표현에 붙여넣어 테스트하세요.',
        desc: '생성 결과에 넣지 말아야 할 표현을 등록하면, 결과에 해당 표현이 있을 때 알려 줍니다.',
        result: '등록한 주의어가 생성 결과에 포함되면 "주의어 감지" 안내가 표시됩니다.',
        fields: [
          { label: '주의어', value: '우수함, 성실함, 모범적, 탁월함, 부적절한 표현' },
        ],
      },
      {
        title: '자동 정기 백업',
        desc: '설정한 주기로 전체 자료를 자동으로 백업해 둡니다.',
        result: '설정의 전체 자료 백업에서 자동 백업 상태와 최근 백업 시간을 확인할 수 있습니다.',
        fields: [
          { label: '백업 주기', value: '매주 금요일 16:30' },
          { label: '확인할 내용', value: '설정의 전체 자료 백업에서 자동 정기 백업 상태와 최근 백업 시간을 확인합니다.' },
        ],
      },
    ],
  },
  {
    id: 'admin',
    icon: '📄',
    title: '교무행정AI',
    desc: '공문 요약, 문서 작성, 번역 등 학교 행정 업무를 AI로 처리하는 기능들입니다.',
    samples: [
      {
        title: '교무행정AI 챗봇',
        desc: '학교 행정·업무에 대한 질문에 AI가 답해 줍니다.',
        steps: ['교무행정AI 챗봇 메뉴를 엽니다.', '아래 질문을 붙여넣고 전송합니다.'],
        result: '운영 계획서에 필요한 항목이 체크리스트로 정리되어 나옵니다.',
        fields: [
          { label: '질문', value: '초등학교 AI 동아리를 처음 운영하려고 합니다. 운영 계획서에 꼭 들어가야 할 항목을 체크리스트로 정리해 주세요.' },
        ],
      },
      {
        title: '공문요약·업무추출',
        note: '"텍스트 직접 입력" 칸에 붙여넣어 시연하세요.',
        desc: '긴 공문을 붙여넣으면 핵심 요약과 해야 할 업무를 뽑아 줍니다.',
        result: '공문 요약과 함께 제출 서류·기한 등 처리할 업무 목록이 정리됩니다.',
        fields: [
          {
            label: '샘플 공문',
            value: `수신 충북초등학교장
제목 2026학년도 학생 AI 교육 지원 사업 신청 안내

1. 관련: 미래교육과-2156(2026. 2. 20.)
2. 학생 AI 교육 활성화를 위해 다음과 같이 지원 사업을 안내하오니 희망 학교는 신청하여 주시기 바랍니다.

가. 지원 내용
  1) AI 동아리 운영학교: 교당 500,000원 지원
  2) AI 교육 담당교사 연수: 2026. 4. 9. 실시
나. 신청 방법
  1) 신청 기간: 2026. 3. 4. ~ 2026. 3. 14.
  2) 제출 서류: 운영 계획서 1부
  3) 제출처: 업무포털 공문 제출
다. 유의 사항
  - 운영 결과 보고서는 2026. 11. 30.까지 제출
  - 예산 집행 증빙 자료 보관 필수
  - 참고 웹사이트: https://www.moe.go.kr`,
          },
        ],
      },
      {
        title: '공문 할일 저장',
        desc: '공문에서 뽑은 업무를 할일로 저장해 한곳에서 관리합니다.',
        steps: ['공문요약·업무추출 결과에서 업무를 할일로 저장합니다.', '공문 할일 메뉴에서 저장된 할일을 확인합니다.'],
        result: '저장한 업무가 공문 할일 목록에 바로 표시됩니다.',
        fields: [
          { label: '저장할 업무', value: '운영 계획서 제출, 예산 집행 증빙 자료 보관, 결과 보고서 제출' },
          { label: '확인할 내용', value: '공문요약·업무추출 결과에서 할일로 저장한 뒤 공문 할일 메뉴에 바로 표시되는지 확인합니다.' },
        ],
      },
      {
        title: '문서작성기 - 내부결재 공문',
        desc: '제목과 요청사항만 넣으면 결재용 공문 초안을 만들어 줍니다.',
        steps: ['문서작성기 → "공문서" 탭을 선택합니다.', '제목과 본문 요청사항을 입력하고 생성합니다.'],
        result: '기안 형식에 맞춘 내부결재 공문 초안이 미리보기에 생성됩니다.',
        fields: [
          { label: '제목', value: '2026학년도 학생 AI 탐구 동아리 운영 계획' },
          { label: '본문 요청사항', value: '대상은 5~6학년 희망 학생 20명, 운영 기간은 2026년 4월부터 11월까지, 활동 시간은 매주 금요일 방과 후 1시간입니다. 주요 활동은 AI 기초 개념 학습, 이미지 생성 체험, 챗봇 활용 실습, 학생 AI 작품 전시회 준비입니다.' },
        ],
      },
      {
        title: '문서작성기 - 가정통신문',
        desc: '안내 내용을 넣으면 학부모께 보낼 가정통신문을 작성해 줍니다.',
        steps: ['문서작성기 → "가정통신문" 탭을 선택합니다.', '제목과 안내 내용을 입력하고 생성합니다.'],
        result: '학부모께 보낼 정중한 안내문이 생성되며, 표가 포함될 수 있습니다.',
        fields: [
          { label: '제목', value: '학생 AI 탐구 동아리 참가 신청 안내' },
          { label: '안내 내용', value: '5~6학년 희망 학생을 대상으로 AI 탐구 동아리를 운영합니다. 신청 기간은 3월 20일까지이며, 담임교사에게 신청서를 제출하면 됩니다. 활동은 매주 금요일 방과 후 1시간 진행됩니다.' },
        ],
      },
      {
        title: '가정통신문 다국어 번역',
        desc: '작성한 가정통신문을 다문화 가정을 위해 여러 언어로 번역합니다.',
        steps: ['가정통신문을 생성한 뒤 미리보기 위쪽에서 번역할 언어를 선택합니다.', '"번역" 버튼을 눌러 원문 아래에 번역문을 추가합니다.'],
        result: '원문 아래에 선택한 언어 번역이 함께 표시되어, 한 장으로 배포할 수 있습니다.',
        fields: [
          { label: '원문', value: 'AI 탐구 동아리 참가 신청 안내문을 학부모님께 전달합니다.' },
          { label: '번역 언어', value: '영어, 중국어, 일본어, 베트남어, 러시아어, 우즈베크어 등 13개 언어' },
        ],
      },
      {
        title: 'HWPX 저장 확인',
        desc: '생성한 문서를 한글(HWPX) 파일로 저장했을 때 서식이 잘 유지되는지 확인합니다.',
        steps: ['미리보기 위쪽 저장 형식에서 "HWPX"를 선택합니다.', '"저장"을 눌러 파일을 내려받습니다.'],
        result: '22pt 제목, 15pt 번호, 14pt 본문·표 서식이 적용된 (YYMMDD)_제목.hwpx 파일이 저장됩니다.',
        fields: [
          { label: '저장 형식', value: 'HWPX' },
          { label: '확인할 내용', value: '22pt 제목, 15pt 번호, 14pt 본문·표 서식과 (YYMMDD)_제목.hwpx 파일명을 확인합니다.' },
        ],
      },
      {
        title: '문서작성기 - 계획서',
        desc: '사업명·대상·예산을 넣으면 운영 계획서를 구성해 줍니다.',
        steps: ['문서작성기 → "계획서" 탭을 선택합니다.', '주제·대상·예산·추가 사항을 입력하고 생성합니다.'],
        result: '추진 배경·세부 계획·예산 등이 포함된 계획서 초안이 생성됩니다.',
        fields: [
          { label: '주제/사업명', value: '2026학년도 독서교육 운영 계획' },
          { label: '대상', value: '전교생 (1~6학년)' },
          { label: '예산', value: '800,000원' },
          { label: '추가 사항', value: '매달 학급 독서 토의 1회, 학기별 독서 감상문 대회 1회, 도서관 활용 수업 연계' },
        ],
      },
      {
        title: '문서작성기 - 보고서',
        desc: '운영 결과를 넣으면 결과 보고서를 정리해 줍니다.',
        steps: ['문서작성기 → "보고서" 탭을 선택합니다.', '주제·대상·운영 결과를 입력하고 생성합니다.'],
        result: '운영 개요·결과·향후 계획이 정리된 보고서가 생성됩니다.',
        fields: [
          { label: '주제/사업명', value: '2026학년도 AI 디지털 소양 교육 운영 결과' },
          { label: '대상', value: '4~6학년 (참여 학생 120명)' },
          { label: '예산', value: '500,000원' },
          { label: '운영 결과 및 주요 내용', value: '총 6차시 운영, 챗봇 체험·이미지 생성·AI 윤리 토론 활동 진행. 학생 만족도 4.6/5.0, 교사 자체 평가 우수.' },
          { label: '추가 사항', value: '내년 전 학년 확대 운영 예정' },
        ],
      },
      {
        title: '문서작성기 - 품의서',
        note: '품의 유형은 "물품 구매"로 선택하세요.',
        desc: '구입 내역과 예산을 넣으면 물품 구매 품의서를 만들어 줍니다.',
        steps: ['문서작성기 → "품의서" 탭에서 품의 유형을 "물품 구매"로 선택합니다.', '제목·예산·산출 내역·구입 목적을 입력하고 생성합니다.'],
        result: '산출 내역과 구입 목적이 정리된 품의서 초안이 생성됩니다.',
        fields: [
          { label: '품의 제목/건명', value: '2026학년도 독서교육 도서 구입' },
          { label: '소요 예산', value: '800000' },
          { label: '산출 내역', value: '도서 구입비: 10,000원 × 80권 = 800,000원' },
          { label: '세부 내역 (물품명·수량·단가)', value: '초등 권장도서(1~6학년 각 10권씩): 10,000원 × 60권 = 600,000원\n교사 연구도서: 10,000원 × 20권 = 200,000원' },
          { label: '구입 목적', value: '학생 독서 습관 형성 및 교원 수업 연구 지원' },
        ],
      },
      {
        title: '문서작성기 - 회의록',
        desc: '회의 안건과 내용을 넣으면 회의록으로 정리해 줍니다.',
        steps: ['문서작성기 → "회의록" 탭을 선택합니다.', '제목·일시·출석자·안건·내용을 입력하고 생성합니다.'],
        result: '안건별로 협의·결정 사항이 정리된 회의록이 생성됩니다.',
        fields: [
          { label: '제목', value: '2026학년도 1학기 학년협의회' },
          { label: '일시', value: '2026. 6. 10.(화) 16:00~17:00' },
          { label: '장소', value: '3학년 교무실' },
          { label: '출석자', value: '3학년 담임교사 4명, 교과 전담교사 2명' },
          { label: '회의 안건', value: '학기말 평가 일정 조율, 학예회 학년 발표 순서 확정, 현장체험학습 사전 안전교육 방법 협의' },
          { label: '회의 내용', value: '평가는 6월 23~27일로 확정, 학예회 3학년 발표는 2부 세 번째, 현장체험학습 안전교육은 6월 16일 학급별 실시하기로 결정' },
        ],
      },
      {
        title: '문서작성기 - 홍보자료',
        desc: '행사 정보를 넣으면 학교 소식 홍보·보도자료를 작성해 줍니다.',
        steps: ['문서작성기 → "홍보자료" 탭을 선택합니다.', '행사 일시·대상·내용·의의를 입력하고 생성합니다.'],
        result: '제목·본문·인터뷰가 포함된 보도자료 형식의 글이 생성됩니다.',
        fields: [
          { label: '행사 일시', value: '2026. 6. 20.(토) 10:00~15:00' },
          { label: '대상', value: '전교생 및 학부모, 지역 주민' },
          { label: '내용', value: '학생 AI 작품 전시, 체험 부스 운영(생성 AI 그림 그리기, 챗봇 만들기), 학교 오케스트라 공연, 먹거리 장터' },
          { label: '목적/의의', value: '학생들의 AI 창작 성과 공유 및 지역사회와 함께하는 학교 문화 조성' },
          { label: '인터뷰 대상자', value: '교장 선생님, 6학년 대표 학생, 학부모 참여자' },
        ],
      },
      {
        title: '문서작성기 - 메세지 (문자)',
        note: '"메세지" 탭 → 문자 메세지를 선택하세요.',
        desc: '짧은 알림 문자를 학부모용 문체로 다듬어 줍니다.',
        result: '학부모에게 보낼 간결한 문자 메시지가 생성됩니다.',
        fields: [
          { label: '내용', value: '6월 20일(토) 학교 축제가 열립니다. 오전 10시부터 오후 3시까지 학교 운동장에서 진행되오니 많은 참여 부탁드립니다.' },
        ],
      },
      {
        title: '문서작성기 - 메세지 (소통)',
        note: '"메세지" 탭 → 소통 메세지를 선택하세요.',
        desc: '상담·안내 등 소통 상황에 맞는 메시지를 작성해 줍니다.',
        result: '학부모와의 관계와 상황에 맞춘 정중한 소통 메시지가 생성됩니다.',
        fields: [
          { label: '나와의 관계', value: '학부모' },
          { label: '작성 내용', value: '다음 주 현장체험학습 관련하여 준비물과 당일 일정을 안내드리고, 도시락 지참 여부와 귀가 시간을 알려드리려 합니다.' },
        ],
      },
      {
        title: '문서작성기 - 공고문',
        desc: '모집·안내 공고문을 형식에 맞게 작성해 줍니다.',
        steps: ['문서작성기 → "공고문" 탭을 선택합니다.', '제목·공고 번호·내용·마감일을 입력하고 생성합니다.'],
        result: '공고 번호와 문의처가 포함된 공고문이 생성됩니다.',
        fields: [
          { label: '제목', value: '2026학년도 방과후학교 강사 모집 공고' },
          { label: '공고 번호', value: '제2026-08호' },
          { label: '공고 내용', value: '영어회화, 미술, 컴퓨터 코딩 강좌 각 1명 모집. 자격 요건은 관련 분야 자격증 소지자 또는 2년 이상 강의 경력자.' },
          { label: '마감일', value: '2026. 6. 30.' },
          { label: '문의처', value: '교무실 (043-000-0000)' },
        ],
      },
      {
        title: '간단 번역',
        desc: '짧은 글을 원하는 언어로 빠르게 번역합니다.',
        steps: ['간단 번역 메뉴를 엽니다.', '번역 방향을 고르고 원문을 입력해 번역합니다.'],
        result: '입력한 글이 선택한 언어로 번역되어 나옵니다.',
        fields: [
          { label: '번역 방향', value: '한국어 → 베트남어' },
          { label: '원문', value: '내일 체험학습은 오전 9시에 출발합니다. 편한 복장과 물을 준비해 주세요.' },
        ],
      },
    ],
  },
  {
    id: 'student',
    icon: '🎓',
    title: '학생기록AI',
    desc: '관찰 내용을 생활기록부 문장과 상담·학급 기록으로 바꿔 주는 기능들입니다.',
    samples: [
      {
        title: '학생기록AI 챗봇',
        desc: '생활기록부 작성 방법·표현을 물어볼 수 있는 챗봇입니다.',
        result: '피해야 할 표현과 권장 표현이 예시와 함께 정리되어 나옵니다.',
        fields: [
          { label: '질문', value: '초등학교 5학년 학생의 관찰 기록을 생활기록부 문장으로 바꿀 때 피해야 할 표현과 권장 표현을 알려 주세요.' },
        ],
      },
      {
        title: '행발생성',
        desc: '학생별 관찰 내용을 행동특성 및 종합의견 문장으로 바꿔 줍니다.',
        steps: ['생기부도우미 → 행발생성을 엽니다.', '학생 이름과 관찰 내용을 입력하고 생성합니다.'],
        result: '학생별로 생활기록부 문체의 행동특성 문장이 생성됩니다.',
        fields: [
          { label: '학생 이름', value: '김서윤, 이도현, 박민준' },
          { label: '관찰 내용', value: '김서윤: 모둠 활동에서 역할을 스스로 나누고 친구의 의견을 정리함.\n이도현: 발표 준비 과정에서 자료를 꾸준히 보완하고 질문에 성실히 답함.\n박민준: 새로운 아이디어를 제안하지만 과제 마무리 시간이 늦어질 때가 있음.' },
        ],
      },
      {
        title: '교과 세특 생성',
        desc: '수업 활동 관찰을 교과 세부능력 및 특기사항 문장으로 정리합니다.',
        steps: ['생기부도우미 → 교과세특을 엽니다.', '교과·과제·관찰 내용을 입력하고 생성합니다.'],
        result: '교과별 세특 문장이 생활기록부 문체로 생성됩니다.',
        fields: [
          { label: '교과', value: '국어' },
          { label: '과제', value: 'AI 활용 찬반 토론 후 주장하는 글 쓰기' },
          { label: '관찰 내용', value: '근거 자료를 찾아 자신의 주장과 연결하였고, 친구의 반론을 듣고 문장을 수정하는 태도가 돋보임.' },
        ],
      },
      {
        title: '수업관찰기록',
        desc: '수업 중 관찰한 내용을 기록으로 정리합니다.',
        steps: ['우리반기록 → 수업관찰기록을 엽니다.', '수업 주제와 관찰 내용을 입력하고 생성합니다.'],
        result: '수업 관찰 내용이 정리된 기록이 생성됩니다.',
        fields: [
          { label: '수업 주제', value: 'AI 이미지 생성 도구를 활용한 환경 포스터 만들기' },
          { label: '관찰 내용', value: '학생들이 프롬프트를 수정하며 결과물을 비교했고, 저작권과 출처 표시 필요성을 자연스럽게 토의함.' },
        ],
      },
      {
        title: '상담일지',
        desc: '학생 상담 내용을 상담일지 형식으로 정리합니다.',
        steps: ['우리반기록 → 상담일지를 엽니다.', '상담 유형과 내용을 입력하고 생성합니다.'],
        result: '상담 목적·내용·조치가 정리된 상담일지가 생성됩니다.',
        fields: [
          { label: '상담 유형', value: '학습 상담' },
          { label: '상담 내용', value: '최근 과제 제출이 늦어진 이유를 확인하고, 매일 10분씩 학습 계획을 점검하는 방법을 함께 정함.' },
        ],
      },
      {
        title: '학급경영일지',
        desc: '기간별 학급 활동을 학급경영일지로 정리합니다.',
        steps: ['우리반기록 → 학급경영일지를 엽니다.', '날짜 범위·주요 활동·담임 메모를 입력하고 생성합니다.'],
        result: '한 주간의 학급 운영 내용이 일지 형태로 정리됩니다.',
        fields: [
          { label: '날짜 범위', value: '2026. 6. 8. ~ 2026. 6. 12.' },
          { label: '주요 활동', value: '국어 토론 수업, AI 윤리 프로젝트, 학급 자치회의, 체육대회 준비' },
          { label: '담임 메모', value: '모둠별 역할 분담은 안정적이었으나 발표 순서 조정에서 일부 갈등이 있어 다음 주 자치회의에서 다시 다룰 예정임.' },
        ],
      },
      {
        title: '학생 메모 보드',
        desc: '학생별 관찰 메모를 모아 두었다가 생기부 작성에 활용합니다.',
        steps: ['우리반기록 → 학생 메모 보드를 엽니다.', '학생명과 메모를 입력해 저장합니다.'],
        result: '학생별 메모가 보드에 쌓여, 나중에 행발·세특 생성에 참고할 수 있습니다.',
        fields: [
          { label: '학생명', value: '김서윤' },
          { label: '메모', value: '모둠 발표 전 친구들의 의견을 표로 정리해 공유함. 다음 생기부 생성 시 협업 태도 참고.' },
        ],
      },
    ],
  },
  {
    id: 'lesson',
    icon: '📚',
    title: '수업자료AI',
    desc: '수업용 프레젠테이션·활동지와 수업 진행 도구를 만들어 주는 기능들입니다.',
    samples: [
      {
        title: '수업자료 생성 - 프레젠테이션',
        desc: '교과·단원·주제를 넣으면 수업용 슬라이드 구성안을 만들어 줍니다.',
        steps: ['수업자료 생성 메뉴를 엽니다.', '교과·단원·주제·추가 요청을 입력하고 생성합니다.'],
        result: '요청한 장수에 맞춰 슬라이드 구성안이 생성됩니다.',
        fields: [
          { label: '교과', value: '실과' },
          { label: '단원', value: '정보 사회와 인공지능' },
          { label: '주제', value: '인공지능은 우리 생활에서 어떻게 활용될까?' },
          { label: '추가 요청', value: '6장 내외, 초등학생 눈높이, 마지막 장에 AI 윤리 생각 질문 포함' },
        ],
      },
      {
        title: '수업자료 생성 - 활동지',
        desc: '주제를 넣으면 학생용 활동지(학습지)를 만들어 줍니다.',
        steps: ['수업자료 생성 메뉴에서 활동지 형식을 선택합니다.', '교과·주제·문항 요청을 입력하고 생성합니다.'],
        result: '빈칸 채우기·생각 나누기 등 문항이 포함된 활동지가 생성됩니다.',
        fields: [
          { label: '교과', value: '실과' },
          { label: '주제', value: 'AI가 학습하는 과정 이해하기' },
          { label: '추가 요청', value: '빈칸 채우기 3문항, 생각 나누기 2문항, 생활 속 AI 찾기 활동 포함' },
        ],
      },
      {
        title: '수업 도구 - QR 메이커',
        desc: 'URL을 QR 코드로 만들어 수업 자료 공유에 활용합니다.',
        steps: ['수업 도구 → QR 메이커를 엽니다.', 'URL과 표시 이름을 입력해 QR 코드를 만듭니다.'],
        result: '입력한 주소로 연결되는 QR 코드가 생성됩니다.',
        fields: [
          { label: 'URL', value: 'https://www.ebs.co.kr' },
          { label: '표시 이름', value: 'EBS 학습 자료' },
        ],
      },
      {
        title: '수업 도구 - 럭키드로우',
        desc: '참가자 명단으로 무작위 뽑기를 진행합니다.',
        steps: ['수업 도구 → 럭키드로우를 엽니다.', '참가자 목록을 붙여넣고 뽑기를 실행합니다.'],
        result: '명단에서 무작위로 한 명이 추첨됩니다.',
        fields: [
          { label: '참가자 목록', value: '김서윤\n이도현\n박민준\n최수아\n정하린\n오지후' },
        ],
      },
      {
        title: '나만의 자료실',
        desc: '수업에 쓰는 링크·자료를 메모와 함께 보관합니다.',
        steps: ['나만의 자료실 메뉴를 엽니다.', '자료 제목·URL·메모를 입력해 저장합니다.'],
        result: '저장한 자료가 목록에 쌓여 언제든 다시 찾아볼 수 있습니다.',
        fields: [
          { label: '자료 제목', value: 'AI 윤리 수업 참고 영상' },
          { label: 'URL', value: 'https://www.youtube.com/watch?v=example' },
          { label: '메모', value: '5학년 실과 AI 윤리 차시 도입 자료로 활용. 개인정보와 저작권 질문과 연결하기 좋음.' },
        ],
      },
    ],
  },
  {
    id: 'budget',
    icon: '💰',
    title: '예산안작성',
    desc: '총액과 작성 방식만 정하면 품목과 금액이 채워진 예산안을 만들어 줍니다.',
    samples: [
      {
        title: '예산안 만들기 - 과목별(비율) 방식',
        note: '예산안작성 메뉴에서 "과목별(비율)" 방식을 선택하고 아래 값을 입력하세요.',
        desc: '총 예산을 항목 비율로 나눠 예산안을 구성합니다.',
        result: '비율에 맞춰 항목별 금액과 희망 물품이 배분된 예산안이 생성됩니다.',
        fields: [
          { label: '예산 제목', value: '2026. AI·디지털선도학교 운영 예산' },
          { label: '총 예산 금액', value: '10,000,000' },
          { label: '교육운영비 비율', value: '60' },
          { label: '일반운영비 비율', value: '37' },
          { label: '업무추진비 비율', value: '3' },
          { label: '희망 물품', value: '학습용 태블릿, 헤드셋, AI 교육 콘텐츠 라이선스' },
        ],
      },
      {
        title: '예산안 만들기 - 일반 작성 방식',
        note: '예산안작성 메뉴에서 "일반 작성" 방식을 선택하고 아래 값을 입력하세요.',
        desc: '총 예산과 희망 물품만으로 예산안을 구성합니다.',
        result: '희망 물품을 바탕으로 품목·금액이 정리된 예산안이 생성됩니다.',
        fields: [
          { label: '예산 제목', value: '2026. 독서교육 활성화 사업 예산' },
          { label: '총 예산 금액', value: '3,000,000' },
          { label: '희망 물품', value: '도서, 독서기록장, 독서 이벤트 상품' },
        ],
      },
      {
        title: '0원 맞추기 - 수량 범위 예시',
        note: '예산안 생성 후 품목 행의 최소수량·최대수량 칸에 입력한 뒤 "0원 맞추기"를 눌러보세요.',
        desc: '남는 예산이 0원이 되도록 품목 수량을 자동으로 조정합니다.',
        result: '입력한 수량 범위 안에서 잔액이 0원이 되도록 품목 수량이 맞춰집니다.',
        fields: [
          { label: '최소수량 예시', value: '1' },
          { label: '최대수량 예시', value: '10' },
        ],
      },
    ],
  },
  {
    id: 'print',
    icon: '🖨️',
    title: '양식 인쇄',
    desc: '회의록·역할표·등록부 등 자주 쓰는 양식을 입력값으로 채워 인쇄용으로 만듭니다.',
    samples: [
      {
        title: '학급 회의록',
        note: '양식 인쇄 메뉴에서 "학급 회의록"을 선택하고 아래 값을 입력하세요.',
        desc: '학급 회의 내용을 회의록 양식에 채워 인쇄용으로 만듭니다.',
        result: '일시·안건·협의·결정 사항이 채워진 학급 회의록 양식이 만들어집니다.',
        fields: [
          { label: '일시', value: '2026. 6. 10.(화) 14:00 ~ 14:40' },
          { label: '장소', value: '5학년 2반 교실' },
          { label: '사회', value: '회장 이서준' },
          { label: '서기', value: '부회장 김하은' },
          { label: '안건', value: '학급 독서 이벤트 운영 방법, 5월 학급 자치 활동 결과 공유' },
          { label: '협의 내용', value: '독서 이벤트는 매주 월요일 아침 10분 독서 릴레이로 진행하기로 함. 가장 재미있게 읽은 책을 1문장으로 소개하는 형식.' },
          { label: '결정 사항', value: '독서 릴레이 6월 17일(월)부터 시작. 담당 역할: 이서준(진행), 김하은(기록)' },
        ],
      },
      {
        title: '1인 1역할',
        note: '양식 인쇄 메뉴에서 "1인 1역할"을 선택하고 아래 값을 "역할/담당학생" 형식으로 입력하세요.',
        desc: '학생별 1인 1역할을 표로 정리해 인쇄용으로 만듭니다.',
        result: '역할과 담당 학생이 짝지어진 역할표가 만들어집니다.',
        fields: [
          { label: '역할 목록 (역할/담당학생)', value: '출석부/김서윤\n칠판지우기/이도현\n화분관리/박민준\n창문/최수아\n전등/정하린\n온도계/오지후\n게시판/김태양\n급식도우미/이소민' },
        ],
      },
      {
        title: '연수 등록부',
        note: '양식 인쇄 메뉴에서 "연수 등록부"를 선택하고 아래 값을 입력하세요. "명단 추가" 버튼으로 20명 이상도 입력할 수 있습니다.',
        desc: '연수 참가자 명단을 등록부 양식으로 만듭니다.',
        result: '연수 정보와 참가자 명단이 채워진 등록부가 만들어집니다.',
        fields: [
          { label: '연수명', value: '2026. AI 활용 수업 역량 강화 연수' },
          { label: '일시', value: '2026. 6. 20.(금) 15:00 ~ 17:00' },
          { label: '장소', value: '충북초등학교 시청각실' },
          { label: '연수 대상', value: '전 교직원' },
          { label: '참가자 명단', value: '박지은\n김민수\n이지혜\n최성훈\n정유나\n오재원\n한소희\n강민준\n윤채원\n임도현' },
        ],
      },
    ],
  },
  {
    id: 'htmlapp',
    icon: '🖥️',
    title: 'HTML 앱 만들기',
    desc: '설명만 입력하면 바로 쓸 수 있는 작은 웹 학습 도구(앱)를 만들어 줍니다.',
    samples: [
      {
        title: '어휘 플래시카드',
        note: '내 스킬 → HTML 앱 만들기에서 "어휘 플래시카드" 예시를 클릭하면 사과/apple 등 6쌍이 미리 채워진 채 앱이 생성됩니다.',
        desc: '단어/뜻 쌍으로 뒤집는 플래시카드 학습 앱을 만듭니다.',
        result: '카드 뒤집기·정답률 표시가 되는 플래시카드 앱이 생성됩니다.',
        fields: [
          { label: '앱 유형', value: '어휘 플래시카드' },
          { label: '기능 설명', value: '사과/apple, 책/book, 학교/school, 친구/friend, 선생님/teacher, 공부하다/study 6쌍 기본 제공. 카드 클릭 시 앞/뒷면 뒤집기, 이전/다음 버튼, 맞힘/틀림 버튼과 정답률 표시, 단어/뜻 쌍 추가·수정 가능.' },
        ],
      },
      {
        title: '낱말 맞추기 퀴즈',
        note: '내 스킬 → HTML 앱 만들기에서 아래 정보를 입력하세요.',
        desc: '문항을 설명하면 4지선다 퀴즈 앱을 만듭니다.',
        result: '제한시간·점수 표시가 되는 퀴즈 앱이 생성됩니다.',
        fields: [
          { label: '앱 유형', value: '퀴즈 앱' },
          { label: '기능 설명', value: '국어 5학년 1학기 낱말 퀴즈. 문제 10개, 4지선다, 제한시간 20초, 오답 시 정답 표시, 최종 점수 100점 만점으로 표시' },
        ],
      },
    ],
  },
  {
    id: 'skills',
    icon: '🛠️',
    title: 'AI 스킬즈',
    desc: '자주 하는 작업을 나만의 AI 도구로 만들고, 다른 교사와 나눠 쓰는 기능입니다.',
    samples: [
      {
        title: '내 스킬 - AI 스킬 만들기',
        desc: '반복 작업을 처리하는 나만의 AI 도구를 직접 만듭니다.',
        steps: ['AI 스킬즈 → 내 스킬에서 새 스킬을 만듭니다.', '도구 이름·설명·프롬프트를 입력해 저장합니다.'],
        result: '입력한 프롬프트대로 동작하는 나만의 도구가 만들어집니다.',
        fields: [
          { label: '도구 이름', value: '학급 안내문 문장 다듬기' },
          { label: '도구 설명', value: '학부모 안내문 초안을 입력하면 더 정중하고 읽기 쉬운 문장으로 다듬어 주는 도구입니다.' },
          { label: '프롬프트', value: '아래 안내문 초안을 학부모에게 전달하기 적절한 문체로 다듬어 주세요. 문장은 간결하게 쓰고, 날짜와 준비물은 표로 정리해 주세요.' },
        ],
      },
      {
        title: '내 스킬 공유 설문',
        desc: '만든 도구를 다른 교사와 공유하기 위해 정보를 등록합니다.',
        result: '도구 정보가 공유 신청으로 접수됩니다.',
        fields: [
          { label: '만드신 도구의 종류', value: 'AI 스킬' },
          { label: '도구 이름', value: '학급 안내문 문장 다듬기' },
          { label: '공유 메시지', value: '반복해서 작성하는 학급 안내문을 빠르게 다듬기 위해 만든 도구입니다.' },
        ],
      },
      {
        title: '스킬마켓 - 이수증 연수번호 수집기',
        desc: '다른 교사가 공유한 도구를 가져와 사용합니다.',
        steps: ['AI 스킬즈 → 스킬마켓을 엽니다.', '도구를 선택해 내 스킬로 가져와 실행합니다.'],
        result: '이수증에서 성명·연수명·연수번호 등이 표로 추출·정렬됩니다.',
        fields: [
          { label: '사용 예시', value: '이수증 파일을 올린 뒤 성명, 연수명, 이수 날짜, 이수 시간, 연수 기관, 연수번호를 표로 추출합니다. 결과는 성명 기준 가나다순으로 정렬됩니다.' },
        ],
      },
    ],
  },
];

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all ${
        copied
          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200 border border-green-300 dark:border-green-700'
          : 'bg-white dark:bg-[#2E2822] text-[#78716C] dark:text-[#C4B8B0] hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-100 border border-[#E7E5E4] dark:border-[#2E2822]'
      }`}
      title="클립보드에 복사"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? '복사됨' : '복사'}
    </button>
  );
};

const DemoSamplesScreen: React.FC = () => {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set([DEMO_DATA[0].id]));
  const [openSamples, setOpenSamples] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSample = (key: string) => {
    setOpenSamples(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#FAF9F7] dark:bg-[#171210]">
      <div className="mx-auto w-full max-w-2xl space-y-3 px-5 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-black text-[#1C1917] dark:text-[#F0EBE6]">시연 샘플</h1>
          <p className="mt-0.5 text-sm text-[#78716C] dark:text-[#C4B8B0]">각 항목을 펼치면 기능 설명·사용 순서·기대 결과를 볼 수 있고, 복사 버튼으로 입력칸에 붙여넣기 하세요.</p>
          <p className="mt-1 text-xs text-[#78716C] dark:text-[#9C8F87]">
            가상 교사: <strong>박지은</strong> | 학교: <strong>충북초등학교</strong> | 학년/반: <strong>5학년 2반</strong>
          </p>
        </div>

        {DEMO_DATA.map(cat => (
          <div key={cat.id} className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white dark:border-[#2E2822] dark:bg-[#221E1B]">
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-[#FAF9F7] dark:hover:bg-[#2E2822]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="truncate font-bold text-[#1C1917] dark:text-[#F0EBE6]">{cat.title}</span>
                  <span className="rounded-full bg-[#EDE8E1] px-2 py-0.5 text-xs text-[#78716C] dark:bg-[#2E2822] dark:text-[#C4B8B0]">{cat.samples.length}</span>
                </div>
                {openCategories.has(cat.id)
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-[#78716C] dark:text-[#C4B8B0]" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-[#78716C] dark:text-[#C4B8B0]" />
                }
              </div>
              {cat.desc && (
                <span className="mt-1 block text-xs leading-relaxed text-[#78716C] dark:text-[#9C8F87]">{cat.desc}</span>
              )}
            </button>

            {openCategories.has(cat.id) && (
              <div className="divide-y divide-[#EDE8E1] border-t border-[#EDE8E1] dark:divide-[#2E2822] dark:border-[#2E2822]">
                {cat.samples.map((sample, si) => {
                  const sampleKey = `${cat.id}-${si}`;
                  const isOpen = openSamples.has(sampleKey);
                  return (
                    <div key={sampleKey}>
                      <button
                        onClick={() => toggleSample(sampleKey)}
                        className="w-full px-4 py-2.5 text-left transition-colors hover:bg-[#FAF9F7] dark:hover:bg-[#2E2822]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0]">{sample.title}</span>
                          {isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#78716C] dark:text-[#C4B8B0]" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#78716C] dark:text-[#C4B8B0]" />
                          }
                        </div>
                      </button>

                      {isOpen && (
                        <div className="space-y-2 px-4 pb-3">
                          {sample.desc && (
                            <p className="text-xs leading-relaxed text-[#57534E] dark:text-[#A8A29E]">{sample.desc}</p>
                          )}
                          {sample.steps && sample.steps.length > 0 && (
                            <ol className="list-decimal space-y-0.5 rounded-lg bg-[#FAF9F7] py-2 pl-7 pr-3 text-xs leading-relaxed text-[#44403C] dark:bg-[#171210]/70 dark:text-[#C4B8B0]">
                              {sample.steps.map((step, sti) => (
                                <li key={`${sampleKey}-step-${sti}`}>{step}</li>
                              ))}
                            </ol>
                          )}
                          {sample.note && (
                            <p className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-100">{sample.note}</p>
                          )}
                          {sample.fields.map((field, fi) => (
                            <div key={`${sampleKey}-${fi}`} className="rounded-lg bg-[#FAF9F7] p-2.5 dark:bg-[#171210]/70">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-[#78716C] dark:text-[#C4B8B0]">{field.label}</span>
                                <CopyButton text={field.value} />
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1C1917] dark:text-[#C4B8B0]">{field.value}</p>
                            </div>
                          ))}
                          {sample.result && (
                            <div className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-2 dark:border-green-800 dark:bg-green-900/20">
                              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">기대 결과</p>
                              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#1C1917] dark:text-[#C4B8B0]">{sample.result}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DemoSamplesScreen;
