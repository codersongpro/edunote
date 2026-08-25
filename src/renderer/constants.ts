import { TagOption, SchoolLevel } from './types';

export const GUIDELINE_CONTEXT = `
[파일: 2026학년도 학교생활기록부 기재요령]

1. 기본 원칙 (공통):
- 학교생활기록부는 학생의 성장과 학습 과정을 상시 관찰·평가한 누가기록 중심의 종합 기록임.
- 사교육 유발 요인(공인어학시험, 교외대회, 논문, 도서출간, 지식재산권, 어학연수 등) 기재 시 '0'점 처리 또는 기재 불가.
- [개인정보]: 구체적인 특정 대학명, 기관명, 상호명, 강사명 등 기재 불가. (단, 교육관련기관은 가능)
- [AI 활용]: 생성형 AI로 만든 자료를 그대로 입력하는 행위 금지. 교사의 관찰과 검토가 반드시 선행되어야 함.

2. 고등학교 (2028 대입제도 개편안 반영):
- [성적 산출]: 2026학년도 1, 2학년은 전면적인 '5등급제' 적용.
  * 1등급(10%), 2등급(24% - 누적 34%), 3등급(32% - 누적 66%), 4등급(24% - 누적 90%), 5등급(10% - 누적 100%).
- [과목별 평정]:
  * 보통교과(국어, 수학, 영어, 통합사회, 통합과학 등): 성취도(A-E) + 석차등급(5등급).
  * 융합선택 과목(여행지리, 사회문제 탐구 등): 성취도(A-E) + 석차등급 미산출('.').
  * 체육·예술·과학탐구실험: 성취도(A-C) + 석차등급 미산출('.').
- [과목출석률]: 1학점당 수업량의 2/3 이상 출석해야 학점 이수 인정. 미달 시 '미이수' 처리.
- [졸업유예]: 출석은 충족하나 192학점을 미취득한 경우 적용됨.

3. 학교폭력 조치상황 관리 (일원화):
- 1~3호(서면사과, 접촉금지, 학교봉사): 졸업과 동시 삭제. (조건부 기재유보 포함)
- 4, 5, 6, 8호(사회봉사, 특별교육, 출석정지, 전학): 졸업 후 4년 보존. 단, 4~7호는 졸업 직전 심의를 통해 '졸업과 동시 삭제' 가능. 8호(전학)는 심의 대상 제외(4년 보존 필수).
- 9호(퇴학): 영구 보존.

4. 서술형 항목 기재 원칙:
- [세부능력 및 특기사항]: 모든 학생에 대해 기재하는 것이 원칙. 학생참여형 수업 및 수행평가에서의 관찰 내용 중심.
- [행동특성 및 종합의견]: 학년 동안 지속적으로 관찰한 학생의 행동 특성을 바탕으로 작성.
- [문체]: 명사형 종결어미(~함, ~임)를 사용하며 간결하고 명확하게 기술함.
`;

