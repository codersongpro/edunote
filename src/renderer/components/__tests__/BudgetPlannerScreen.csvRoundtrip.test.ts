import { describe, expect, it } from 'vitest';
import { readBudgetItemsFromCsv } from '../BudgetPlannerScreen';

describe('예산 CSV 실제 지출 복원', () => {
  it('1.27 CSV의 계획액과 여러 실제 지출 및 배정 예산을 복원한다', () => {
    const csv = [
      '순,예산 과목,품목,단가(원),수량,계획액(원),지급일,실제 지출액(원),지출 메모,품목 잔액(원)',
      '1,교육운영비,교구,100000,2,200000,2026-09-01 / 2026-09-03,120000 / 50000,1차 / 2차,30000',
      ',,배정 예산,,,200000,,,,',
    ].join('\n');
    const result = readBudgetItemsFromCsv(csv);
    const item = result.items.find(row => row.thngNm === '교구');
    expect(result.totalBudget).toBe(200000);
    expect(item?.subtotal).toBe(200000);
    expect(item?.actualExpenses).toMatchObject([
      { paidAt: '2026-09-01', amount: 120000, memo: '1차' },
      { paidAt: '2026-09-03', amount: 50000, memo: '2차' },
    ]);
  });
});
