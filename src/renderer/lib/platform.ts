// 실행 환경(데스크톱 앱 / 웹 브라우저) 구분.
// 화면은 두 판이 공유하므로, 웹에서 쓸 수 없는 기능은 이 파일의 값으로만 분기한다.
// (예: 폴더 선택·자동 백업·업데이트 확인은 데스크톱 전용)

export interface WebExtras {
  isRememberSecrets(): Promise<boolean>;
  setRememberSecrets(remember: boolean): Promise<void>;
  clearAllData(): Promise<void>;
}

declare global {
  interface Window {
    /** 웹판(src/web/main.tsx)에서만 설치된다. 데스크톱에서는 undefined. */
    edunoteWeb?: WebExtras;
  }
}

export const isWeb = typeof window !== 'undefined' && !!window.edunoteWeb;

// 기능별 지원 여부 — 화면에서 "숨김" 대신 같은 자리에 안내를 보여줄 때 쓴다.
export const platformSupports = {
  folderSelection: !isWeb,
  autoBackup: !isWeb,
  updateCheck: !isWeb,
  pageScreenshot: !isWeb,
};

// 웹판에서 API 키를 저장한 뒤 보여줄 안내(데스크톱의 "암호화 저장소를 사용할 수 없음" 경고 자리).
export const WEB_API_KEY_NOTICE = {
  title: 'API 키는 이 브라우저에만 저장됩니다',
  description: '서버로 전송되지 않습니다. 학교 공용 PC라면 사용 후 설정의 「이 브라우저의 데이터 지우기」를 눌러 주세요.',
};