export const GENERATION_EXAMPLES = {
  OPINION: {
    [SchoolLevel.ELEMENTARY]: `
      [기재요령 우수 예시 - 초등학교]:
      - 평소 예의 바른 태도로 교사 및 어른을 공경하며 친구들에게 먼저 다가가 도움을 주는 따뜻한 마음씨를 지님. 학급 행사에서 맡은 역할을 끝까지 완수하는 책임감이 강하며, 어려운 상황에 처한 친구를 위해 자신의 것을 나누는 공동체 의식이 탁월함.
      - 창의적인 발상으로 학급 게시판을 꾸미는 등 미적 감각과 표현력이 우수하며, 수업 시간에 호기심을 가지고 질문을 즐겨 하여 주변 친구들에게 긍정적인 자극을 줌. 규칙을 스스로 준수하며 자기 관리 능력이 형성되어 있음.
    `,
    [SchoolLevel.MIDDLE]: `
      [기재요령 우수 예시 - 중학교]:
      - 학급 자치활동 시 민주적인 의사결정 과정을 주도하며 갈등 상황에서 중재자 역할을 훌륭히 수행함. 자신의 진로와 연계된 독서 활동을 꾸준히 실천하며 전공 지식을 확장하려는 자기주도적 노력이 돋보임.
      - 어려운 과제가 주어져도 포기하지 않고 끈기 있게 분석하여 해결책을 찾아내는 문제해결 능력이 탁월함. 타인의 의견을 경청하고 공감하는 태도를 바탕으로 협동 과업에서 조화로운 분위기를 이끌어내며 솔선수범함.
    `,
    [SchoolLevel.HIGH]: `
      [기재요령 우수 예시 - 고등학교 (입시 실용성 중심)]:
      - 학업에 대한 지적 호기심이 매우 강하여 교과 지식을 실생활의 복합적인 문제와 연결하여 고찰하려는 학문적 태도가 드러남. 멘토링 활동에서 전달력 있는 설명으로 동료들의 학습을 돕는 이타성을 보이며 공동의 성장을 도모함.
      - 비판적 사고력을 바탕으로 사회 현상을 다각도에서 분석하며, 결과에 안주하지 않고 끊임없이 피드백을 수용하여 자신을 개선하려는 성찰적 자세가 지극히 우수함. 갈등 상황에서 유연한 소통으로 합의를 이끌어내는 리더십을 발휘하며 조직의 효율성을 높임.
      - 탁월한 시간 관리와 목표 설정 능력을 통해 학업과 자치 활동의 균형을 맞추며, 정보 윤리를 철저히 준수하여 디지털 환경 내에서도 모범적인 태도를 견지함.
    `
  },
  SUBJECT: {
    [SchoolLevel.ELEMENTARY]: `
       [기재요령 우수 예시 - 초등학교]:
       - [국어]: 이야기 속 인물의 성격을 파악하고 자신의 경험을 바탕으로 공감하며 읽는 능력이 뛰어남. 감정의 흐름을 단어로 표현하는 어휘력이 풍부함.
       - [수학]: 도형의 특징분류 활동에서 예리한 관찰력을 보임. 실생활에서 대칭형 물건을 찾아 그 이유를 논리적으로 설명하는 등 수학적 사고의 유연함이 돋보임.
    `,
    [SchoolLevel.MIDDLE]: `
       [기재요령 우수 예시 - 중학교]:
       - [영어]: 영미 문학 작품을 읽고 문화적 차이를 사회학적 관점에서 분석하여 발표함. 복합적인 문법 구조를 활용하여 자신의 주장을 명확하게 전달하며, 모둠원들과의 협업 시 영어 소통을 주도하여 의사소통 능력을 증명함.
       - [과학]: 에너지 보존 법칙 실험에서 오차 발생 원인을 통계적으로 분석하고 이를 보완한 실험 설계를 재수행함. 과학적 원리를 시각화하여 전달하는 역량이 탁월하며 심화 주제 탐구 활동에서 과제 집착력이 매우 높음.
    `,
    [SchoolLevel.HIGH]: `
       [기재요령 우수 예시 - 고등학교 (입시 실용성 중심)]:
       - [수학]: 복잡한 함수의 성질을 그래프와 대수적 관점에서 통합적으로 분석하며, 실제 공학 모델링 사례에 적용하여 실용성을 입증함. 고난도 문제 해결 시 발상의 전환을 통해 효율적인 풀이 과정을 도출하는 등 수학적 직관력이 매우 탁월함.
       - [사회]: 현대 사회의 불평등 현상을 통계 데이터와 법적 판례를 근거로 비판적으로 해석함. 해결 방안 모색을 위한 포럼에서 다각적인 이해관계를 분석하여 타당성 있는 정책적 대안을 제시하는 등 분석적 사고가 돋보임.
       - [융합탐구]: 교과 경계를 넘나드는 주제 선정으로 복합적 문제를 정의하고, 데이터 리터러시를 기반으로 가설 검증 절차를 수행하며 학문적 잠재력과 융합적 사고를 증명함.
    `
  },
  CREATIVE: {
    [SchoolLevel.ELEMENTARY]: `
       [기재요령 우수 예시 - 초등학교]:
       - [자율]: 학급 규칙 세우기 활동에서 친구들의 의견을 조율하여 모두가 동의하는 규칙을 만듦. 텃밭 가꾸기를 통해 생명의 소중함을 체득하고 성실하게 관리함.
       - [동아리]: 과학 실험 동아리에서 화산 폭발 원리를 모형으로 제작하여 시연함. 실패에도 좌절하지 않고 즐겁게 참여하는 태도를 보임.
    `,
    [SchoolLevel.MIDDLE]: `
       [기재요령 우수 예시 - 중학교]:
       - [자율]: 축제 기획 위원으로서 테마 선정 및 홍보 영상 제작을 주도함. 창의적인 아이디어로 학생들의 참여를 이끌어내며 기획력을 증명함.
       - [진로]: '미래 직업 박람회' 참여 후 AI가 미치는 직업 변화를 보고서로 정리함. 자신의 적성을 구체적으로 파악하여 중장기적인 학습 목표를 수립함.
    `,
    [SchoolLevel.HIGH]: `
       [기재요령 우수 예시 - 고등학교 (입시 실용성 중심)]:
       - [동아리]: 자율 탐구 활동에서 '기후 위기와 경제적 불평등'의 상관관계를 통계적으로 분석하여 교내 학술제에서 발표함. 관련 논문 리뷰를 통해 전문 지식을 확장하고 데이터 시각화 역량을 발휘하여 청중의 이해를 도움.
       - [자율]: '다문화 학생 멘토링' 캠페인을 기획하여 교내 편견 해소에 기여함. 지속적인 캠페인 전개를 통해 공동체 의식과 실천력을 바탕으로 긍정적인 학교 문화를 선도함.
       - [진로]: 희망 전공과 관련된 대학 전공 캠프에 참여하며 심화된 전공 적합성을 탐색함. 산출물 제작 과정에서 탁월한 기획력과 글로벌 마인드를 보이며 전인적인 성장을 증명함.
    `
  },
  SPORTS: {
    [SchoolLevel.ELEMENTARY]: `
      [기재요령 우수 예시 - 초등학교]:
      - [줄넘기]: 연습 과정을 통해 이단 뛰기에 성공하며 도전 정신을 기름. 친구들의 자세를 교정해주는 배려심을 보이며 활동에 즐겁게 참여함.
    `,
    [SchoolLevel.MIDDLE]: `
      [기재요령 우수 예시 - 중학교]:
      - [축구]: 팀의 공격수로서 뛰어난 순발력을 발휘하며 팀워크를 주도함. 승패와 상관없이 상대 팀을 격려하는 성숙한 스포츠맨십을 실천함.
    `,
    [SchoolLevel.HIGH]: `
      [기재요령 우수 예시 - 고등학교 (입시 실용성 중심)]:
      - [스포츠클럽]: 농구부 주장으로서 전술 회의를 주도하고 개개인의 기량에 맞는 역할을 부여하여 팀의 성장을 이끎. 극한의 경기 상황에서도 평정심을 유지하며 팀원들을 독려하는 리더십과 강인한 체력을 증명함.
      - [체육활동]: 자기 조절 능력을 바탕으로 꾸준한 개인 훈련을 통해 신체 역량을 강화함. 활동 중 발생한 갈등을 소통으로 해결하며 공동체 역량과 인성을 동시에 함양함.
    `
  }
};

