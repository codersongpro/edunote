import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Copy, AlertCircle, X } from 'lucide-react';

const PRESET_SIZES = [200, 300, 400, 600];

const QRMaker: React.FC = () => {
  const [url, setUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [size, setSize] = useState(400);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = async (value: string, px: number) => {
    if (!value.trim()) { setQrDataUrl(null); setError(null); return; }
    try {
      const dataUrl = await QRCode.toDataURL(value.trim(), {
        width: px,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#1a1a1a', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setError(null);
    } catch {
      setError('QR 코드를 생성할 수 없습니다. 입력값을 확인해주세요.');
      setQrDataUrl(null);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => generate(url, size), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url, size]);

  const handleDownload = async () => {
    if (!qrDataUrl) return;
    const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    const label = url.replace(/https?:\/\//, '').replace(/[^\w가-힣]/g, '_').substring(0, 40) || 'qrcode';
    await window.electronAPI.saveBuffer(arr.buffer, `QR_${label}.png`);
  };

  const handleCopyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: copy URL text
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] overflow-y-auto">
      <div className="max-w-xl mx-auto w-full p-5 space-y-4">

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-lg">
            <QrCode className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">QR 메이커</h2>
            <p className="text-xs text-gray-500">주소를 입력하면 즉시 QR코드로 변환합니다.</p>
          </div>
        </div>

        {/* Input */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1.5">URL / 텍스트</label>
            <input
              type="text"
              className="w-full bg-white rounded-lg border border-gray-300 text-gray-800 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none p-3 pr-9 transition-all"
              placeholder="https://example.com 또는 공유할 텍스트를 입력하세요"
              value={url}
              onChange={e => setUrl(e.target.value)}
              autoFocus
            />
            {url && (
              <button onClick={() => setUrl('')} className="absolute right-3 top-9 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">QR 크기</label>
            <div className="flex gap-2">
              {PRESET_SIZES.map(px => (
                <button
                  key={px}
                  onClick={() => setSize(px)}
                  className={`flex-1 py-1.5 text-sm rounded-lg border transition-all font-medium ${
                    size === px
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                  }`}
                >
                  {px}px
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* QR Display */}
        {qrDataUrl ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col items-center gap-4">
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="rounded-lg shadow-md border border-gray-100"
              style={{ imageRendering: 'pixelated', maxWidth: '100%' }}
            />
            <p className="text-xs text-gray-400 text-center break-all max-w-xs">{url}</p>
            <div className="flex gap-3">
              <button
                onClick={handleCopyImage}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? '복사됨!' : '이미지 복사'}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold"
              >
                <Download className="w-4 h-4" />
                PNG 다운로드
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center gap-3">
            <QrCode className="w-14 h-14 text-gray-200" />
            <p className="text-sm text-gray-400">URL이나 텍스트를 입력하면<br />QR코드가 자동으로 생성됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRMaker;
