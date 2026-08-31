import { describe, expect, it } from 'vitest';
import { buildNaraDisplayName, formatItemNameWithIdNo, pickNaraIdNo } from '../budgetItemName';
import { toNaraImageUrl } from '../naraImage';

// 나라장터 종합쇼핑몰 품목정보 서비스가 실제로 돌려준 항목의 모양을 그대로 고정한다.
// 항목 이름을 문서로 확인할 수 없어 앱의 `테스트 조회`로 알아낸 것이므로,
// 나중에 매핑을 바꿀 때 이 응답에서 식별번호·사진을 계속 읽어내는지 여기서 확인한다.
// 값은 조회로 확인한 실제 응답(복사용지)의 숫자 항목을 그대로 옮겼다.
const REAL_ROW = {
  prdctImgUrl: 'https://shopping.g2b.go.kr/img/prdct/20698349.jpg',
  cntrctCorpNm: '가나문구',
  entrprsDivNm: '중소기업',
  cntrctMthdNm: '제3자단가',
  exclncPrcrmntPrdctYn: 'N',
  masYn: 'Y',
  smetprCmptProdctYn: 'Y',
  cntrctPrceAmt: 4500,
  prdctUnit: '박스',
  prdctMakrNm: '가나제지',
  prdctDlvrPlceNm: '전국',
  prdctDlvryCndtnNm: '현장설치도',
  prdctSplyRgnNm: '전지역',
  dlvrTmlmtDaynum: '30',
  prdctLrgclsfcCd: '14',
  prdctLrgclsfcNm: '종이류',
  prdctMidclsfcCd: '1411',
  prdctMidclsfcNm: '종이',
  prdctClsfcNo: '14111507',
  prdctClsfcNoNm: '복사용지',
  dtilPrdctClsfcNo: '1411150701',
  dtilPrdctClsfcNoNm: '백상지복사용지',
  prdctIdntNo: '20698349',
  prdctSpecNm: 'A4 80g/㎡',
  shopngCntrctNo: '00000000',
  shopngCntrctSno: '1',
  cntrctDate: '20260115',
  cntrctBgnDate: '20260115',
  cntrctEndDate: '20261231',
  cntrctDeptNm: '조달청',
  prodctCertList: '',
  rgstDt: '20260115',
  cntrctCorpBizno: '3148200583',
};

describe('실제 나라장터 응답에서 값 읽기', () => {
  it('물품식별번호를 prdctIdntNo에서 읽는다', () => {
    expect(pickNaraIdNo(REAL_ROW)).toBe('20698349');
  });

  it('분류번호를 식별번호로 잘못 읽지 않는다', () => {
    // prdctClsfcNo(14111507)도 8자리 숫자라, 항목 이름을 보지 않고 자릿수만으로
    // 고르면 품명번호가 식별번호 자리에 들어간다.
    expect(pickNaraIdNo(REAL_ROW)).not.toBe(REAL_ROW.prdctClsfcNo);
    expect(pickNaraIdNo(REAL_ROW)).not.toBe(REAL_ROW.dtilPrdctClsfcNo);
  });

  it('날짜 항목을 식별번호로 잘못 읽지 않는다', () => {
    // cntrctDate·cntrctBgnDate·cntrctEndDate·rgstDt는 모두 8자리 숫자다.
    expect(pickNaraIdNo(REAL_ROW)).not.toBe(REAL_ROW.cntrctEndDate);
  });

  it('식별번호가 빠진 응답에서는 다른 숫자를 끌어오지 않는다', () => {
    const { prdctIdntNo, ...withoutIdNo } = REAL_ROW;
    expect(prdctIdntNo).toBe('20698349');
    expect(pickNaraIdNo(withoutIdNo)).toBe('');
  });

  it('상품 사진 주소를 prdctImgUrl에서 읽는다', () => {
    expect(toNaraImageUrl(REAL_ROW.prdctImgUrl)).toBe('https://shopping.g2b.go.kr/img/prdct/20698349.jpg');
  });

  it('예산안 품목명을 물품명(식별번호)로 만든다', () => {
    expect(formatItemNameWithIdNo(REAL_ROW.prdctClsfcNoNm, pickNaraIdNo(REAL_ROW)))
      .toBe('복사용지(20698349)');
  });
});

describe('검색 목록과 예산안의 이름 분리', () => {
  it('검색 목록에는 세부품명과 규격을 합친 이름을 보여준다', () => {
    expect(buildNaraDisplayName(REAL_ROW)).toBe('백상지복사용지 A4 80g/㎡');
  });

  it('예산안에는 자세한 이름이 아니라 품명(식별번호)이 들어간다', () => {
    // 예산안 품목명은 품의·계약 문서에 그대로 쓰이므로 짧게 유지한다.
    expect(formatItemNameWithIdNo(REAL_ROW.prdctClsfcNoNm, pickNaraIdNo(REAL_ROW)))
      .toBe('복사용지(20698349)');
  });
});