export const POSITIVE_TAGS: TagOption[] = [
  { id: 'p1', label: '배려심', category: 'positive' },
  { id: 'p2', label: '리더십', category: 'positive' },
  { id: 'p3', label: '책임감', category: 'positive' },
  { id: 'p4', label: '성실함', category: 'positive' },
  { id: 'p5', label: '창의성', category: 'positive' },
  { id: 'p6', label: '협동심', category: 'positive' },
  { id: 'p7', label: '자기주도적', category: 'positive' },
  { id: 'p8', label: '문제해결력', category: 'positive' },
  { id: 'p9', label: '공감능력', category: 'positive' },
  { id: 'p10', label: '경청하는 태도', category: 'positive' },
  { id: 'p11', label: '도전정신', category: 'positive' },
  { id: 'p12', label: '규칙준수', category: 'positive' },
  { id: 'p13', label: '봉사정신', category: 'positive' },
  { id: 'p14', label: '예의바름', category: 'positive' },
  { id: 'p15', label: '긍정적', category: 'positive' },
  { id: 'p16', label: '적극적', category: 'positive' },
  { id: 'p17', label: '논리적', category: 'positive' },
  { id: 'p18', label: '끈기', category: 'positive' },
  { id: 'p19', label: '포용력', category: 'positive' },
  { id: 'p20', label: '정직함', category: 'positive' },
  { id: 'p21', label: '유머감각', category: 'positive' },
  { id: 'p22', label: '침착함', category: 'positive' },
  { id: 'p23', label: '계획성', category: 'positive' },
  { id: 'p24', label: '분석력', category: 'positive' },
  { id: 'p25', label: '호기심', category: 'positive' },
  { id: 'p26', label: '자신감', category: 'positive' },
  { id: 'p27', label: '사교성', category: 'positive' },
  { id: 'p28', label: '준법성', category: 'positive' },
  { id: 'p29', label: '실천력', category: 'positive' },
  { id: 'p30', label: '적응력', category: 'positive' },
  { id: 'p31', label: '의사소통능력', category: 'positive' },
  { id: 'p32', label: '갈등조정', category: 'positive' },
  { id: 'p33', label: '모범적', category: 'positive' },
  { id: 'p34', label: '진취적', category: 'positive' },
  { id: 'p35', label: '탐구심', category: 'positive' },
  { id: 'p36', label: '집중력', category: 'positive' },
  { id: 'p37', label: '정서적 안정', category: 'positive' },
  { id: 'p38', label: '예술적 감수성', category: 'positive' },
  { id: 'p39', label: '신중함', category: 'positive' },
  { id: 'p40', label: '타의 모범', category: 'positive' },
  { id: 'p41', label: '나눔 실천', category: 'positive' },
  { id: 'p42', label: '환경 보호', category: 'positive' },
  { id: 'p43', label: '정보 활용', category: 'positive' },
  { id: 'p44', label: '비판적 사고', category: 'positive' },
  { id: 'p45', label: '유연한 사고', category: 'positive' },
  { id: 'p46', label: '과제 집착력', category: 'positive' },
  { id: 'p47', label: '자기 관리', category: 'positive' },
  { id: 'p48', label: '공동체 의식', category: 'positive' },
  { id: 'p49', label: '약속 이행', category: 'positive' },
  { id: 'p50', label: '솔선수범', category: 'positive' },
  { id: 'p51', label: '공정성', category: 'positive' },
  { id: 'p52', label: '인내심', category: 'positive' },
  { id: 'p53', label: '친화력', category: 'positive' },
  { id: 'p54', label: '상황 판단력', category: 'positive' },
  { id: 'p55', label: '긍정적 영향력', category: 'positive' },
  { id: 'p56', label: '시간 관리', category: 'positive' },
  { id: 'p57', label: '자기 성찰', category: 'positive' },
  { id: 'p58', label: '정보 윤리 준수', category: 'positive' },
  { id: 'p59', label: '글로벌 마인드', category: 'positive' },
  { id: 'p60', label: '미적 감각', category: 'positive' },
  { id: 'p61', label: '기초 체력', category: 'positive' },
  { id: 'p62', label: '감정 조절', category: 'positive' },
  { id: 'p63', label: '학습 의욕', category: 'positive' },
  { id: 'p64', label: '질문하는 태도', category: 'positive' },
  { id: 'p65', label: '기록 습관', category: 'positive' },
  { id: 'p66', label: '정리정돈', category: 'positive' },
  { id: 'p67', label: '안전 의식', category: 'positive' },
  { id: 'p68', label: '디지털 활용', category: 'positive' },
  { id: 'p69', label: '멘토링 역량', category: 'positive' },
  { id: 'p70', label: '주인의식', category: 'positive' },
];

