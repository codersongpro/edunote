import React, { useState, useEffect } from 'react';
import QRMaker from './QRMaker';
import LuckyDraw from './LuckyDraw';
import ChatRoom from './ChatRoom';
import { HelpCircle, QrCode, MessageCircle } from 'lucide-react';
import { useTour } from '../TourContext';

type Tab = 'qr' | 'lucky' | 'chat';

interface Props {
  initialTab?: Tab;
}

const ClassToolsPanel: React.FC<Props> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'qr');
  const { startTour } = useTour();

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex flex-col h-full">
      <div data-tour="class-tools-tabs" className="h-14 flex items-center border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] shrink-0">
        <button
          data-tour="class-tools-qr"
          onClick={() => setActiveTab('qr')}
          className={`h-full flex items-center gap-1.5 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'qr'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
              : 'border-transparent text-[#78716C] dark:text-[#9C8F87] hover:text-[#44403C] dark:hover:text-[#C4B8B0] hover:border-[#E7E5E4]'
          }`}
        >
          <QrCode className="w-4 h-4" />
          QR 메이커
        </button>
        <button
          data-tour="class-tools-lucky"
          onClick={() => setActiveTab('lucky')}
          className={`h-full flex items-center gap-1.5 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'lucky'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
              : 'border-transparent text-[#78716C] dark:text-[#9C8F87] hover:text-[#44403C] dark:hover:text-[#C4B8B0] hover:border-[#E7E5E4]'
          }`}
        >
          <span className="text-sm">🎲</span>
          럭키드로우
        </button>
        <button
          data-tour="class-tools-chat"
          onClick={() => setActiveTab('chat')}
          className={`h-full flex items-center gap-1.5 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'chat'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
              : 'border-transparent text-[#78716C] dark:text-[#9C8F87] hover:text-[#44403C] dark:hover:text-[#C4B8B0] hover:border-[#E7E5E4]'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          채팅방
        </button>
        <button
          onClick={() => startTour('class-tools')}
          className="ml-auto mr-3 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          튜토리얼
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === 'qr' ? 'h-full' : 'hidden'}>
          <QRMaker />
        </div>
        <div className={activeTab === 'lucky' ? 'h-full' : 'hidden'}>
          <LuckyDraw />
        </div>
        <div className={activeTab === 'chat' ? 'h-full flex flex-col' : 'hidden'}>
          <ChatRoom />
        </div>
      </div>
    </div>
  );
};

export default ClassToolsPanel;
