import React, { useRef } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { FileData } from '../types';

interface FileUploadProps {
  label: string;
  files: FileData[];
  onFilesChange: (files: FileData[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  globalPaste?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  files,
  onFilesChange,
  accept = ".pdf,.jpg,.jpeg,.png,.txt,.md,.hwp,.hwpx",
  multiple = false,
  maxFiles,
  globalPaste = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const handleFileArrayRef = React.useRef<(fileArr: File[]) => Promise<void>>();

  const handleFileArray = async (fileArray: File[]) => {
    if (fileArray.length > 0) {
      const currentCount = multiple ? files.length : 0;
      const remaining = maxFiles ? Math.max(0, maxFiles - currentCount) : fileArray.length;
      if (remaining === 0) {
        alert(`최대 ${maxFiles}개까지 업로드할 수 있습니다.`);
        return;
      }
      const limited = fileArray.slice(0, remaining);
      if (limited.length < fileArray.length) {
        alert(`최대 ${maxFiles}개까지 업로드할 수 있습니다. ${limited.length}개만 추가됩니다.`);
      }
      fileArray = limited;
      const newFiles: FileData[] = [];
      
      for (const file of fileArray) {
        
        const isHwp = file.name.toLowerCase().endsWith('.hwp') && !file.name.toLowerCase().endsWith('.hwpx');
        const isHwpx = file.name.toLowerCase().endsWith('.hwpx');
        
        let base64 = "";
        let mimeType = file.type;

        if (isHwp || isHwpx) {
          try {
            const { extractTextFromHwpx } = await import('../lib/hwpx-parser');
            // If it's pure HWP, extractTextFromHwpx will gracefully catch JSZip error and return the fallback message instead of throwing!
            const extractedText = await extractTextFromHwpx(file);
            const textFile = new File([extractedText], file.name + ".txt", { type: "text/plain" });
            base64 = await convertToBase64(textFile);
            mimeType = 'text/plain';
          } catch (hwpxError: any) {
            console.error("HWPX/HWP Fallback:", hwpxError);
            const textFile = new File(["[문서 내용을 읽을 수 없습니다 - 손상되거나 지원되지 않는 형식]"], file.name + ".txt", { type: "text/plain" });
            base64 = await convertToBase64(textFile);
            mimeType = 'text/plain';
          }
        } else {
          base64 = await convertToBase64(file);
          // Gemini API는 text/markdown을 지원하지 않으므로 text/plain으로 정규화
          if (file.name.toLowerCase().endsWith('.md') || mimeType === 'text/markdown') {
            mimeType = 'text/plain';
          }
        }

        newFiles.push({
          file,
          base64,
          mimeType
        });
      }

      if (newFiles.length > 0) {
        onFilesChange(multiple ? [...files, ...newFiles] : newFiles);
      }
      
      // Reset input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  handleFileArrayRef.current = handleFileArray;

  React.useEffect(() => {
    if (!globalPaste) return;
    const onDocPaste = async (e: ClipboardEvent) => {
      const imgs: File[] = [];
      Array.from(e.clipboardData?.items ?? []).forEach((item, i) => {
        if (!item.type.startsWith('image/')) return;
        const f = item.getAsFile();
        if (!f) return;
        const ext = item.type.includes('jpeg') ? 'jpg' : 'png';
        imgs.push(new File([f], `clipboard-screenshot-${Date.now()}-${i}.${ext}`, { type: item.type }));
      });
      if (imgs.length > 0) {
        e.preventDefault();
        await handleFileArrayRef.current?.(imgs);
      }
    };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, [globalPaste]);

  const handleFiles = async (fileList: FileList) => {
    await handleFileArray(Array.from(fileList));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedImages: File[] = [];
    Array.from(e.clipboardData.items).forEach((item, index) => {
      if (!item.type.startsWith('image/')) return;
      const imageFile = item.getAsFile();
      if (!imageFile) return;
      const ext = item.type.includes('jpeg') ? 'jpg' : 'png';
      pastedImages.push(new File([imageFile], `clipboard-screenshot-${Date.now()}-${index}.${ext}`, { type: item.type }));
    });

    if (pastedImages.length > 0) {
      e.preventDefault();
      await handleFileArray(pastedImages);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">{label}</label>
      
      <div className="flex flex-col gap-3">
        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
          className={`group border rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40" : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 hover:border-blue-500"}`}
        >
          <div className="bg-white dark:bg-gray-800 p-2 rounded-full border border-gray-200 dark:border-gray-700 group-hover:border-blue-200 dark:group-hover:border-blue-700 group-hover:bg-blue-50 dark:group-hover:bg-blue-950 mb-2 transition-colors">
             <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-300" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-300">
            파일 업로드
          </p>
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            드래그 가능 · Ctrl+V 스크린샷 붙여넣기 · 지원: {accept.replace(/\./g, '').toUpperCase().replace(/,/g, ' / ')}
            {multiple && maxFiles && ` · 최대 ${maxFiles}개`}
          </span>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange} 
          accept={accept}
          multiple={multiple}
        />

        {files.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {multiple && (
              <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
                {files.length}개 선택됨{maxFiles ? ` / 최대 ${maxFiles}개` : ''}
              </p>
            )}
            {files.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-900 p-2.5 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-950 p-1 rounded">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate font-medium">{f.file.name}</span>
                </div>
                <button 
                  onClick={() => removeFile(idx)}
                  className="text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-1 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