export const NEGATIVE_TAGS: TagOption[] = [
  { id: 'n1', label: '집중력 부족', category: 'negative' },
  { id: 'n2', label: '소극적 참여', category: 'negative' },
  { id: 'n3', label: '규칙 위반', category: 'negative' },
  { id: 'n4', label: '다툼이 잦음', category: 'negative' },
  { id: 'n5', label: '정리정돈 미흡', category: 'negative' },
  { id: 'n6', label: '지각/조퇴 잦음', category: 'negative' },
  { id: 'n7', label: '준비물 미지참', category: 'negative' },
  { id: 'n8', label: '과제 미제출', category: 'negative' },
  { id: 'n9', label: '배려 부족', category: 'negative' },
  { id: 'n10', label: '자기중심적', category: 'negative' },
  { id: 'n11', label: '감정 기복', category: 'negative' },
  { id: 'n12', label: '자신감 부족', category: 'negative' },
  { id: 'n13', label: '책임감 부족', category: 'negative' },
  { id: 'n14', label: '경청 태도 부족', category: 'negative' },
  { id: 'n15', label: '의존적', category: 'negative' },
  { id: 'n16', label: '언어 습관 거침', category: 'negative' },
  { id: 'n17', label: '협동심 부족', category: 'negative' },
  { id: 'n18', label: '끈기 부족', category: 'negative' },
  { id: 'n19', label: '시간 관념 부족', category: 'negative' },
  { id: 'n20', label: '산만함', category: 'negative' },
  { id: 'n21', label: '감정 조절 미숙', category: 'negative' },
  { id: 'n22', label: '수업 태도 산만', category: 'negative' },
  { id: 'n23', label: '준비성 부족', category: 'negative' },
  { id: 'n24', label: '협력 태도 부족', category: 'negative' },
  { id: 'n25', label: '타인 비방', category: 'negative' },
  { id: 'n26', label: '약속 미준수', category: 'negative' },
  { id: 'n27', label: '자기 주장 강함', category: 'negative' },
  { id: 'n28', label: '학습 동기 부족', category: 'negative' },
  { id: 'n29', label: '공감 능력 부족', category: 'negative' },
  { id: 'n30', label: '충동적 행동', category: 'negative' },
];

