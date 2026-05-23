import Store from 'electron-store';

interface StoreSchema {
  geminiApiKey: string;
  saveDir: string;
  alwaysAskPath: boolean;
  teacherName: string;
  schoolName: string;
  schoolLevel: string;
  darkMode: boolean;
}

export const store = new Store<StoreSchema>({
  defaults: {
    geminiApiKey: '',
    saveDir: '',
    alwaysAskPath: true,
    teacherName: '',
    schoolName: '',
    schoolLevel: '고등학교',
    darkMode: false,
  },
});
