import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { MessageCircle, Copy, Download, Trash2, Pin, PinOff, Video, ExternalLink } from 'lucide-react';
import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import {
  getFirestore, initializeFirestore, type Firestore, type Timestamp, collection, doc, setDoc, updateDoc, addDoc, getDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch,
} from 'firebase/firestore';
// (참고) 학생 화면(docs/chat/index.html)은 보안 규칙 검증을 위해 공개 메시지/귓속말을 별도 쿼리로 나눠 구독하지만,
// 교사 화면은 isRoomOwner() 권한으로 항상 전체를 읽을 수 있어 쿼리를 나눌 필요가 없다.
import { CHAT_FIREBASE_GUIDE_STEPS, CHAT_FIRESTORE_RULES, CHAT_STUDENT_PAGE_URL, CHAT_SETUP_GUIDE_VIDEO_URL } from '../lib/chatFirebaseGuide';

// 이 화면은 두 가지 모드로 동작한다.
//  - 'manage'      : 에듀노트 본 창(학급도구 → 채팅방 탭). Firebase 설정·채팅방 시작·QR/접속주소·지난 채팅방 관리를 맡고,
//                    대화 자체는 보여주지 않는다. 방을 시작하면 대화 창을 자동으로 띄운다.
//  - 'conversation': 별도 새 창(#chat). 본 창에서 시작해 둔 활성 채팅방의 대화(참여자·메시지·입력창)만 보여준다.
// 두 창은 같은 origin이라 익명 uid(방 소유권)를 공유하고, electron 저장소의 활성 방 ID·Firebase 설정을 함께 읽어
// 같은 방을 각자 구독한다.
type ChatView = 'manage' | 'conversation';

interface ChatMessage {
  id: string;
  sender: string;
  text?: string;
  senderUid?: string;
  to?: string[] | null;
}

interface PastRoom {
  id: string;
  closed: boolean;
  title?: string;
}

interface Participant {
  id: string;
  nickname: string;
  lastSeen: Timestamp | null;
}

interface PinnedMessage {
  sender: string;
  text: string;
}

// 마지막 접속 신호(lastSeen)가 이 시간(ms) 안이면 "접속 중"으로 본다.
const PRESENCE_TIMEOUT_MS = 40_000;

const FIREBASE_APP_NAME = 'edunote-chat';
const ROOM_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];

function generateRoomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ROOM_ID_ALPHABET[b % ROOM_ID_ALPHABET.length]).join('');
}

// Firebase가 돌려주는 영어 오류 코드를 교사가 바로 조치할 수 있는 한국어 안내로 바꿔준다.
function describeChatError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // 익명 로그인이 꺼져 있을 때 나는 오류. 콘솔에서 익명 로그인을 켜면 해결된다.
  if (raw.includes('auth/configuration-not-found') || raw.includes('auth/admin-restricted-operation')) {
    return 'Firebase 콘솔에서 익명 로그인이 켜져 있지 않습니다. Authentication → Sign-in method → "익명"을 사용 설정으로 켠 뒤 다시 시도해주세요.';
  }
  // Firestore 보안 규칙이 최신 버전으로 게시되지 않았을 때 나는 오류.
  if (raw.includes('permission-denied')) {
    return 'Firebase 보안 규칙이 최신 버전이 아닙니다. "규칙 복사" 버튼으로 규칙을 다시 복사해 Firestore Database의 "규칙" 탭에 붙여넣고 게시한 뒤 다시 시도해주세요.';
  }
  return raw;
}

const URL_PATTERN = /((?:https?:\/\/|www\.)\S+)/gi;

// 메시지에 적힌 웹 주소(http(s):// 또는 www.로 시작하는 부분)만 클릭 가능한 링크로 바꿔준다.
function linkifyText(text: string, linkClassName = 'text-amber-600 hover:underline break-all'): React.ReactNode {
  return text.split(URL_PATTERN).map((part, i) => {
    if (!part) return null;
    if (!/^(?:https?:\/\/|www\.)/i.test(part)) return part;
    const href = part.startsWith('http') ? part : `https://${part}`;
    return (
      <button
        key={i}
        type="button"
        onClick={() => window.electronAPI.openExternal(href)}
        className={linkClassName}
      >
        {part}
      </button>
    );
  });
}

// 보낸 사람 이름마다 같은 색이 나오도록(카카오톡처럼) 이름을 해시해 고정된 색을 골라준다.
const BUBBLE_COLORS = [
  'bg-blue-100 text-blue-900',
  'bg-emerald-100 text-emerald-900',
  'bg-purple-100 text-purple-900',
  'bg-pink-100 text-pink-900',
  'bg-cyan-100 text-cyan-900',
  'bg-orange-100 text-orange-900',
  'bg-lime-100 text-lime-900',
  'bg-indigo-100 text-indigo-900',
];

function colorForSender(sender: string): string {
  let hash = 0;
  for (let i = 0; i < sender.length; i++) hash = (hash * 31 + sender.charCodeAt(i)) >>> 0;
  return BUBBLE_COLORS[hash % BUBBLE_COLORS.length];
}

