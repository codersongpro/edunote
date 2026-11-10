// EduNote 웹판 진입점.
// 데스크톱 preload가 하던 일(window.electronAPI 설치)을 먼저 한 뒤, 데스크톱과 똑같은 렌더러를 띄운다.
import { webApi, webExtras } from './webApi';
import { requestPersistentStorage } from './storage';

window.electronAPI = webApi;
window.edunoteWeb = webExtras;
requestPersistentStorage();

// electronAPI가 준비된 뒤에 화면 코드를 불러온다(모듈 최상위에서 electronAPI를 읽는 코드 대비).
void import('../renderer/index');
