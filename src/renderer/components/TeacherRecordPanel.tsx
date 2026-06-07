import React, { useState, useEffect } from 'react';
import LessonObservationGenerator from './LessonObservationGenerator';
import CounselingLogGenerator from './CounselingLogGenerator';
import ClassManagementLogGenerator from './ClassManagementLogGenerator';
import { Eye, MessageCircle, CalendarDays } from 'lucide-react';

type Tab = 'observation' | 'counseling' | 'class';

const tabs = [
  { key: 'observation' as Tab, label: '수업관찰기록', icon: Eye },
  { key: 'counseling' as Tab, label: '상담일지', icon: MessageCircle },
  { key: 'class' as Tab, label: '학급경영일지', icon: CalendarDays },
];

interface Props {
  initialTab?: Tab;
}

const TeacherRecordPanel: React.FC<Props> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'observation');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-[#EDE8E1] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-transparent text-[#78716C] dark:text-[#9C8F87] hover:text-[#44403C] dark:hover:text-[#C4B8B0] hover:border-[#E7E5E4]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === 'observation' ? 'h-full' : 'hidden'}>
          <LessonObservationGenerator />
        </div>
        <div className={activeTab === 'counseling' ? 'h-full' : 'hidden'}>
          <CounselingLogGenerator />
        </div>
        <div className={activeTab === 'class' ? 'h-full' : 'hidden'}>
          <ClassManagementLogGenerator />
        </div>
      </div>
    </div>
  );
};

export default TeacherRecordPanel;
