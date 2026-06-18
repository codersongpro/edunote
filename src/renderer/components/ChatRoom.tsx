import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { MessageCircle, Copy } from 'lucide-react';
import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore, type Firestore, collection, doc, setDoc, updateDoc, addDoc, getDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { CHAT_FIREBASE_GUIDE_STEPS, CHAT_FIRESTORE_RULES, CHAT_STUDENT_PAGE_URL } from '../lib/chatFirebaseGuide';

interface ChatMessage {
  id: string;
  sender: string;
  text?: string;
}

interface PastRoom {
  id: string;
  closed: boolean;
}

const FIREBASE_APP_NAME = 'edunote-chat';
const ROOM_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];

function generateRoomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ROOM_ID_ALPHABET[b % ROOM_ID_ALPHABET.length]).join('');
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

const ChatRoom: React.FC = () => {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [firebaseConfig, setFirebaseConfig] = useState<Record<string, string> | null>(null);
  const [configInput, setConfigInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [rulesCopied, setRulesCopied] = useState(false);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [teacherName, setTeacherName] = useState('선생님');

  const [pastRooms, setPastRooms] = useState<PastRoom[]>([]);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<ChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<FirebaseApp | null>(null);
  const dbRef = useRef<Firestore | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ensureFirebase = (config: Record<string, string>) => {
    if (!appRef.current) {
      appRef.current = getApps().find(a => a.name === FIREBASE_APP_NAME) ?? initializeApp(config, FIREBASE_APP_NAME);
      dbRef.current = getFirestore(appRef.current);
    }
    return { db: dbRef.current! };
  };

  const buildJoinUrl = (id: string, config: Record<string, string>) => {
    const cfgBase64 = btoa(JSON.stringify(config));
    return `${CHAT_STUDENT_PAGE_URL}#room=${id}&cfg=${encodeURIComponent(cfgBase64)}`;
  };

  const subscribeToRoom = (id: string, db: Firestore) => {
    const unsubRoom = onSnapshot(doc(db, 'rooms', id), snap => {
      setClosed(!!snap.data()?.closed);
    });
    const unsubMessages = onSnapshot(
      query(collection(db, 'rooms', id, 'messages'), orderBy('createdAt', 'asc')),
      snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) })));
      },
    );
    return () => { unsubRoom(); unsubMessages(); };
  };

  const loadPastRooms = async (db: Firestore) => {
    const snap = await getDocs(query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(20)));
    setPastRooms(snap.docs.map(d => ({ id: d.id, closed: !!d.data().closed })));
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
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { db } = ensureFirebase(firebaseConfig);
        const activeId = await window.electronAPI.getConfig('chatActiveRoomId') as string | undefined;
        if (activeId) {
          const snap = await getDoc(doc(db, 'rooms', activeId));
          if (snap.exists() && !snap.data()?.closed) {
            setRoomId(activeId);
            setClosed(false);
            setJoinUrl(buildJoinUrl(activeId, firebaseConfig));
            unsub = subscribeToRoom(activeId, db);
            unsubscribeRef.current = unsub;
            await window.electronAPI.notifyChatActive(true);
          } else {
            await window.electronAPI.setConfig({ chatActiveRoomId: '' });
          }
        }
        await loadPastRooms(db);
        setChatError(null);
      } catch (e) {
        setChatError(`Firebase 연결에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoadingConfig(false);
      }
    })();
    return () => { unsub?.(); };
  }, [firebaseConfig]);

  // QR 이미지 생성 (기존 QRMaker와 동일한 옵션)
  useEffect(() => {
    if (!joinUrl) { setQrDataUrl(null); return; }
    QRCode.toDataURL(joinUrl, { width: 300, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#1a1a1a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [joinUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 창이 닫히기 전, 켜져 있던 채팅방을 종료 상태로 기록한다
  useEffect(() => {
    const unsubscribe = window.electronAPI.onBeforeChatClose(() => {
      (async () => {
        try {
          if (roomId && dbRef.current && !closed) {
            await updateDoc(doc(dbRef.current, 'rooms', roomId), { closed: true });
          }
        } finally {
          window.electronAPI.ackChatClose();
        }
      })();
    });
    return unsubscribe;
  }, [roomId, closed]);

  const handleCopyRules = async () => {
    await navigator.clipboard.writeText(CHAT_FIRESTORE_RULES);
    setRulesCopied(true);
    setTimeout(() => setRulesCopied(false), 2000);
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
      await getDocs(query(collection(db, 'rooms'), limit(1)));
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
    await window.electronAPI.setConfig({ chatFirebaseConfig: JSON.stringify(parsed) });
    setTestResult(null);
    setFirebaseConfig(parsed);
  };

  const startRoom = async () => {
    if (!firebaseConfig) return;
    setChatError(null);
    try {
      const { db } = ensureFirebase(firebaseConfig);
      const id = generateRoomId();
      await setDoc(doc(db, 'rooms', id), { createdAt: serverTimestamp(), closed: false });
      await window.electronAPI.setConfig({ chatActiveRoomId: id });
      setRoomId(id);
      setClosed(false);
      setMessages([]);
      setJoinUrl(buildJoinUrl(id, firebaseConfig));
      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeToRoom(id, db);
      await window.electronAPI.notifyChatActive(true);
      await loadPastRooms(db);
    } catch (e) {
      setChatError(`채팅방을 시작하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleCloseRoom = async () => {
    if (!roomId || !dbRef.current) return;
    try {
      await updateDoc(doc(dbRef.current, 'rooms', roomId), { closed: true });
      await window.electronAPI.setConfig({ chatActiveRoomId: '' });
      await window.electronAPI.notifyChatActive(false);
      await loadPastRooms(dbRef.current);
    } catch (e) {
      setChatError(`채팅방을 종료하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !roomId || !dbRef.current || closed) return;
    setDraft('');
    try {
      await addDoc(collection(dbRef.current, 'rooms', roomId, 'messages'), {
        sender: teacherName || '선생님',
        text,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      setChatError(`메시지를 보내지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
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

  if (!firebaseConfig) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FAF9F7] p-5">
        <div className="max-w-xl mx-auto space-y-4">
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

  return (
    <div data-tour="class-tools-chat" className="flex-1 overflow-y-auto bg-[#FAF9F7] p-5">
      <div className="max-w-2xl mx-auto space-y-4">
        {chatError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 flex items-start justify-between gap-2">
            <span>{chatError}</span>
            <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
          </div>
        )}
        {!roomId ? (
          <div className="bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-6 flex flex-col items-center gap-3">
            <MessageCircle className="w-10 h-10 text-amber-500" />
            <p className="text-sm text-[#78716C]">학생들이 QR코드로 입장할 채팅방을 시작합니다.</p>
            <button onClick={startRoom} className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold">채팅방 시작</button>
            <button onClick={() => setFirebaseConfig(null)} className="text-xs text-[#A8A29E] hover:underline">Firebase 연동 다시 설정하기</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1C1917]">채팅방 {roomId}</h2>
              {!closed ? (
                <button onClick={handleCloseRoom} className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">채팅방 종료</button>
              ) : (
                <span className="text-xs px-3 py-1.5 bg-[#F5F5F4] text-[#78716C] rounded-lg">종료됨</span>
              )}
            </div>
            {!closed && qrDataUrl && (
              <div className="flex flex-col items-center gap-2 py-3 border-y border-[#F5F5F4]">
                <img src={qrDataUrl} alt="채팅방 QR 코드" className="rounded-lg shadow-md border border-[#EDE8E1]" style={{ imageRendering: 'pixelated' }} />
                <p className="text-[11px] text-[#A8A29E] break-all max-w-xs text-center">{joinUrl}</p>
              </div>
            )}
            <div className="h-64 overflow-y-auto bg-[#FAF9F7] rounded-lg p-3 space-y-2">
              {messages.map(m => (
                <div key={m.id} className="bg-white border border-[#EDE8E1] rounded-lg px-3 py-2 max-w-[85%]">
                  <p className="text-[11px] text-[#A8A29E] mb-0.5">{m.sender}</p>
                  <p className="text-sm text-[#1C1917] break-words">{m.text}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500"
                placeholder={closed ? '채팅방이 종료되었습니다' : '메시지를 입력하세요'}
                value={draft}
                disabled={closed}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              />
              <button onClick={handleSend} disabled={closed} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50">전송</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#EDE8E1] shadow-sm p-4">
          <h3 className="text-sm font-bold text-[#44403C] mb-2">지난 채팅방</h3>
          {pastRooms.length === 0 ? (
            <p className="text-xs text-[#A8A29E]">아직 만든 채팅방이 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {pastRooms.map(r => (
                <div key={r.id}>
                  <button onClick={() => handleExpandRoom(r.id)} className="w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded-md hover:bg-[#FAF9F7]">
                    <span className="font-mono">{r.id}</span>
                    <span className={`text-xs ${r.closed ? 'text-[#A8A29E]' : 'text-emerald-600'}`}>{r.closed ? '종료됨' : '진행 중'}</span>
                  </button>
                  {expandedRoomId === r.id && (
                    <div className="bg-[#FAF9F7] rounded-lg p-2 mt-1 space-y-1.5 max-h-48 overflow-y-auto">
                      {expandedMessages.length === 0 ? (
                        <p className="text-xs text-[#A8A29E] px-2">메시지가 없습니다.</p>
                      ) : expandedMessages.map(m => (
                        <div key={m.id} className="text-xs px-2">
                          <span className="text-[#A8A29E]">{m.sender}: </span>
                          <span>{m.text}</span>
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
    </div>
  );
};

export default ChatRoom;