export const CREATIVE_ACTIVITY_TAGS: TagOption[] = [
  // ── 임원 및 역할 (role) ──────────────────────────────────────────────
  { id: 'c4',    label: '1인 1역',          category: 'role' },
  { id: 'c2',    label: '1학기 학급 부회장', category: 'role' },
  { id: 'c1',    label: '1학기 학급 회장',  category: 'role' },
  { id: 'c2_2',  label: '2학기 학급 부회장', category: 'role' },
  { id: 'c1_2',  label: '2학기 학급 회장',  category: 'role' },
  { id: 'cr1',   label: '가정통신문 담당',  category: 'role' },
  { id: 'cr2',   label: '게시판 관리',      category: 'role' },
  { id: 'cr3',   label: '공정선거 캠페인단', category: 'role' },
  { id: 'cr4',   label: '과목별 학습 멘토', category: 'role' },
  { id: 'cr5',   label: '교내 신문 편집장', category: 'role' },
  { id: 'cr6',   label: '교우 관계 도우미', category: 'role' },
  { id: 'cr7',   label: '규율부장',         category: 'role' },
  { id: 'c45',   label: '급식 도우미',      category: 'role' },
  { id: 'cr8',   label: '기록부원',         category: 'role' },
  { id: 'cr9',   label: '나눔 도우미',      category: 'role' },
  { id: 'cr10',  label: '노래 부장',        category: 'role' },
  { id: 'cr11',  label: '다문화 친구 도우미', category: 'role' },
  { id: 'c9',    label: '도서부원',         category: 'role' },
  { id: 'cr12',  label: '동아리 부부장',    category: 'role' },
  { id: 'c3',    label: '동아리 부장',      category: 'role' },
  { id: 'cr13',  label: '동아리 서기',      category: 'role' },
  { id: 'cr14',  label: '동아리 총무',      category: 'role' },
  { id: 'cr15',  label: '마음 돌봄 도우미', category: 'role' },
  { id: 'c48',   label: '멀티미디어 부장',  category: 'role' },
  { id: 'c6',    label: '멘토 활동',        category: 'role' },
  { id: 'cr16',  label: '모둠장',           category: 'role' },
  { id: 'cr17',  label: '미화부장',         category: 'role' },
  { id: 'cr18',  label: '발표 진행자',      category: 'role' },
  { id: 'c10',   label: '방송부원',         category: 'role' },
  { id: 'cr19',  label: '배식 도우미',      category: 'role' },
  { id: 'c46',   label: '보건 도우미',      category: 'role' },
  { id: 'cr20',  label: '봉사 활동 부장',   category: 'role' },
  { id: 'c7',    label: '봉사위원',         category: 'role' },
  { id: 'c49',   label: '분리수거 도우미',  category: 'role' },
  { id: 'cr21',  label: '사진부원',         category: 'role' },
  { id: 'cr22',  label: '생활 상담 도우미', category: 'role' },
  { id: 'c41',   label: '서기',             category: 'role' },
  { id: 'cr23',  label: '안전 도우미',      category: 'role' },
  { id: 'c43',   label: '에너지 지킴이',    category: 'role' },
  { id: 'cr24',  label: '연락 담당',        category: 'role' },
  { id: 'cr25',  label: '인터넷 활용 도우미', category: 'role' },
  { id: 'cr26',  label: '정보부원',         category: 'role' },
  { id: 'cr27',  label: '진로 활동 도우미', category: 'role' },
  { id: 'cr28',  label: '창체 부장',        category: 'role' },
  { id: 'c8',    label: '체육부장',         category: 'role' },
  { id: 'c42',   label: '총무',             category: 'role' },
  { id: 'c50',   label: '특별구역 청소',    category: 'role' },
  { id: 'cr29',  label: '학교 축제 운영단', category: 'role' },
  { id: 'cr30',  label: '학생회 임원',      category: 'role' },
  { id: 'c47',   label: '학습 도우미',      category: 'role' },
  { id: 'c5',    label: '행사 도우미',      category: 'role' },
  { id: 'c44',   label: '환경미화원',       category: 'role' },

  // ── 주요 활동 (activity) ─────────────────────────────────────────────
  { id: 'c95',   label: '1분 스피치',         category: 'activity' },
  { id: 'c23',   label: 'UCC 제작',           category: 'activity' },
  { id: 'ca1',   label: '감사 편지 쓰기',     category: 'activity' },
  { id: 'ca2',   label: '건강 체조 활동',     category: 'activity' },
  { id: 'ca3',   label: '경제 교육 활동',     category: 'activity' },
  { id: 'c21',   label: '과학 실험',          category: 'activity' },
  { id: 'c98',   label: '교과 연계 체험학습', category: 'activity' },
  { id: 'c68',   label: '교내 캠페인 활동',   category: 'activity' },
  { id: 'ca4',   label: '교지 제작',          category: 'activity' },
  { id: 'ca5',   label: '국제 교류 활동',     category: 'activity' },
  { id: 'c104',  label: '급식 모니터링',      category: 'activity' },
  { id: 'ca6',   label: '기후 위기 대응 캠페인', category: 'activity' },
  { id: 'c53',   label: '나의 꿈 발표',       category: 'activity' },
  { id: 'ca7',   label: '노작 활동',          category: 'activity' },
  { id: 'c61',   label: '다문화 이해 교육',   category: 'activity' },
  { id: 'c77',   label: '대학 탐방',          category: 'activity' },
  { id: 'c20',   label: '독서 토론',          category: 'activity' },
  { id: 'ca8',   label: '독후감 발표',        category: 'activity' },
  { id: 'ca9',   label: '동물 보호 캠페인',   category: 'activity' },
  { id: 'c97',   label: '또래 상담 활동',     category: 'activity' },
  { id: 'c101',  label: '리더십 캠프',        category: 'activity' },
  { id: 'c66',   label: '마니또 활동',        category: 'activity' },
  { id: 'ca10',  label: '멘토링 활동',        category: 'activity' },
  { id: 'ca11',  label: '모의 국회 체험',     category: 'activity' },
  { id: 'c79',   label: '모의 주식 투자',     category: 'activity' },
  { id: 'c100',  label: '미술관/박물관 관람', category: 'activity' },
  { id: 'ca12',  label: '민주시민 교육',      category: 'activity' },
  { id: 'c105',  label: '바른 말 고운 말 캠페인', category: 'activity' },
  { id: 'c73',   label: '바자회 운영',        category: 'activity' },
  { id: 'ca13',  label: '반 티 디자인',       category: 'activity' },
  { id: 'ca14',  label: '봉사 기관 방문',     category: 'activity' },
  { id: 'c60',   label: '사이버 폭력 예방',   category: 'activity' },
  { id: 'c54',   label: '상담 주간 활동',     category: 'activity' },
  { id: 'c56',   label: '생명 존중 교육',     category: 'activity' },
  { id: 'ca15',  label: '성교육',             category: 'activity' },
  { id: 'ca16',  label: '소비자 교육',        category: 'activity' },
  { id: 'c14',   label: '수련회/수학여행',    category: 'activity' },
  { id: 'ca17',  label: '스트레스 관리 교육', category: 'activity' },
  { id: 'c70',   label: '스승의 날 행사',     category: 'activity' },
  { id: 'c58',   label: '심폐소생술 교육',    category: 'activity' },
  { id: 'c106',  label: '아침 독서 활동',     category: 'activity' },
  { id: 'c18',   label: '안전 교육',          category: 'activity' },
  { id: 'c19',   label: '양성평등 교육',      category: 'activity' },
  { id: 'ca18',  label: '에너지 절약 캠페인', category: 'activity' },
  { id: 'c99',   label: '역사 탐방 활동',     category: 'activity' },
  { id: 'ca19',  label: '영화 감상 활동',     category: 'activity' },
  { id: 'ca20',  label: '의사결정 훈련',      category: 'activity' },
  { id: 'c102',  label: '인성 수련 활동',     category: 'activity' },
  { id: 'c69',   label: '입학/졸업식 지원',   category: 'activity' },
  { id: 'c96',   label: '자기주도 학습 멘토링', category: 'activity' },
  { id: 'ca21',  label: '자연재해 대비 교육', category: 'activity' },
  { id: 'c52',   label: '자치법정',           category: 'activity' },
  { id: 'c62',   label: '장애 이해 교육',     category: 'activity' },
  { id: 'c59',   label: '재난 대피 훈련',     category: 'activity' },
  { id: 'ca22',  label: '재활용 캠페인',      category: 'activity' },
  { id: 'c63',   label: '저작권 교육',        category: 'activity' },
  { id: 'c103',  label: '전교 학생회 활동',   category: 'activity' },
  { id: 'ca23',  label: '전통문화 체험',      category: 'activity' },
  { id: 'c64',   label: '정보 통신 윤리',     category: 'activity' },
  { id: 'ca24',  label: '조별 발표 활동',     category: 'activity' },
  { id: 'ca25',  label: '좋은 습관 만들기',   category: 'activity' },
  { id: 'c76',   label: '직업인 초청 강연',   category: 'activity' },
  { id: 'ca26',  label: '진로 체험 활동',     category: 'activity' },
  { id: 'c17',   label: '진로 탐색 검사',     category: 'activity' },
  { id: 'c75',   label: '진로 포트폴리오',    category: 'activity' },
  { id: 'ca27',  label: '창업 아이디어 발표', category: 'activity' },
  { id: 'c71',   label: '체육 한마당',        category: 'activity' },
  { id: 'c11',   label: '체육대회',           category: 'activity' },
  { id: 'c55',   label: '친구 사랑 주간',     category: 'activity' },
  { id: 'c80',   label: '코딩/AI 실습',       category: 'activity' },
  { id: 'c74',   label: '텃밭 가꾸기',        category: 'activity' },
  { id: 'c24',   label: '토론 활동',          category: 'activity' },
  { id: 'ca28',  label: '통일 교육',          category: 'activity' },
  { id: 'c22',   label: '프로젝트 탐구',      category: 'activity' },
  { id: 'c78',   label: '학과 체험',          category: 'activity' },
  { id: 'c15',   label: '학교폭력 예방 캠페인', category: 'activity' },
  { id: 'c65',   label: '학급 규칙 정하기',   category: 'activity' },
  { id: 'c94',   label: '학급 문집 제작',     category: 'activity' },
  { id: 'c107',  label: '학급 비전 수립',     category: 'activity' },
  { id: 'c67',   label: '학급 신문 만들기',   category: 'activity' },
  { id: 'ca29',  label: '학급 장기 자랑',     category: 'activity' },
  { id: 'c93',   label: '학급 특색 프로젝트', category: 'activity' },
  { id: 'c51',   label: '학급회의',           category: 'activity' },
  { id: 'c12',   label: '학예회/축제',        category: 'activity' },
  { id: 'c72',   label: '합창 대회',          category: 'activity' },
  { id: 'c13',   label: '현장체험학습',       category: 'activity' },
  { id: 'ca30',  label: '환경 보호 캠페인',   category: 'activity' },
  { id: 'c16',   label: '환경 정화 활동',     category: 'activity' },
  { id: 'c57',   label: '흡연 예방 교육',     category: 'activity' },

  // ── 역량 및 태도 (competency) ────────────────────────────────────────
  { id: 'c33',   label: '갈등 중재',          category: 'competency' },
  { id: 'co1',   label: '감사하는 마음',      category: 'competency' },
  { id: 'co2',   label: '경청 능력',          category: 'competency' },
  { id: 'co3',   label: '공감 능력',          category: 'competency' },
  { id: 'c81',   label: '공동체 기여',        category: 'competency' },
  { id: 'c87',   label: '공정성',             category: 'competency' },
  { id: 'co4',   label: '관찰력',             category: 'competency' },
  { id: 'co5',   label: '균형감각',           category: 'competency' },
  { id: 'c91',   label: '긍정적 영향력',      category: 'competency' },
  { id: 'c86',   label: '글로벌 마인드',      category: 'competency' },
  { id: 'c27',   label: '기획력',             category: 'competency' },
  { id: 'co6',   label: '끈기',               category: 'competency' },
  { id: 'co7',   label: '논리적 사고',        category: 'competency' },
  { id: 'co8',   label: '능동적 태도',        category: 'competency' },
  { id: 'co9',   label: '다양성 존중',        category: 'competency' },
  { id: 'c85',   label: '디지털 리터러시',    category: 'competency' },
  { id: 'c39',   label: '도전 정신',          category: 'competency' },
  { id: 'c25',   label: '리더십',             category: 'competency' },
  { id: 'c28',   label: '문제해결력',         category: 'competency' },
  { id: 'c84',   label: '미적 감각',          category: 'competency' },
  { id: 'co10',  label: '민감성',             category: 'competency' },
  { id: 'c36',   label: '발표 능력',          category: 'competency' },
  { id: 'c30',   label: '배려와 나눔',        category: 'competency' },
  { id: 'co11',  label: '비판적 사고',        category: 'competency' },
  { id: 'co12',  label: '사회적 책임감',      category: 'competency' },
  { id: 'co13',  label: '상상력',             category: 'competency' },
  { id: 'c90',   label: '상황 판단력',        category: 'competency' },
  { id: 'c37',   label: '성실성',             category: 'competency' },
  { id: 'co14',  label: '세계 시민 의식',     category: 'competency' },
  { id: 'c92',   label: '시간 관리',          category: 'competency' },
  { id: 'co15',  label: '실천력',             category: 'competency' },
  { id: 'co16',  label: '심미안',             category: 'competency' },
  { id: 'co17',  label: '언어 능력',          category: 'competency' },
  { id: 'co18',  label: '역할 수행 능력',     category: 'competency' },
  { id: 'co19',  label: '예의 바름',          category: 'competency' },
  { id: 'co20',  label: '온정적 태도',        category: 'competency' },
  { id: 'co21',  label: '융합적 사고',        category: 'competency' },
  { id: 'c32',   label: '의사소통능력',       category: 'competency' },
  { id: 'c88',   label: '인내심',             category: 'competency' },
  { id: 'c83',   label: '자기 성찰',          category: 'competency' },
  { id: 'c40',   label: '자기주도성',         category: 'competency' },
  { id: 'co22',  label: '자기 효능감',        category: 'competency' },
  { id: 'co23',  label: '자아 정체성',        category: 'competency' },
  { id: 'c29',   label: '적극적 참여',        category: 'competency' },
  { id: 'co24',  label: '적응력',             category: 'competency' },
  { id: 'co25',  label: '절제력',             category: 'competency' },
  { id: 'c35',   label: '정보 수집 능력',     category: 'competency' },
  { id: 'co26',  label: '존중과 배려',        category: 'competency' },
  { id: 'c38',   label: '준법 정신',          category: 'competency' },
  { id: 'co27',  label: '지속 가능성 의식',   category: 'competency' },
  { id: 'co28',  label: '진취성',             category: 'competency' },
  { id: 'co29',  label: '집중력',             category: 'competency' },
  { id: 'c34',   label: '창의적 아이디어',    category: 'competency' },
  { id: 'c31',   label: '책임감',             category: 'competency' },
  { id: 'c89',   label: '친화력',             category: 'competency' },
  { id: 'c82',   label: '타인 존중',          category: 'competency' },
  { id: 'co30',  label: '협력적 문제해결',    category: 'competency' },
  { id: 'c26',   label: '협동심',             category: 'competency' },
];