// Firebase 콘솔에서 그대로 복사한 JS 코드(따옴표 있는 키: 값 형태)에서 필요한 값만 안전하게 추출한다.
// eval/Function을 쓰지 않아 붙여넣은 텍스트로 임의 코드가 실행될 위험이 없다.
function parseFirebaseConfig(raw: string): Record<string, string> | null {
  const result: Record<string, string> = {};
  for (const key of CONFIG_KEYS) {
    const match = raw.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
    if (match) result[key] = match[1];
  }
  if (!result.apiKey || !result.projectId || !result.appId) return null;
  return result;
}

interface ChatRoomProps {
  view?: ChatView;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ view = 'manage' }) => {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [firebaseConfig, setFirebaseConfig] = useState<Record<string, string> | null>(null);
  const [configInput, setConfigInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [rulesCopied, setRulesCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [reconfiguring, setReconfiguring] = useState(false);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [teacherName, setTeacherName] = useState('선생님');

  const [pastRooms, setPastRooms] = useState<PastRoom[]>([]);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<ChatMessage[]>([]);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [whisperTargets, setWhisperTargets] = useState<{ id: string; nickname: string }[]>([]);
  const [now, setNow] = useState(Date.now());
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessage | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<FirebaseApp | null>(null);
  const dbRef = useRef<Firestore | null>(null);
  const authRef = useRef<Auth | null>(null);
  const uidRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ensureFirebase = (config: Record<string, string>) => {
    if (!appRef.current) {
      appRef.current = getApps().find(a => a.name === FIREBASE_APP_NAME) ?? initializeApp(config, FIREBASE_APP_NAME);
      // 학교망 프록시가 실시간 스트리밍(WebChannel)을 버퍼링해 메시지가 즉시 전달되지 않는 문제가 있어,
      // 변경마다 독립적인 요청/응답으로 주고받는 롱폴링을 강제해 실시간 수신이 끊기지 않게 한다.
      dbRef.current = initializeFirestore(appRef.current, { experimentalForceLongPolling: true });
    }
    return { db: dbRef.current! };
  };

  // 익명 인증으로 로그인 화면 없이 교사 PC에 고유한 uid를 부여한다.
  // 이 uid가 있어야 보안 규칙에서 "방을 만든 사람(ownerUid)" 또는 "귓속말 받는 사람(to)"을 구분할 수 있다.
  const ensureAuth = async (app: FirebaseApp): Promise<string> => {
    if (!authRef.current) {
      authRef.current = getAuth(app);
      // 같은 PC에서 익명 uid가 유지되도록 로컬 지속성을 명시한다(방 소유권 유지에 필요).
      await setPersistence(authRef.current, browserLocalPersistence);
    }
    const auth = authRef.current;
    // 앱 시작 직후에는 저장된 익명 계정의 복원이 끝나기 전이라 currentUser가 잠시 null이다.
    // 복원을 기다리지 않고 signInAnonymously를 부르면 새 uid가 생겨 이전에 만든 방의 소유권을
    // 잃게 되므로(종료·삭제 불가), 먼저 복원이 끝나길 기다린 뒤 판단한다.
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser.uid;
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  };

  const buildJoinUrl = (id: string, config: Record<string, string>) => {
    // 접속 URL이 너무 길어 QR이 빽빽해지지 않도록, 학생 화면 연결에 꼭 필요한 값(apiKey·projectId·appId)만
    // 담는다. authDomain은 `<projectId>.firebaseapp.com`으로 유도 가능하고, storageBucket·messagingSenderId·
    // measurementId는 Firestore+익명 인증 채팅에 필요 없어 제외한다(학생 페이지가 빠진 authDomain을 보완한다).
    const minimalConfig = { apiKey: config.apiKey, projectId: config.projectId, appId: config.appId };
    const cfgBase64 = btoa(JSON.stringify(minimalConfig));
    return `${CHAT_STUDENT_PAGE_URL}#room=${id}&cfg=${encodeURIComponent(cfgBase64)}`;
  };

  // 본 창(manage)에서 쓰는 가벼운 구독 — 방의 종료 여부·제목만 추적한다(대화는 보여주지 않으므로
  // 메시지·참여자는 구독하지 않는다). 다운로드는 필요할 때 그때그때 직접 읽어온다.
  const subscribeRoomDoc = (id: string, db: Firestore) =>
    onSnapshot(doc(db, 'rooms', id), snap => {
      setClosed(!!snap.data()?.closed);
      setRoomTitle((snap.data()?.title as string | undefined) ?? '');
    });

  // 대화 창(conversation)에서 쓰는 전체 구독 — 방 정보·메시지·참여자를 모두 실시간으로 받는다.
  const subscribeToRoom = (id: string, db: Firestore) => {
    const unsubRoom = onSnapshot(doc(db, 'rooms', id), snap => {
      setClosed(!!snap.data()?.closed);
      setRoomTitle((snap.data()?.title as string | undefined) ?? '');
      setPinnedMessage((snap.data()?.pinnedMessage as PinnedMessage | undefined) ?? null);
    });
    const unsubMessages = onSnapshot(
      query(collection(db, 'rooms', id, 'messages'), orderBy('createdAt', 'asc')),
      snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) })));
      },
    );
    const unsubParticipants = onSnapshot(
      collection(db, 'rooms', id, 'participants'),
      snap => {
        setParticipants(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Participant, 'id'>) })));
      },
    );
    return () => { unsubRoom(); unsubMessages(); unsubParticipants(); };
  };

  // 보안 규칙이 rooms 컬렉션 전체 조회(list)를 막으므로, 내가 만든 방 목록은
  // 이 PC에 저장해 둔 기록(chatRoomHistory)에서 읽고 각 방을 단건 조회(get)한다.
  const readRoomHistory = async (): Promise<{ id: string; title: string }[]> => {
    const raw = await window.electronAPI.getConfig('chatRoomHistory') as string | undefined;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const loadPastRooms = async (db: Firestore) => {
    const history = await readRoomHistory();
    const rooms = await Promise.all(history.map(async (h): Promise<PastRoom | null> => {
      try {
        const snap = await getDoc(doc(db, 'rooms', h.id));
        if (!snap.exists()) return null;
        return { id: h.id, title: h.title || (snap.data()?.title as string | undefined), closed: !!snap.data()?.closed };
      } catch {
        return null;
      }
    }));
    setPastRooms(rooms.filter((r): r is PastRoom => r !== null));
  };

  // 설정 불러오기
  useEffect(() => {
    (async () => {
      const raw = await window.electronAPI.getConfig('chatFirebaseConfig') as string | undefined;
      if (raw) {
        try { setFirebaseConfig(JSON.parse(raw)); } catch { /* 손상된 값은 무시하고 재설정을 유도 */ }
      }
      const name = await window.electronAPI.getConfig('teacherName') as string | undefined;
      if (name) setTeacherName(name);
    })();
  }, []);

  // Firebase 연동 + 진행 중이던 채팅방 복원
  useEffect(() => {
    if (!firebaseConfig) { setLoadingConfig(false); return; }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { db } = ensureFirebase(firebaseConfig);
        // 느린 네트워크(학교망 등)에서 익명 인증·Firestore 복원이 20~30초씩 걸리는 동안 화면 전체가
        // "불러오는 중..."으로 멈춰 채팅방 제목조차 입력할 수 없던 문제를 막는다. Firebase 앱을 초기화한
        // 뒤 곧바로 로딩 표시를 끄고(시작 화면·제목 입력칸을 즉시 사용 가능하게), 익명 인증과 진행 중이던
        // 방 복원은 화면을 막지 않고 백그라운드에서 진행한다.
        setLoadingConfig(false);
        const activeId = await window.electronAPI.getConfig('chatActiveRoomId') as string | undefined;
        if (cancelled) return;
        uidRef.current = await ensureAuth(appRef.current!);
        if (cancelled) return;
        if (activeId) {
          const snap = await getDoc(doc(db, 'rooms', activeId));
          if (cancelled) return;
          if (snap.exists() && !snap.data()?.closed) {
            setRoomId(activeId);
            setRoomTitle((snap.data()?.title as string | undefined) ?? '');
            setClosed(false);
            if (view === 'manage') {
              setJoinUrl(buildJoinUrl(activeId, firebaseConfig));
              unsub = subscribeRoomDoc(activeId, db);
            } else {
              unsub = subscribeToRoom(activeId, db);
            }
            unsubscribeRef.current = unsub;
          } else if (view === 'manage') {
            // 활성 방이 이미 종료·삭제됐다면 본 창에서만 기록을 비운다(공유 저장소를 대화 창이 건드리지 않게 한다).
            await window.electronAPI.setConfig({ chatActiveRoomId: '' });
          }
        }
        if (view === 'manage') await loadPastRooms(db);
        if (!cancelled) setChatError(null);
      } catch (e) {
        if (!cancelled) {
          setChatError(`Firebase 연결에 실패했습니다: ${describeChatError(e)}`);
          setLoadingConfig(false);
        }
      }
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [firebaseConfig, view]);

  // QR 이미지 생성 — joinUrl은 본 창(manage)에서만 만들어지므로 본 창에서만 생성된다.
  useEffect(() => {
    if (!joinUrl) { setQrDataUrl(null); return; }
    // 화면에 띄우는 QR이라 오류정정은 M(15%)이면 충분하며, H(30%)보다 모듈이 커져 휴대폰 스캔이 쉬워진다.
    QRCode.toDataURL(joinUrl, { width: 300, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1a1a1a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [joinUrl]);

  useEffect(() => {
    // 새 메시지가 오면 메시지 영역만 맨 아래로 스크롤한다. scrollIntoView는 바깥 패널까지 함께
    // 스크롤해 입력창이 위로 밀려 올라가므로, 메시지 컨테이너의 scrollTop만 직접 조정한다.
    const c = messagesContainerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  // 참여자의 "접속 중" 표시가 시간이 지나면 자동으로 "접속 끊김"으로 바뀌도록 주기적으로 갱신한다.
  useEffect(() => {
    if (!roomId || closed) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [roomId, closed]);

  const handleCopyRules = async () => {
    await navigator.clipboard.writeText(CHAT_FIRESTORE_RULES);
    setRulesCopied(true);
    setTimeout(() => setRulesCopied(false), 2000);
  };

  const handleCopyUrl = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    const parsed = parseFirebaseConfig(configInput) ?? firebaseConfig;
    if (!parsed) {
      setTestResult({ ok: false, message: 'firebaseConfig를 먼저 입력해주세요.' });
      return;
    }
    setTesting(true);
    try {
      const existing = getApps().find(a => a.name === 'edunote-chat-test');
      const app = existing ?? initializeApp(parsed, 'edunote-chat-test');
      const db = getFirestore(app);
      // 존재하지 않는 방을 단건 조회한다. 연결·규칙이 정상이면 "없음"으로 성공 응답이 오고,
      // 규칙이 잘못됐거나 연결이 안 되면 예외가 발생한다(목록 조회는 규칙상 금지이므로 사용하지 않는다).
      await getDoc(doc(db, 'rooms', '_connectiontest'));
      setTestResult({ ok: true, message: '연결에 성공했습니다.' });
    } catch (e) {
      setTestResult({ ok: false, message: `연결 실패: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    const parsed = parseFirebaseConfig(configInput);
    if (!parsed) {
      setTestResult({ ok: false, message: 'firebaseConfig 형식을 인식할 수 없습니다. 콘솔에서 복사한 코드 전체를 그대로 붙여넣어주세요.' });
      return;
    }
    const existing = getApps().find(a => a.name === FIREBASE_APP_NAME);
    if (existing) await deleteApp(existing);
    appRef.current = null;
    dbRef.current = null;
    authRef.current = null;
    uidRef.current = null;
    await window.electronAPI.setConfig({ chatFirebaseConfig: JSON.stringify(parsed) });
    setTestResult(null);
    setFirebaseConfig(parsed);
    setReconfiguring(false);
  };

  const startRoom = async () => {
    if (!firebaseConfig) return;
    setChatError(null);
    try {
      const { db } = ensureFirebase(firebaseConfig);
      const uid = await ensureAuth(appRef.current!);
      uidRef.current = uid;
      const id = generateRoomId();
      const title = titleInput.trim();
      await setDoc(doc(db, 'rooms', id), { createdAt: serverTimestamp(), closed: false, title, ownerUid: uid });
      const history = await readRoomHistory();
      const nextHistory = [{ id, title }, ...history.filter(h => h.id !== id)].slice(0, 20);
      await window.electronAPI.setConfig({ chatActiveRoomId: id, chatRoomHistory: JSON.stringify(nextHistory) });
      setRoomId(id);
      setRoomTitle(title);
      setClosed(false);
      setMessages([]);
      setParticipants([]);
      setWhisperTargets([]);
      setPinnedMessage(null);
      setJoinUrl(buildJoinUrl(id, firebaseConfig));
      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeRoomDoc(id, db);
      // 활성 방 ID를 저장한 직후 대화 창을 새 창으로 띄운다(이미 떠 있던 창이 있으면 새 방으로 다시 불러오게 한다).
      window.electronAPI.openChatWindow({ reload: true });
      await loadPastRooms(db);
    } catch (e) {
      setChatError(`채팅방을 시작하지 못했습니다: ${describeChatError(e)}`);
    }
  };

  const handleCloseRoom = async () => {
    if (!roomId || !dbRef.current) return;
    if (!window.confirm('채팅방을 종료하면 모든 학생이 더 이상 참여할 수 없습니다(학생 화면이 종료 안내로 잠깁니다). 종료할까요?')) return;
    try {
      await updateDoc(doc(dbRef.current, 'rooms', roomId), { closed: true });
      await window.electronAPI.setConfig({ chatActiveRoomId: '' });
      await loadPastRooms(dbRef.current);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const denied = /permission|insufficient/i.test(msg);
      setChatError(denied
        ? '이 채팅방은 다른 익명 계정(이전 설치·재설정 시점)으로 만들어져 종료 권한이 없습니다. 새 채팅방을 만들어 사용하시고, 이 방은 Firebase 콘솔에서 삭제해주세요.'
        : `채팅방을 종료하지 못했습니다: ${msg}`);
    }
  };

  // 채팅방을 종료한 뒤 시작 화면으로 되돌려 새 채팅방을 만들 수 있게 한다.
  // (handleCloseRoom에서 이미 chatActiveRoomId를 비웠으므로 화면 state만 초기화한다.)
  const handleResetRoom = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setRoomId(null);
    setRoomTitle('');
    setTitleInput('');
    setClosed(false);
    setMessages([]);
    setParticipants([]);
    setWhisperTargets([]);
    setPinnedMessage(null);
    setJoinUrl(null);
    setQrDataUrl(null);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !roomId || !dbRef.current || closed || !uidRef.current) return;
    setDraft('');
    try {
      await addDoc(collection(dbRef.current, 'rooms', roomId, 'messages'), {
        sender: teacherName || '선생님',
        text,
        createdAt: serverTimestamp(),
        senderUid: uidRef.current,
        to: whisperTargets.length > 0 ? whisperTargets.map(t => t.id) : null,
      });
    } catch (e) {
      setChatError(`메시지를 보내지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handlePinMessage = async (m: ChatMessage) => {
    if (!roomId || !dbRef.current || (m.to && m.to.length > 0)) return; // 귓속말은 모두에게 보이는 공지로 고정할 수 없다.
    try {
      await updateDoc(doc(dbRef.current, 'rooms', roomId), { pinnedMessage: { sender: m.sender, text: m.text ?? '' } });
    } catch (e) {
      setChatError(`공지로 설정하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleUnpinMessage = async () => {
    if (!roomId || !dbRef.current) return;
    try {
      await updateDoc(doc(dbRef.current, 'rooms', roomId), { pinnedMessage: null });
    } catch (e) {
      setChatError(`공지 고정을 해제하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const formatTranscript = (title: string, msgs: ChatMessage[]) =>
    `${title}\n\n${msgs.map(m => `[${m.sender}] ${m.text ?? ''}`).join('\n')}`;

  const sanitizeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_');

  // 본 창에서는 대화를 실시간 구독하지 않으므로, 다운로드 시점에 메시지를 한 번 읽어 저장한다.
  const handleDownloadActiveRoom = async () => {
    if (!dbRef.current || !roomId) return;
    try {
      const snap = await getDocs(query(collection(dbRef.current, 'rooms', roomId, 'messages'), orderBy('createdAt', 'asc')));
      const msgs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }));
      const title = roomTitle || roomId || '채팅방';
      await window.electronAPI.saveTxt(formatTranscript(title, msgs), `${sanitizeFileName(title)}.txt`);
    } catch (e) {
      setChatError(`채팅방을 다운로드하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDownloadPastRoom = async (r: PastRoom) => {
    if (!dbRef.current) return;
    try {
      const snap = await getDocs(query(collection(dbRef.current, 'rooms', r.id, 'messages'), orderBy('createdAt', 'asc')));
      const msgs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }));
      const title = r.title || r.id;
      await window.electronAPI.saveTxt(formatTranscript(title, msgs), `${sanitizeFileName(title)}.txt`);
    } catch (e) {
      setChatError(`채팅방을 다운로드하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 메시지/참여자 문서를 모두 지운 뒤 방 문서 자체를 지운다. Firestore는 한 배치(batch)에
  // 최대 500개 작업까지만 담을 수 있어, 안전하게 450개씩 나눠서 지운다.
  const deleteRoomFromFirebase = async (db: Firestore, id: string) => {
    const [messagesSnap, participantsSnap] = await Promise.all([
      getDocs(collection(db, 'rooms', id, 'messages')),
      getDocs(collection(db, 'rooms', id, 'participants')),
    ]);
    const refsToDelete = [...messagesSnap.docs, ...participantsSnap.docs].map(d => d.ref);
    for (let i = 0; i < refsToDelete.length; i += 450) {
      const batch = writeBatch(db);
      refsToDelete.slice(i, i + 450).forEach(ref => batch.delete(ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'rooms', id));
  };

  const handleDeleteFromHistory = async (id: string) => {
    const ok = window.confirm('이 채팅방을 Firebase에서 완전히 삭제하시겠습니까?\n대화 내용과 참여자 목록이 모두 삭제되며, 되돌릴 수 없습니다.');
    if (!ok) return;
    setDeletingRoomId(id);
    try {
      if (dbRef.current) await deleteRoomFromFirebase(dbRef.current, id);
      const history = await readRoomHistory();
      const nextHistory = history.filter(h => h.id !== id);
      await window.electronAPI.setConfig({ chatRoomHistory: JSON.stringify(nextHistory) });
      setPastRooms(prev => prev.filter(r => r.id !== id));
      if (expandedRoomId === id) setExpandedRoomId(null);
    } catch (e) {
      setChatError(`채팅방을 삭제하지 못했습니다: ${describeChatError(e)}`);
    } finally {
      setDeletingRoomId(null);
    }
  };

  const handleExpandRoom = async (id: string) => {
    if (expandedRoomId === id) { setExpandedRoomId(null); return; }
    if (!dbRef.current) return;
    try {
      const snap = await getDocs(query(collection(dbRef.current, 'rooms', id, 'messages'), orderBy('createdAt', 'asc')));
      setExpandedMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) })));
      setExpandedRoomId(id);
    } catch (e) {
      setChatError(`지난 채팅방을 불러오지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (loadingConfig) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[#A8A29E]">불러오는 중...</div>;
  }

  // ── 대화 창(별도 새 창) ─────────────────────────────────────────────
  // 대화 창은 설정·시작을 직접 하지 않는다. 설정 전이거나 진행 중인 방이 없으면 본 창으로 안내한다.
  if (view === 'conversation') {
    if (!firebaseConfig) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8 bg-[#FAF9F7]">
          <MessageCircle className="w-10 h-10 text-amber-400" />
          <p className="text-sm text-[#78716C] max-w-xs break-keep">먼저 에듀노트 본 창의 <b>학급도구 → 채팅방</b>에서 Firebase 연동을 설정한 뒤 채팅방을 시작해주세요.</p>
        </div>
      );
    }
    if (!roomId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8 bg-[#FAF9F7]">
          <MessageCircle className="w-10 h-10 text-amber-400" />
          <p className="text-sm text-[#78716C] max-w-xs break-keep">진행 중인 채팅방이 없습니다. 에듀노트 본 창의 <b>학급도구 → 채팅방</b>에서 채팅방을 시작하면 이 창에 대화가 나타납니다.</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col min-h-0 items-center bg-[#FAF9F7]">
        <div className="w-full max-w-2xl flex-1 flex flex-col min-h-0 p-5 gap-3">
          {chatError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 flex items-start justify-between gap-2 shrink-0">
              <span>{chatError}</span>
              <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
            </div>
          )}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-bold text-[#1C1917]">{roomTitle || `채팅방 ${roomId}`}</h2>
              {roomTitle && <p className="text-[11px] text-[#A8A29E]">{roomId}</p>}
            </div>
            <span className={`text-xs px-3 py-1.5 rounded-lg ${closed ? 'bg-[#F5F5F4] text-[#78716C]' : 'bg-emerald-50 text-emerald-600'}`}>
              {closed ? '종료됨' : '● 진행 중'}
            </span>
          </div>
          {participants.length > 0 && (
            <div className="space-y-1.5 shrink-0">
              <p className="text-xs font-bold text-[#44403C]">참여자 ({participants.length}) · 이름을 눌러 귓속말 받을 사람을 고르세요 (여러 명 선택 가능)</p>
              <div className="flex flex-wrap gap-1.5">
                {participants.map(p => {
                  const online = !!p.lastSeen && (now - p.lastSeen.toMillis()) < PRESENCE_TIMEOUT_MS;
                  const selected = whisperTargets.some(t => t.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setWhisperTargets(prev => selected ? prev.filter(t => t.id !== p.id) : [...prev, { id: p.id, nickname: p.nickname }])}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${selected ? 'bg-violet-500 text-white border-violet-500' : 'bg-white border-[#E7E5E4] text-[#44403C] hover:bg-[#FAF9F7]'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-[#D6D3D1]'}`} />
                      {p.nickname}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {pinnedMessage && (
            <div className="flex items-start justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-amber-700 mb-0.5">📌 공지 · {pinnedMessage.sender}</p>
                <p className="text-sm text-amber-900 break-words">{linkifyText(pinnedMessage.text, 'text-amber-700 underline break-all')}</p>
              </div>
              <button onClick={handleUnpinMessage} title="공지 고정 해제" className="text-amber-400 hover:text-amber-700 shrink-0">
                <PinOff className="w-4 h-4" />
              </button>
            </div>
          )}
          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto bg-white rounded-lg border border-[#EDE8E1] p-3 space-y-2">
            {messages.map(m => {
              const mine = m.sender === (teacherName || '선생님');
              const isWhisper = !!m.to && m.to.length > 0;
              const whisperNicknames = isWhisper
                ? m.to!.map(id => participants.find(p => p.id === id)?.nickname ?? '알 수 없음').join(', ')
                : null;
              return (
                <div key={m.id} className={`flex items-end gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && !isWhisper && (
                    <button onClick={() => handlePinMessage(m)} title="공지로 고정" className="text-[#D6D3D1] hover:text-amber-600 shrink-0 mb-1">
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className={`rounded-lg px-3 py-2 max-w-[85%] ${mine ? (isWhisper ? 'bg-violet-500 text-white' : 'bg-amber-500 text-white') : `border border-[#EDE8E1] ${colorForSender(m.sender)}`}`}>
                    {!mine && <p className="text-[11px] opacity-70 mb-0.5">{m.sender}</p>}
                    {whisperNicknames && <p className="text-[11px] opacity-80 mb-0.5">🔒 귓속말 → {whisperNicknames}</p>}
                    <p className="text-sm break-words">{linkifyText(m.text ?? '', mine ? 'text-white underline break-all' : 'text-amber-600 hover:underline break-all')}</p>
                  </div>
                  {mine && !isWhisper && (
                    <button onClick={() => handlePinMessage(m)} title="공지로 고정" className="text-[#D6D3D1] hover:text-amber-600 shrink-0 mb-1">
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {whisperTargets.length > 0 && (
            <div className="flex items-center justify-between text-xs bg-violet-50 border border-violet-200 text-violet-800 rounded-lg px-3 py-1.5 shrink-0">
              <span>🔒 {whisperTargets.map(t => t.nickname).join(', ')}님에게만 보이는 귓속말을 보내는 중입니다.</span>
              <button onClick={() => setWhisperTargets([])} className="hover:underline shrink-0 ml-2">취소</button>
            </div>
          )}
          <div className="flex gap-2 shrink-0">
            <input
              type="text"
              className="flex-1 border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500"
              placeholder={closed ? '채팅방이 종료되었습니다' : whisperTargets.length > 0 ? `${whisperTargets.map(t => t.nickname).join(', ')}님에게 귓속말 보내기` : '메시지를 입력하세요'}
              value={draft}
              disabled={closed}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            />
            <button onClick={handleSend} disabled={closed} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50">전송</button>
          </div>
        </div>
      </div>
    );
  }

  // ── 본 창(manage): Firebase 연동 설정 화면 ───────────────────────────
  if (!firebaseConfig || reconfiguring) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FAF9F7] p-5">
        <div className="max-w-xl mx-auto space-y-4">
          {firebaseConfig && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-3 flex items-center justify-between gap-2">
              <span>Firebase 연동을 다시 설정합니다. 변경을 원치 않으면 취소를 눌러주세요.</span>
              <button onClick={() => { setReconfiguring(false); setConfigInput(''); setTestResult(null); }} className="shrink-0 px-2 py-1 border border-amber-300 rounded-lg hover:bg-amber-100">취소</button>
            </div>
          )}
          <div className="bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-4">
            <h2 className="font-bold text-[#1C1917] mb-2 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-amber-600" />
              채팅방을 시작하려면 먼저 Firebase 연동이 필요합니다
            </h2>
            <p className="text-xs text-[#78716C] mb-3">
              학교 망분리 등으로 교사 PC와 학생 기기가 직접 통신할 수 없는 경우가 많아, 무료 Firebase(구글)를 통해 채팅을 중계합니다. 한 번만 설정하면 계속 사용할 수 있습니다.
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#44403C]">
              {CHAT_FIREBASE_GUIDE_STEPS.map((step, i) => (
                <li key={i}>
                  {step.text}
                  {step.link && (
                    <button onClick={() => window.electronAPI.openExternal(step.link!)} className="ml-1 text-amber-600 hover:underline font-medium">
                      바로가기
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <button
              onClick={() => window.electronAPI.openExternal(CHAT_SETUP_GUIDE_VIDEO_URL)}
              className="w-full mt-3 py-2 rounded-lg border border-emerald-200 bg-white text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" /> 채팅방 설정 도움받기 (영상)
            </button>
          </div>
          <div className="bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#44403C]">Firestore 보안 규칙 (그대로 복사해 붙여넣으세요)</p>
              <button onClick={handleCopyRules} className="flex items-center gap-1 text-xs px-2 py-1 border border-[#E7E5E4] rounded-lg hover:bg-[#FAF9F7] text-[#44403C]">
                <Copy className="w-3 h-3" />
                {rulesCopied ? '복사됨!' : '복사'}
              </button>
            </div>
            <pre className="bg-[#1C1917] text-[#D6D3D1] text-[11px] p-3 rounded-lg overflow-x-auto whitespace-pre">{CHAT_FIRESTORE_RULES}</pre>
          </div>
          <div className="bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-4 space-y-2">
            <label className="block text-sm font-bold text-[#44403C]">firebaseConfig 붙여넣기</label>
            <textarea
              className="w-full h-32 text-xs font-mono border border-[#E7E5E4] rounded-lg p-2 outline-none focus:border-amber-500"
              placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  projectId: "...",\n  ...\n};'}
              value={configInput}
              onChange={e => setConfigInput(e.target.value)}
            />
            {testResult && (
              <p className={`text-xs ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>{testResult.message}</p>
            )}
            <div className="flex gap-2">
              <button onClick={handleTestConnection} disabled={testing} className="px-3 py-1.5 text-sm border border-[#E7E5E4] rounded-lg hover:bg-[#FAF9F7] disabled:opacity-50">
                {testing ? '테스트 중...' : '연동 테스트'}
              </button>
              <button onClick={handleSaveConfig} className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold">저장</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 본 창(manage): 채팅방 시작 / QR·접속주소 / 지난 채팅방 ───────────
  return (
    <div className="flex-1 flex flex-col min-h-0 items-center bg-[#FAF9F7]">
      <div className="w-full max-w-2xl flex-1 flex flex-col min-h-0 p-5 gap-4">
        {chatError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 flex items-start justify-between gap-2 shrink-0">
            <span>{chatError}</span>
            <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
          </div>
        )}
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg p-3 flex items-center justify-between gap-2 shrink-0">
          <span>✓ 채팅방 설정이 완료되었습니다.</span>
          <button
            onClick={() => { setConfigInput(JSON.stringify(firebaseConfig, null, 2)); setTestResult(null); setReconfiguring(true); }}
            className="shrink-0 px-2 py-1 border border-emerald-300 rounded-lg hover:bg-emerald-100"
          >
            다시 설정하기
          </button>
        </div>
        {!roomId ? (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            <div className="bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-6 flex flex-col items-center gap-3">
              <MessageCircle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-[#78716C]">학생들이 QR코드로 입장할 채팅방을 시작합니다.</p>
              <input
                type="text"
                className="w-full max-w-xs border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-center outline-none focus:border-amber-500"
                placeholder="채팅방 제목 (예: 3교시 모둠활동)"
                maxLength={30}
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
              />
              <button onClick={startRoom} className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold">채팅방 시작</button>
              <p className="text-[11px] text-[#A8A29E] text-center break-keep">채팅방을 시작하면 대화창이 새 창으로 열립니다.</p>
              <button
                onClick={() => { setConfigInput(JSON.stringify(firebaseConfig, null, 2)); setTestResult(null); setReconfiguring(true); }}
                className="text-xs text-[#A8A29E] hover:underline"
              >
                Firebase 연동 다시 설정하기
              </button>
            </div>
            <div className="bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-4">
              <h3 className="text-sm font-bold text-[#44403C] mb-2">지난 채팅방</h3>
              {pastRooms.length === 0 ? (
                <p className="text-xs text-[#A8A29E]">아직 만든 채팅방이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {pastRooms.map(r => (
                    <div key={r.id}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleExpandRoom(r.id)} className="flex-1 flex items-center justify-between text-left text-sm px-2 py-1.5 rounded-md hover:bg-[#FAF9F7]">
                          <span className={r.title ? '' : 'font-mono'}>{r.title || r.id}</span>
                          <span className={`text-xs ${r.closed ? 'text-[#A8A29E]' : 'text-emerald-600'}`}>{r.closed ? '종료됨' : '진행 중'}</span>
                        </button>
                        <button onClick={() => handleDownloadPastRoom(r)} title="다운로드" className="p-1.5 text-[#A8A29E] hover:text-amber-600 rounded-md hover:bg-[#FAF9F7] shrink-0">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteFromHistory(r.id)} disabled={deletingRoomId === r.id} title="Firebase에서 완전히 삭제" className="p-1.5 text-[#A8A29E] hover:text-red-600 rounded-md hover:bg-[#FAF9F7] shrink-0 disabled:opacity-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {expandedRoomId === r.id && (
                        <div className="bg-[#FAF9F7] rounded-lg p-2 mt-1 space-y-1.5 max-h-48 overflow-y-auto">
                          {expandedMessages.length === 0 ? (
                            <p className="text-xs text-[#A8A29E] px-2">메시지가 없습니다.</p>
                          ) : expandedMessages.map(m => (
                            <div key={m.id} className="text-xs px-2">
                              <span className="text-[#A8A29E]">{m.sender}: </span>
                              <span>{linkifyText(m.text ?? '')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-bold text-[#1C1917]">{roomTitle || `채팅방 ${roomId}`}</h2>
                {roomTitle && <p className="text-[11px] text-[#A8A29E]">{roomId}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleDownloadActiveRoom} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-[#E7E5E4] text-[#44403C] rounded-lg hover:bg-[#FAF9F7]">
                  <Download className="w-3.5 h-3.5" />
                  다운로드
                </button>
                {!closed ? (
                  <button onClick={handleCloseRoom} className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">채팅방 종료</button>
                ) : (
                  <>
                    <span className="text-xs px-3 py-1.5 bg-[#F5F5F4] text-[#78716C] rounded-lg">종료됨</span>
                    <button onClick={handleResetRoom} className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold">새 채팅방 만들기</button>
                  </>
                )}
              </div>
            </div>
            {!closed && (
              <button
                onClick={() => window.electronAPI.openChatWindow()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                대화창 열기
              </button>
            )}
            {!closed && qrDataUrl && (
              <div className="flex flex-col items-center gap-2 py-3 border-y border-[#F5F5F4] shrink-0">
                <img src={qrDataUrl} alt="채팅방 QR 코드" className="rounded-lg shadow-md border border-[#EDE8E1] w-[clamp(160px,40vh,300px)] h-[clamp(160px,40vh,300px)]" style={{ imageRendering: 'pixelated' }} />
                <p className="text-[11px] text-[#A8A29E] break-all max-w-xs text-center">{joinUrl}</p>
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 border border-[#E7E5E4] text-[#44403C] rounded-lg hover:bg-[#FAF9F7]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {urlCopied ? '주소 복사됨!' : '접속 주소 복사'}
                </button>
              </div>
            )}
            {closed && (
              <p className="text-sm text-[#78716C] text-center py-6 shrink-0">채팅방이 종료되었습니다. 새 채팅방을 만들어 다시 시작할 수 있습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;
