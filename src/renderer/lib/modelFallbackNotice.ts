import type { ModelFallbackNoticePayload } from '../../preload/types';
import type { ToastPayload } from './toast';

export function buildModelFallbackNotice(payload: ModelFallbackNoticePayload): ToastPayload | null {
  const quotaModels = payload.fallbacks
    .filter(item => item.reason === 'quota')
    .map(item => item.fromModel);
  if (quotaModels.length === 0) return null;
  return {
    type: 'info',
    title: '사용량 제한으로 모델을 전환했습니다.',
    description: `${quotaModels.join(', ')}의 사용량 제한을 감지해 ${payload.usedModel}에서 결과를 처음부터 다시 완성했습니다.`,
  };
}
