import { CustomTool } from '../types';

export const SAMPLE_TOOLS: CustomTool[] = [
  {
    id: 'sample-feedback',
    name: '과제 피드백 생성기',
    description: '학생 과제를 첨부하면 맞춤형 피드백을 자동으로 작성합니다.',
    category: 'student',
    inputs: [
      { id: 'student_name', label: '학생 이름', type: 'text', placeholder: '예: 홍길동' },
      { id: 'subject', label: '과목/단원', type: 'text', placeholder: '예: 수학 3단원' },
      { id: 'assignment', label: '과제 파일 또는 사진', type: 'file-upload' },
    ],
    promptTemplate: `다음 학생의 과제에 대한 교육적 피드백을 작성해줘.
학생: {{student_name}} / 과목·단원: {{subject}}
잘한 점, 개선할 점, 격려의 말을 포함해서 친절하게 작성해줘.`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'sample-cert',
    name: '이수증 연수번호 수집기',
    description: '이수증 파일이나 사진을 올리면 연수명·이수번호를 자동 추출합니다. 여러 장을 한 번에 올릴 수 있습니다.',
    category: 'admin',
    inputs: [
      {
        id: 'cert_file',
        label: '이수증 파일 또는 사진',
        type: 'file-upload',
        placeholder: 'PDF·사진·HWPX 모두 가능, Ctrl+V 붙여넣기도 됩니다.',
      },
    ],
    promptTemplate: `첨부된 이수증에서 다음 정보를 추출해서 표로 정리해줘:
연수명 | 이수 날짜 | 이수 시간 | 연수 기관 | 연수번호
없는 항목은 '-'로 표시해줘.`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
