import Store from 'electron-store';

interface StoreSchema {
  geminiApiKey: string;
  unsplashApiKey: string;
  saveDir: string;
  alwaysAskPath: boolean;
  teacherName: string;
  schoolName: string;
  institution: string;
  schoolLevel: string;
  gradeClass: string;
  studentNames: string;
  studentMaleNames: string;
  studentFemaleNames: string;
  darkMode: boolean;
}

export const store = new Store<StoreSchema>({
  defaults: {
    geminiApiKey: '',
    unsplashApiKey: '',
    saveDir: '',
    alwaysAskPath: true,
    teacherName: '',
    schoolName: '',
    institution: '',
    schoolLevel: '고등학교',
    gradeClass: '',
    studentNames: '',
    studentMaleNames: '',
    studentFemaleNames: '',
    darkMode: false,
  },
});