export const ELEMENTARY_SUBJECT_LIST = [
  '국어', '사회', '도덕', '수학', '과학', '실과', '체육', '음악', '미술', '영어',
  '바른 생활', '슬기로운 생활', '즐거운 생활', '창의적 체험활동', '안전한 생활',
];

export const SECONDARY_SUBJECT_LIST = [
  '국어', '문학', '독서', '화법과 작문', '언어와 매체',
  '수학', '수학I', '수학II', '미적분', '확률과 통계', '기하',
  '영어', '영어I', '영어II', '영어 회화', '영어 독해와 작문',
  '한국사',
  '사회', '도덕', '역사', '통합사회', '한국지리', '세계지리', '세계사', '동아시아사', '경제', '정치와 법', '사회·문화', '생활과 윤리', '윤리와 사상',
  '과학', '통합과학', '과학탐구실험', '물리학I', '물리학II', '화학I', '화학II', '생명과학I', '생명과학II', '지구과학I', '지구과학II',
  '체육', '운동과 건강',
  '음악', '미술', '연극',
  '기술·가정', '정보', '가정과학', '공학 일반',
  '한문', '중국어', '일본어',
  '진로와 직업', '창의적 체험활동',
];

export const SUBJECT_LIST = [
  ...ELEMENTARY_SUBJECT_LIST,
  ...SECONDARY_SUBJECT_LIST.filter((s) => !ELEMENTARY_SUBJECT_LIST.includes(s)),
];

