// "학생 데이터 전체 삭제"가 지워야 할 저장소를 한곳에 모은다.
//
// 학생 개인정보가 여러 저장소(localStorage 접두사 2종, 단일 키 1개, JSON 파일 2개,
// 설정값 3개)에 흩어져 있어, 새 저장소를 추가할 때 한 곳을 빠뜨리면 삭제에 구멍이 생긴다.
// 그래서 삭제 대상을 이 모듈에 모으고 테스트로 고정한다.
import { clearAllHistory, clearDocumentHistory } from './generationHistory';
import { clearWorkDraft } from './workDraft';

const STUDENT_MEMO_STORAGE_KEY = 'eduNote_studentMemos_v1';

// 확인 대화상자에 그대로 보여줄 목록. 코드가 실제로 지우는 대상과 문구를 함께 관리한다.
export const STUDENT_DATA_TARGET_LABELS = [
  '학생별 생성 이력(행발·세특·스포츠클럽·창체 등)',
  '상담일지·수업관찰기록 등 문서 생성 이력',
  '학생 메모 보드의 모든 메모',
  '자동 저장된 작업 내용(이어서 하기)',
  '설정에 저장된 학생 명단',
] as const;

export async function clearAllStudentData(): Promise<void> {
  clearAllHistory();
  clearDocumentHistory();
  localStorage.removeItem(STUDENT_MEMO_STORAGE_KEY);

  await window.electronAPI.writeJsonData('student-memos', []);
  await clearWorkDraft();
  await window.electronAPI.setConfig({
    studentNames: '',
    studentMaleNames: '',
    studentFemaleNames: '',
  });
}
