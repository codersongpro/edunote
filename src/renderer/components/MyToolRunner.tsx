import React, { useState } from 'react';
import { CustomTool, FileData } from '../types';
import { FileUpload } from './FileUpload';
import { GeneratedDisplay } from './GeneratedDisplay';
import { runCustomTool } from '../services/geminiService';
import { ChevronLeft, Zap, AlertTriangle, Pencil } from 'lucide-react';
import { useGlobalState } from '../GlobalStateContext';

interface MyToolRunnerProps {
  tool: CustomTool;
  onBack: () => void;
  onEdit?: () => void;
}

const MyToolRunner: React.FC<MyToolRunnerProps> = ({ tool, onBack, onEdit }) => {
  const { apiKeyAvailability } = useGlobalState();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, FileData[]>>({});
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setIsLoading(true);
    setError('');
    setProgress(null);
    try {
      const output = await runCustomTool(
        tool,
        fieldValues,
        fileValues,
        (current, total) => setProgress({ current, total }),
      );
      setResult(output);
    } catch (e: any) {
      setError(e?.message || '생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const categoryLabel: Record<string, string> = {
    admin: '학급 행정',
    lesson: '수업 자료',
    student: '학생 관리',
    other: '기타',
  };

  const categoryColor: Record<string, string> = {
    admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    lesson: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    student: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* 좌측 폼 패널 */}
      <div className="w-[360px] shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              내 도구 목록으로
            </button>
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                수정
              </button>
            )}
          </div>
          <div className="flex items-start gap-2">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{tool.name}</h2>
              {tool.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{tool.description}</p>
              )}
              <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColor[tool.category]}`}>
                {categoryLabel[tool.category]}
              </span>
            </div>
          </div>
        </div>

        {apiKeyAvailability !== 'usable' && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                {apiKeyAvailability === 'wait' ? 'API가 일시적으로 제한되었습니다' : 'API 키가 활성화되지 않았습니다'}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                {apiKeyAvailability === 'wait'
                  ? '잠시 후 다시 시도하거나 설정에서 API 키를 변경해 주세요.'
                  : 'Gemini API 키를 설정해야 생성 기능을 사용할 수 있습니다.'}
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('edunote-goto-settings'))}
                className="mt-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
              >
                설정 바로가기 →
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 p-4 space-y-4">
          {tool.inputs.map(input => (
            <div key={input.id}>
              {input.type !== 'file-upload' && (
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  {input.label}
                  {input.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              )}
              {input.type === 'file-upload' ? (
                <FileUpload
                  label={input.label}
                  files={fileValues[input.id] ?? []}
                  onFilesChange={files => setFileValues(prev => ({ ...prev, [input.id]: files }))}
                  multiple={true}
                />
              ) : input.type === 'textarea' ? (
                <textarea
                  value={fieldValues[input.id] ?? ''}
                  onChange={e => setFieldValues(prev => ({ ...prev, [input.id]: e.target.value }))}
                  placeholder={input.placeholder}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={fieldValues[input.id] ?? ''}
                  onChange={e => setFieldValues(prev => ({ ...prev, [input.id]: e.target.value }))}
                  placeholder={input.placeholder}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>
          )}
          {progress && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 font-medium">
              처리 중 {progress.current} / {progress.total}...
            </p>
          )}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 dark:disabled:bg-amber-800 text-white font-bold rounded-lg text-sm transition-colors"
          >
            <Zap className="w-4 h-4" />
            {isLoading ? (progress ? `처리 중 ${progress.current}/${progress.total}` : 'AI 생성 중...') : '생성'}
          </button>
        </div>
      </div>

      {/* 우측 결과 패널 */}
      <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950">
        {result ? (
          <div className="flex-1 overflow-hidden p-4">
            <GeneratedDisplay content={result} title={tool.name} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">왼쪽에서 정보를 입력하고 생성을 눌러주세요</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">파일을 여러 개 올리면 순서대로 처리됩니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyToolRunner;