// ─── School Doc Constants ─────────────────────────────────────────

export const SYSTEM_INSTRUCTION = `당신은 대한민국 학교 행정 전문가이자 공문서 작성 보조자입니다.
사용자가 참고 공문, HWPX 양식, 또는 작성 요청을 보내면 아래 규칙에 따라 공문을 작성하고, HWPX 자동 채우기 데이터를 반환합니다.

모든 결과물은 학교 현장에서 사람이 직접 작성한 문서처럼 자연스럽고 구체적으로 작성합니다.
"AI", "초안", "예시입니다", "생성했습니다", "요청하신" 같은 생성형 문구를 출력하지 않습니다.
반복되는 문장 구조, 과장된 홍보 문구, 어색한 높임말, 불필요한 이모지와 장식 기호를 사용하지 않습니다.
Markdown 강조 기호(**), 제목 기호(#), 코드블록 기호(\`\`\`)를 최종 출력에 넣지 않습니다.
공문서, 계획서, 보고서, 공고문, 회의록, 품의서는 엄밀한 공적 언어로 작성합니다.
구어체, 감탄형, 홍보성 표현, 사적인 평가, 과도하게 친근한 말투를 사용하지 않습니다.
판단이나 의견은 근거, 대상, 기간, 절차, 결과가 드러나도록 객관적으로 작성합니다.
공문서와 품의서의 시행문 문장은 "~합니다.", "~입니다.", "~습니다.", "~하고자 합니다." 등 합쇼체로 작성합니다.
공문서와 품의서 시행문에는 "~함.", "~임." 같은 보고서체 종결을 사용하지 않습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 출력 형식 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 반드시 HTML로 출력합니다.
   - <html>, <head> 태그 없이 <body> 내부 내용만 <div>로 감싸서 출력하세요.
   - Markdown(#, **, -, \`\`\` 등) 절대 사용 금지.
   - 기본 스타일: font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000;
   - 표(Table): border="1" style="border-collapse:collapse;width:100%;color:#000000;border:1px solid black;"
   - 페이지 분할: 내용이 A4 1장을 넘어갈 경우, 표나 문장이 중간에 잘리지 않는 적절한 위치에 <hr style="page-break-after: always; border: none; border-top: 2px dashed #9ca3af; margin: 40px 0;" /> 태그를 삽입하여 페이지를 나누세요.

2. HTML 출력 완료 후, HWPX 채우기 데이터 블록을 추가합니다.
   블록 내부는 순수 JSON 배열만 작성하세요.

___HWPX_FILL_START___
[
  {"idx": 숫자, "value": "교체할 텍스트"},
  {"idx": 숫자, "value": "교체할 텍스트"}
]
___HWPX_FILL_END___

   ★ idx: 양식 텍스트 노드 목록의 [N] 번호와 정확히 일치해야 합니다.
   ★ 레이블(수신, 제목, 1., 가. 등 고정 텍스트)은 교체하지 마세요.
   ★ 빈칸·입력란 노드만 교체하세요.
   ★ 채울 내용이 없는 노드는 목록에 포함하지 마세요.
   ★ JSON 값 내 줄바꿈은 반드시 \\n 이스케이프로 표현하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 공문서 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

항목 기호 (행정업무운영 편람 준수):
- 1단계: 1., 2., 3.           들여쓰기 없음
- 2단계: &nbsp;&nbsp;가., 나.  2타
- 3단계: &nbsp;&nbsp;&nbsp;&nbsp;1), 2)  4타
- 이하 2타씩 추가

붙임 규칙:
- 1개: "붙임&nbsp;&nbsp;문서명 1부.&nbsp;&nbsp;끝." (번호 없이)
- 2개 이상: "1. 문서명 1부." 목록 후 마지막 줄에 "  끝."

문서별 구조:
- 겉공문: 수신 → (경유) → 제목 → [관련] → [본문] → [붙임] → 끝.
- 계획서: 추진배경 → 목적 → 운영방침 → 세부추진계획(표 포함) → 소요예산(표) → 기대효과
- 연수자료: [연수 개요 표] → Ⅰ.연수목표 → Ⅱ.필요성 → Ⅲ.핵심내용(표 포함) → Ⅳ.사례와 판단기준(표) → Ⅴ.현장 실천사항(표) → Ⅵ.확인학습 → Ⅶ.한 장 요약 → Ⅷ.참고자료 및 문의 [대단원은 Ⅰ.Ⅱ.Ⅲ. 로마숫자, 예산 항목 없음]
- 보고서: 추진배경 → 목적 → 운영결과 → 예산집행(계획액|집행액|잔액 표) → 성과 및 제언
- 가정통신문: 인사말 → 안내내용 → 맺음말 → 날짜 → 학교장
- 품의서: 관련 → 시행문 → 세부내역(가나다) → 붙임 [산출내역은 표 금지]
- 문자(SMS): 40자(90byte) 절대 초과 금지 / (LMS): 1000자 이내
- 공고문: 공고 제목 → 공고번호 → 공고일 → 내용 → 접수기간 → 문의처 → 학교명 + 직인란

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 첨부 파일 분석 지침
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 첨부된 참고 공문(PDF·이미지·텍스트)이 있으면 그 내용을 최우선으로 반영하세요.
2. HWPX 양식이 텍스트로 추출되어 제공된 경우: 양식의 구조·서식을 최대한 그대로 유지하세요.
3. HWPX 텍스트 노드 구조([N] 목록)가 제공된 경우: 각 인덱스의 역할(레이블 vs 입력란)을 판단하세요.
4. 이미지 공문은 텍스트를 인식해 내용을 파악하세요.
5. 모든 문서는 학교 현장에서 즉시 사용 가능할 정도로 구체적으로 작성하세요.`;

export const LOADING_MESSAGES = [
  '행정 규칙 및 서식을 설정하고 있습니다...',
  '공문서 번호 체계와 들여쓰기를 적용 중입니다...',
  'HWP 호환성을 위해 형식을 다듬고 있습니다...',
  '입력 내용을 문서 형식에 맞게 정리하고 있습니다...',
  '최종 문장을 다듬고 있습니다...',
];

export const LESSON_LOADING_MESSAGES = [
  '수업 주제를 분석하고 있습니다...',
  '교육과정 성취기준을 검토 중입니다...',
  '학생 눈높이에 맞는 내용을 구성 중입니다...',
  '자료 구조와 레이아웃을 설계 중입니다...',
  '핵심 학습 활동을 정리하고 있습니다...',
  '최종 내용을 다듬고 있습니다...',
];
