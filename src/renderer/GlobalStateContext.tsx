import React, { createContext, useContext } from 'react';
import { GlobalState, GlobalStateContextType } from './types';

export const initialGlobalState: GlobalState = {
  guidelineQA: { messages: [] },
  recordChatbot: { messages: [] },
  opinion: {
    step: 'SETUP',
    studentCount: 1,
    nameInput: '',
    students: [{ id: '1', name: '학생 1', positiveTags: [], negativeTags: [], additionalContext: '', selected: false }],
    currentStudentIndex: 0,
    lengthOption: '200',
    customLength: 200,
    lengthUnit: '자',
  },
  subject: {
    step: 'STUDENT_SETUP',
    commonStudents: [{ id: '1', name: '학생 1' }],
    studentCount: 1,
    nameInput: '',
    dataStore: {},
    currentSubject: '',
    activeTasks: [{ id: '1', task: '', level: '상' }],
    activeStudents: [{ id: '1', name: '학생 1', additionalContext: '', evaluations: [], selected: false }],
    currentStudentIndex: 0,
    isDirectInput: false,
    lengthOption: '200',
    customLength: 200,
    lengthUnit: '자',
  },
  sports: {
    step: 'SETUP',
    studentCount: 1,
    nameInput: '',
    students: [{ id: '1', name: '학생 1', additionalContext: '', selected: false }],
    sportName: '',
    clubName: '',
    currentStudentIndex: 0,
    lengthOption: '200',
    customLength: 200,
    lengthUnit: '자',
  },
  creative: {
    step: 'STUDENT_SETUP',
    studentCount: 1,
    nameInput: '',
    commonStudents: [{ id: '1', name: '학생 1' }],
    dataStore: {},
    currentActivityName: '',
    currentActivityType: '자율활동',
    currentAnnualPlan: '',
    activeStudents: [{ id: '1', name: '학생 1', selectedTags: [], additionalContext: '', selected: false }],
    currentStudentIndex: 0,
    lengthOption: '200',
    customLength: 200,
    lengthUnit: '자',
  },
};

export const GlobalStateContext = createContext<GlobalStateContextType>({
  state: initialGlobalState,
  setState: () => {},
  isGlobalGenerating: false,
  setIsGlobalGenerating: () => {},
  globalProgress: 0,
  setGlobalProgress: () => {},
  generatingModes: new Map(),
  setGeneratingMode: () => {},
});

export const useGlobalState = () => useContext(GlobalStateContext);
