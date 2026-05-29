import React, { useState, useEffect } from 'react';
import QRMaker from './QRMaker';
import LuckyDraw from './LuckyDraw';
import { QrCode } from 'lucide-react';

type Tab = 'qr' | 'lucky';

interface Props {
  initialTab?: Tab;
}

const ClassToolsPanel: React.FC<Props> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'qr');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <button
          onClick={() => setActiveTab('qr')}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'qr'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
          }`}
        >
          <QrCode className="w-4 h-4" />
          QR 메이커
        </button>
        <button
          onClick={() => setActiveTab('lucky')}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'lucky'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-sm">🎲</span>
          오늘의 주인공
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === 'qr' ? 'h-full' : 'hidden'}>
          <QRMaker />
        </div>
        <div className={activeTab === 'lucky' ? 'h-full' : 'hidden'}>
          <LuckyDraw />
        </div>
      </div>
    </div>
  );
};

export default ClassToolsPanel;
