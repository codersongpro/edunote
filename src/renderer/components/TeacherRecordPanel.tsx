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
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
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
