import React from 'react';
import LessonObservationGenerator from './LessonObservationGenerator';
import CounselingLogGenerator from './CounselingLogGenerator';
import ClassManagementLogGenerator from './ClassManagementLogGenerator';

type Tab = 'observation' | 'counseling' | 'class';

interface Props {
  initialTab?: Tab;
}

const TeacherRecordPanel: React.FC<Props> = ({ initialTab }) => {
  const activeTab = initialTab ?? 'observation';

  return (
    <div className="flex flex-col h-full">
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
