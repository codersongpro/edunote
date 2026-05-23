import React, { useState, useRef, useEffect } from 'react';
import { FileText, PenTool, ClipboardList, Wand2, AlertCircle, Layers, FileOutput, ArrowRight, Layout, MessageSquare, Calendar, AlignLeft, AlignJustify, List, CheckCircle, AlertTriangle, Receipt, Users, Megaphone, Mail, Smartphone, Monitor, Megaphone as MegaphoneIcon } from 'lucide-react';
import { DocType, GongmunInputs, PlanInputs, ReportInputs, MessageInputs, NewsletterInputs, PumuiInputs, MeetingMinutesInputs, PromotionInputs, GonggoInputs, FileData, GongmunType, MessageTarget, MessageType, MessageRelationship, GongmunComplexity, PumuiType, AppMode } from '../types';
import { generateDocument } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { GeneratedDisplay } from './GeneratedDisplay';
import { LOADING_MESSAGES } from '../constants';
import { useGenerationTracker } from '../hooks/useGenerationTracker';

// ─── Example Documents ───────────────────────────────────────────────────────

const EXAMPLE_DOCS: Partial<Record<DocType, string>> = {
  // 공문서 — 나라장터 행정표준 양식 (결재란 포함)
  [DocType.GONGMUN]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;background:#fff;padding:28px 36px;line-height:1.75}.org{font-size:15pt;font-weight:900;letter-spacing:2px;margin-bottom:4px}.approval{display:flex;border:1px solid #555;width:220px;margin-left:auto;margin-bottom:14px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555;padding:3px 0}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:10px 0 6px}.rule{border:none;border-top:2px solid #111;margin:4px 0 10px}.meta table{width:100%;border-collapse:collapse;margin-bottom:12px}.meta td{padding:4px 8px;vertical-align:top;font-size:10.5pt}.meta td.k{width:60px;font-weight:bold;white-space:nowrap}.meta td.v{border-bottom:1px solid #ddd}.body-text p{margin-bottom:8px}.body-text .indent{padding-left:18px}.attach{margin-top:14px;font-size:10pt}.sig-block{margin-top:36px;text-align:center;font-size:10.5pt;line-height:2.4}</style></head><body><div class="org">○ ○ 중 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기안</div><div class="apv-name">홍길동</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">이부장</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div><hr class="rule"><div class="meta"><table><tr><td class="k">수 신</td><td class="v">○○교육지원청 교육장</td></tr><tr><td class="k">경 유</td><td class="v">중등교육과장</td></tr><tr><td class="k">제 목</td><td class="v">2026학년도 2학년 수학여행 계획 승인 요청</td></tr></table></div><div class="body-text"><p>1. 관련: 학생생활교육과-2026-0318 「수련활동 및 수학여행 운영 지침」(2026.03.05.)</p><p>2. 위 관련에 의거하여 2026학년도 2학년 수학여행 계획을 다음과 같이 수립하였기에 승인을 요청합니다.</p><p class="indent">가. 기간: 2026. 10. 7.(수) ~ 10. 9.(금) (2박 3일)</p><p class="indent">나. 장소: 제주특별자치도 일원</p><p class="indent">다. 대상: 2학년 전체 198명(교직원 14명 포함)</p><p class="indent">라. 소요 경비: 학생 1인당 450,000원(학부모 부담)</p><p class="indent">마. 주요 일정: 한라산 탐방, 4·3평화공원, 제주 과학관 견학 등</p><div class="attach">붙 임&nbsp;&nbsp;1. 수학여행 세부 운영 계획서 1부.<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2. 학부모 사전 동의서 수합 결과 1부.&nbsp;&nbsp;끝.</div></div><div class="sig-block">○ ○ 중 학 교 장</div></body></html>`,

  // 계획서 — 결재판 + 표 구성, 현행 학교 계획서 양식
  [DocType.PLAN]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:24px 32px;line-height:1.75}.doc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.org{font-size:14pt;font-weight:900;letter-spacing:2px}.approval{display:flex;border:1px solid #555;width:200px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:8px 0 5px}hr.rule{border:none;border-top:2px solid #111;margin:6px 0 14px}h1{font-size:14pt;text-align:center;font-weight:900;margin:6px 0 16px;letter-spacing:1px}h2{font-size:11pt;font-weight:bold;margin:14px 0 5px;padding-left:6px;border-left:3px solid #1565c0;color:#1565c0}p{margin:3px 0 5px}ul{padding-left:20px;margin:3px 0}li{margin:2px 0}table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:10pt}th{background:#e3eaf5;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}.tc{text-align:center}</style></head><body><div class="doc-top"><div class="org">○ ○ 초 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기안</div><div class="apv-name">홍길동</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">이영희</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div></div><hr class="rule"><h1>2026학년도 학교폭력 예방교육 운영 계획</h1><h2>1. 목적</h2><p>학교폭력 예방 및 대처 역량을 강화하여 안전하고 평화로운 학교문화를 조성한다.</p><h2>2. 방침</h2><ul><li>교육부 「학교폭력 예방 및 대책에 관한 법률」에 근거하여 연간 교육 실시</li><li>학년별 발달 수준을 고려한 맞춤형 예방 프로그램 운영</li><li>학부모·지역사회 협력을 통한 안전망 구축</li></ul><h2>3. 세부 추진 계획</h2><table><tr><th>월</th><th>내용</th><th>대상</th><th>담당</th><th>비고</th></tr><tr><td class="tc">3월</td><td>학교폭력 예방교육(온라인)</td><td>전교생</td><td>담임</td><td>학교폭력예방앱</td></tr><tr><td class="tc">5월</td><td>어울림 프로그램 운영</td><td>전교생</td><td>상담교사</td><td>학년별</td></tr><tr><td class="tc">9월</td><td>사이버폭력 예방교육</td><td>전교생</td><td>정보담당</td><td>블렌디드</td></tr><tr><td class="tc">11월</td><td>학교폭력 실태조사 결과 공유</td><td>교직원</td><td>담당부장</td><td>협의회</td></tr></table><h2>4. 기대 효과</h2><p>학교폭력 인식 개선 및 피해 학생 보호 체계 강화로 안전한 학습환경 조성</p></body></html>`,

  // 보고서 — 현장체험 결과보고서 실제 양식
  [DocType.REPORT]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:24px 32px;line-height:1.8}.doc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.org{font-size:14pt;font-weight:900;letter-spacing:2px}.approval{display:flex;border:1px solid #555;width:200px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:8px 0 5px}hr.rule{border:none;border-top:2px solid #111;margin:6px 0 14px}h1{font-size:14pt;text-align:center;font-weight:900;margin:6px 0 16px}h2{font-size:11pt;font-weight:bold;margin:14px 0 5px;padding-left:6px;border-left:3px solid #2e7d32;color:#2e7d32}p{margin:3px 0 5px}ul{padding-left:20px;margin:3px 0}li{margin:2px 0}table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:10pt}th{background:#e8f5e9;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}.tc{text-align:center}.tag{display:inline-block;background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 7px;font-size:9pt;font-weight:bold;margin-left:4px}</style></head><body><div class="doc-top"><div class="org">○ ○ 초 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기안</div><div class="apv-name">홍길동</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">이영희</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div></div><hr class="rule"><h1>2026학년도 5학년 현장체험학습 결과 보고</h1><h2>1. 행사 개요</h2><table><tr><th width="90">항목</th><th>내용</th></tr><tr><td class="tc">일시</td><td>2026. 5. 13.(목) 08:30 ~ 17:00</td></tr><tr><td class="tc">장소</td><td>국립중앙과학관(대전) 및 엑스포 과학공원</td></tr><tr><td class="tc">참가</td><td>5학년 전체 108명, 인솔교사 9명</td></tr><tr><td class="tc">목적</td><td>과학·기술 체험을 통한 탐구력 신장 및 진로 탐색</td></tr><tr><td class="tc">예산</td><td>학생 1인당 25,000원 (학교운영비 지원)</td></tr></table><h2>2. 활동 내용</h2><ul><li>상설전시관 관람 — 자연사, 첨단과학, 미래기술 전시 체험</li><li>사이언스홀 과학 공연 관람 (11:00~11:50)</li><li>모둠별 탐구활동지 작성 및 발표 준비</li><li>엑스포 과학공원 야외 체험 학습</li></ul><h2>3. 성과 및 평가</h2><p>학생 만족도 조사 결과 평균 4.6점(5점 만점)으로 매우 높게 나타남. 과학에 대한 흥미와 진로 탐색 기회를 제공하는 데 효과적이었으며 안전사고 없이 마무리됨.</p><h2>4. 개선사항</h2><p>버스 이동 시간이 길어 귀교 시간이 지연됨 → 차년도 장소 선정 시 이동 거리 고려 필요</p></body></html>`,

  // 품의서 — 결재판 + 세출항목 표 포함한 현행 양식
  [DocType.PUMUI]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:24px 32px;line-height:1.75}.doc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.org{font-size:14pt;font-weight:900;letter-spacing:2px}.approval{display:flex;border:1px solid #555;width:240px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:8px 0 5px}hr.rule{border:none;border-top:2px solid #111;margin:6px 0 14px}h1{font-size:13pt;text-align:center;font-weight:900;margin:6px 0 14px}table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:10pt}th{background:#fff3e0;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}td.k{background:#fafafa;font-weight:bold;text-align:center;width:100px}.tc{text-align:center}.tr{text-align:right}.sum{background:#fff3e0;font-weight:bold}p{margin:5px 0}.sign{margin-top:20px;text-align:right;font-size:10pt;line-height:2}</style></head><body><div class="doc-top"><div class="org">○ ○ 초 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기안</div><div class="apv-name">홍길동</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">이영희</div></div><div class="apv-cell"><div class="apv-label">예산</div><div class="apv-name">박행정</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div></div><hr class="rule"><h1>물품 구입 품의서</h1><table><tr><td class="k">품의 제목</td><td>2026학년도 1학기 에듀테크 수업 기자재 구입 품의</td></tr><tr><td class="k">관련 근거</td><td>2026학년도 학교운영비 예산 편성 계획(교육비특별회계)</td></tr><tr><td class="k">예산 과목</td><td>학교운영비-교수학습활동비(목 210)</td></tr></table><table><tr><th class="tc" width="30">No</th><th>품명</th><th>규격</th><th class="tc" width="50">수량</th><th class="tc" width="70">단가(원)</th><th class="tc" width="80">금액(원)</th></tr><tr><td class="tc">1</td><td>태블릿 PC 보조배터리</td><td>20,000mAh</td><td class="tc">10</td><td class="tr">28,000</td><td class="tr">280,000</td></tr><tr><td class="tc">2</td><td>무선 마우스</td><td>2.4GHz</td><td class="tc">30</td><td class="tr">8,500</td><td class="tr">255,000</td></tr><tr><td class="tc">3</td><td>미러링 동글</td><td>HDMI/USB-C</td><td class="tc">5</td><td class="tr">33,000</td><td class="tr">165,000</td></tr><tr><td class="tc sum" colspan="5">합 계</td><td class="tr sum">700,000</td></tr></table><p>위와 같이 물품 구입을 품의하오니 결재하여 주시기 바랍니다.</p><div class="sign">2026년 3월 18일<br>기안: 5학년부장 홍 길 동</div></body></html>`,

  // 회의록 — 학교협의회 실제 양식
  [DocType.MEETING_MINUTES]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:24px 32px;line-height:1.8}.doc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.org{font-size:14pt;font-weight:900;letter-spacing:2px}.approval{display:flex;border:1px solid #555;width:200px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:8px 0 5px}hr.rule{border:none;border-top:2px solid #111;margin:6px 0 14px}h1{font-size:13pt;text-align:center;font-weight:900;margin:6px 0 14px}table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:10pt}th{background:#f3e5f5;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}td.k{background:#fafafa;font-weight:bold;text-align:center;width:80px}h2{font-size:11pt;font-weight:bold;margin:14px 0 5px;color:#6a1b9a;border-left:3px solid #6a1b9a;padding-left:6px}ul{padding-left:20px;margin:3px 0}li{margin:3px 0}.result{color:#1565c0;font-weight:bold}.sign{text-align:right;margin-top:18px;font-size:10pt;line-height:2}</style></head><body><div class="doc-top"><div class="org">○ ○ 초 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기록</div><div class="apv-name">이영희</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">박부장</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div></div><hr class="rule"><h1>2026학년도 제1차 교육과정위원회 회의록</h1><table><tr><td class="k">일시</td><td>2026. 3. 6.(금) 16:00 ~ 17:30</td><td class="k">장소</td><td>교장실</td></tr><tr><td class="k">참석자</td><td colspan="3">교장, 교감, 교육과정부장, 학년부장 6명, 전담부장 2명 (총 10명)</td></tr><tr><td class="k">불참자</td><td colspan="3">없음</td></tr></table><h2>1. 안건 및 심의결과</h2><ul><li>[안건 1] 2026학년도 학교 교육과정 편성안 심의<br><span class="result">→ 원안 가결</span> (2022 개정 교육과정 전면 적용, 학교자율시간 확보)</li><li>[안건 2] AI·디지털 역량 교육 교육과정 반영안<br><span class="result">→ 수정 가결</span> (학년군별 배당 시수 조정 후 확정)</li></ul><h2>2. 토의 사항</h2><ul><li>학교자율시간 주제: '우리 지역 탐구 프로젝트' 로 결정, 3·4학년 적용</li><li>교과서 외 AI 보조교재 활용 방안: 다음 위원회에서 구체화하기로 함</li></ul><h2>3. 기타 전달</h2><ul><li>교육과정 설명회(학부모 대상) 3.19. 예정 — 담당 교사 1명 지정 요청</li></ul><div class="sign">기록자: 교육과정부장 이 영 희</div></body></html>`,

  // 홍보자료 — 학교 SNS/알리미 스타일
  [DocType.PROMOTION]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;background:#f0f4ff;padding:20px}.card{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.10)}.banner{background:linear-gradient(135deg,#1565c0 0%,#1e88e5 60%,#42a5f5 100%);padding:28px 24px 22px;color:#fff;position:relative}.banner .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);border-radius:20px;font-size:9pt;padding:2px 12px;margin-bottom:10px}.banner h1{font-size:17pt;font-weight:900;line-height:1.3;margin-bottom:6px}.banner p{font-size:10pt;opacity:.9}.body{padding:18px 20px 14px}.deadline{background:#fff8e1;border:1.5px solid #ffca28;border-radius:10px;padding:10px 16px;text-align:center;font-size:10.5pt;font-weight:bold;color:#e65100;margin-bottom:16px}.section{margin-bottom:14px}.section-title{font-size:10pt;font-weight:bold;color:#1565c0;margin-bottom:7px;display:flex;align-items:center;gap:5px}.section-title::before{content:'';display:block;width:3px;height:13px;background:#1565c0;border-radius:2px}.item{display:flex;align-items:flex-start;gap:8px;padding:5px 0;font-size:10pt;border-bottom:1px solid #f0f0f0}.item:last-child{border-bottom:none}.dot{width:6px;height:6px;border-radius:50%;background:#1e88e5;margin-top:5px;flex-shrink:0}.footer{background:#f5f7ff;padding:10px 20px;text-align:center;font-size:9pt;color:#888;border-top:1px solid #e8eaf6}</style></head><body><div class="card"><div class="banner"><div class="badge">2026학년도 모집 안내</div><h1>방과후학교<br>수강생 모집</h1><p>○○초등학교</p></div><div class="body"><div class="deadline">📅 접수: 3. 3.(월) ~ 3. 7.(금) 마감 · 선착순</div><div class="section"><div class="section-title">개설 프로그램</div><div class="item"><div class="dot"></div><div><b>AI 코딩</b> — 화·목 15:00~16:00 (3~6학년)</div></div><div class="item"><div class="dot"></div><div><b>창의 수학</b> — 월·수 15:00~16:00 (3~5학년)</div></div><div class="item"><div class="dot"></div><div><b>영어 회화</b> — 화·목 15:00~16:00 (4~6학년)</div></div><div class="item"><div class="dot"></div><div><b>미술 공예</b> — 금 14:00~16:00 (1~4학년)</div></div></div><div class="section"><div class="section-title">신청 방법</div><div class="item"><div class="dot"></div><div>학교알리미 앱 → 방과후 신청 또는 교무실 방문</div></div><div class="item"><div class="dot"></div><div>문의: 방과후부 ☎ 02-○○○-○○○○</div></div></div></div><div class="footer">○○초등학교 | 서울시 ○○구 ○○로 123</div></div></body></html>`,

  // 가정통신문 — 알리미 앱 스타일 (모바일 친화형)
  [DocType.NEWSLETTER]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;background:#f7f8fc;padding:16px}.wrap{max-width:500px;margin:0 auto}.header{background:#1565c0;color:#fff;border-radius:14px 14px 0 0;padding:18px 20px 14px}.header .meta{font-size:9pt;opacity:.8;margin-bottom:4px}.header h1{font-size:14pt;font-weight:900}.header .date{font-size:9pt;opacity:.75;margin-top:4px}.card{background:#fff;border-radius:0 0 14px 14px;padding:16px 18px 18px;box-shadow:0 2px 10px rgba(0,0,0,.08)}.section{padding:12px 0;border-bottom:1px solid #f0f0f0}.section:last-child{border-bottom:none}.sec-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}.sec-icon{width:28px;height:28px;border-radius:8px;background:#e3f2fd;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}.sec-title{font-size:10.5pt;font-weight:bold;color:#1565c0}.sec-body{font-size:10pt;color:#333;line-height:1.8}.sec-body ul{padding-left:16px}.sec-body li{margin:2px 0}.highlight-box{background:#fff8e1;border-left:3px solid #ffc107;border-radius:0 8px 8px 0;padding:8px 12px;margin:8px 0;font-size:10pt;color:#795548}.footer{text-align:center;font-size:9pt;color:#aaa;margin-top:12px}</style></head><body><div class="wrap"><div class="header"><div class="meta">○○초등학교 3학년 3반 가정통신문</div><h1>3월 학급 안내</h1><div class="date">2026년 3월 3일 (월)</div></div><div class="card"><div class="section"><div class="sec-header"><div class="sec-icon">👋</div><div class="sec-title">인사 말씀</div></div><div class="sec-body">안녕하세요, 학부모님. 올해 3학년 3반을 맡게 된 담임교사 홍길동입니다. 아이들이 즐겁고 안전하게 성장할 수 있도록 최선을 다하겠습니다. 언제든 편하게 연락 주세요.</div></div><div class="section"><div class="sec-header"><div class="sec-icon">📅</div><div class="sec-title">3월 주요 일정</div></div><div class="sec-body"><ul><li>3. 3.(월) — 시업식, 학급 규칙 협의</li><li>3. 7.(금) — 학급 임원 선출</li><li>3. 10.~14. — 학교 안전교육 주간</li><li>3. 21.(금) — 학부모 상담 주간 시작</li></ul></div></div><div class="section"><div class="sec-header"><div class="sec-icon">📱</div><div class="sec-title">소통 안내</div></div><div class="sec-body"><div class="highlight-box">알림 공지는 <b>학교알리미 앱</b>을 통해 전달됩니다.<br>앱 설치 및 우리 반 구독을 부탁드립니다.</div><ul><li>교사 연락: 학교 ☎ 02-○○○-○○○○</li><li>등교 시간: 오전 8:30 ~ 8:50</li></ul></div></div></div><div class="footer">○○초등학교 | 담임 홍길동</div></div></body></html>`,

  // 문자메시지 — 카카오 알림톡/문자 말풍선 UI
  [DocType.MESSAGE]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;background:#b2c7d9;padding:20px;min-height:100vh}.phone{max-width:340px;margin:0 auto;background:#b2c7d9;border-radius:20px;padding:16px 10px;box-shadow:0 4px 20px rgba(0,0,0,.2)}.status-bar{text-align:center;font-size:8pt;color:#fff;margin-bottom:8px;opacity:.8}.chat-header{background:#fff;border-radius:10px 10px 0 0;padding:10px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e0e0e0}.avatar{width:34px;height:34px;border-radius:50%;background:#1565c0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13pt;font-weight:bold}.chat-name{font-size:10.5pt;font-weight:bold;color:#111}.chat-sub{font-size:8.5pt;color:#888}.chat-body{background:#b2c7d9;padding:14px 8px;min-height:160px}.bubble-wrap{display:flex;gap:8px;margin-bottom:12px}.b-avatar{width:30px;height:30px;border-radius:50%;background:#1565c0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10pt;font-weight:bold;flex-shrink:0}.b-name{font-size:8.5pt;color:#555;margin-bottom:3px}.bubble{background:#fff;border-radius:0 12px 12px 12px;padding:10px 13px;font-size:10pt;line-height:1.7;box-shadow:0 1px 3px rgba(0,0,0,.1);max-width:250px}.bubble b{color:#1565c0}.bubble .divider{border:none;border-top:1px dashed #ddd;margin:7px 0}.time{font-size:8pt;color:#888;align-self:flex-end;margin-left:4px}.chat-input{background:#fff;border-radius:0 0 10px 10px;padding:8px 10px;display:flex;gap:6px;align-items:center}.input-box{flex:1;background:#f5f5f5;border-radius:20px;padding:6px 12px;font-size:9.5pt;color:#999}</style></head><body><div class="phone"><div class="status-bar">09:32</div><div class="chat-header"><div class="avatar">홍</div><div><div class="chat-name">홍길동 선생님</div><div class="chat-sub">○○초등학교 3-3</div></div></div><div class="chat-body"><div class="bubble-wrap"><div class="b-avatar">홍</div><div><div class="b-name">홍길동 선생님</div><div class="bubble">안녕하세요, 학부모님. 3학년 3반 담임 홍길동입니다. 😊<hr class="divider"><b>📌 학부모 참관 수업 안내</b><br><br>• 일시: 3. 20.(목) 10:00~11:00<br>• 장소: 3학년 3반 교실<br>• 신청: 학교알리미 앱<br><br>참석을 원하시면 앱에서 신청해 주세요. 정원(20명)이 한정되어 있으니 서둘러 신청 부탁드립니다!</div><div class="time">09:32</div></div></div></div><div class="chat-input"><div class="input-box">메시지 입력...</div></div></div></body></html>`,

  // 공고문 — 현행 학교 공고 양식
  [DocType.GONGGO]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:28px 36px;line-height:1.8}.top{text-align:center;border-bottom:3px double #111;padding-bottom:14px;margin-bottom:16px}.school{font-size:10pt;color:#555;margin-bottom:6px}.top h1{font-size:20pt;font-weight:900;letter-spacing:4px;margin-bottom:4px}.top h2{font-size:12pt;font-weight:normal;color:#333}.docnum{font-size:9.5pt;color:#666;margin-top:6px}h3{font-size:11pt;font-weight:bold;margin:14px 0 6px;color:#b71c1c;border-left:3px solid #b71c1c;padding-left:7px}table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:10pt}th{background:#ffebee;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}.tc{text-align:center}ul{padding-left:20px;margin:3px 0}li{margin:3px 0}p{margin:4px 0}.sig{text-align:center;margin-top:36px;font-size:11pt;font-weight:bold;line-height:2.5;border-top:1px solid #ddd;padding-top:18px}.stamp{font-size:9pt;color:#888}</style></head><body><div class="top"><div class="school">○○초등학교</div><h1>공 고</h1><h2>2026학년도 학교운영위원회 위원 선출 공고</h2><div class="docnum">○○초 공고 제2026-003호</div></div><h3>1. 목적</h3><p>민주적이고 투명한 학교 운영을 위하여 「초·중등교육법」 제31조에 의거, 학교운영위원회 위원을 다음과 같이 선출합니다.</p><h3>2. 선출 일정</h3><table><tr><th>구분</th><th>기간</th><th>방법</th></tr><tr><td>후보자 등록</td><td class="tc">2026. 3. 10.(월) ~ 3. 12.(수)</td><td>학교운영위원회 사무실</td></tr><tr><td>선거 운동</td><td class="tc">2026. 3. 13.(목) ~ 3. 17.(월)</td><td>학교 내</td></tr><tr><td>학부모 투표</td><td class="tc">2026. 3. 18.(화) 09:00~16:00</td><td>학교 1층 현관 앞</td></tr><tr><td>당선자 발표</td><td class="tc">2026. 3. 19.(수) 14:00</td><td>학교 홈페이지 공고</td></tr></table><h3>3. 선출 인원 및 자격</h3><ul><li>학부모위원: 5명 (재학 학생의 학부모)</li><li>교원위원: 3명 (교직원 중 선출)</li><li>지역위원: 2명 (학교운영위원회 추천)</li></ul><h3>4. 문의</h3><p>학교운영위원회 사무국 ☎ 02-○○○-○○○○</p><div class="sig">2026년 3월 1일<br>○ ○ 초 등 학 교 장<br><span class="stamp">(직인 생략)</span></div></body></html>`,
};

// ─── SchoolDocPanel ──────────────────────────────────────────────────────────

interface SchoolDocPanelProps {
  initialTab?: DocType;
}

export const SchoolDocPanel: React.FC<SchoolDocPanelProps> = ({ initialTab }) => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.SCHOOL_DOC);
  const [activeTab, setActiveTab] = useState<DocType>(initialTab ?? DocType.GONGMUN);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [schoolYear, setSchoolYear] = useState('2026');
  const [pageCount, setPageCount] = useState(2);

  // Per-tab file/template state
  const allDocTypes = [
    DocType.GONGMUN, DocType.PLAN, DocType.REPORT, DocType.PUMUI,
    DocType.MEETING_MINUTES, DocType.PROMOTION, DocType.NEWSLETTER,
    DocType.MESSAGE, DocType.GONGGO,
  ];

  const initTabMap = <T,>(defaultValue: T): Record<DocType, T> => {
    const map = {} as Record<DocType, T>;
    allDocTypes.forEach(dt => { map[dt] = defaultValue; });
    return map;
  };

  const [filesByTab, setFilesByTab] = useState<Record<DocType, FileData[]>>(initTabMap([]));
  const [templatesByTab, setTemplatesByTab] = useState<Record<DocType, FileData[]>>(initTabMap([]));
  const [templateTextByTab, setTemplateTextByTab] = useState<Record<DocType, string>>(initTabMap(''));
  const [hwpxFillDataByTab, setHwpxFillDataByTab] = useState<Record<DocType, any[] | null>>(initTabMap(null));
  const [contentByTab, setContentByTab] = useState<Record<DocType, string>>(initTabMap(''));

  const uploadedFiles = filesByTab[activeTab] ?? [];
  const uploadedTemplates = templatesByTab[activeTab] ?? [];
  const templateText = templateTextByTab[activeTab] ?? '';
  const generatedContent = contentByTab[activeTab] ?? '';
  const hwpxFillData = hwpxFillDataByTab[activeTab] ?? null;

  // Gongmun form
  const [gongmunData, setGongmunData] = useState<GongmunInputs>({
    type: GongmunType.INTERNAL,
    complexity: GongmunComplexity.MEDIUM,
    recipient: '',
    title: '',
    bodyContext: '',
  });

  // Plan form
  const [planData, setPlanData] = useState<PlanInputs>({
    topic: '',
    target: '',
    budget: '',
    extraInfo: '',
  });

  // Report form
  const [reportData, setReportData] = useState<ReportInputs>({
    summary: '',
  });

  // Newsletter form
  const [newsletterData, setNewsletterData] = useState<NewsletterInputs>({
    title: '',
    target: '',
    context: '',
  });

  // Message form
  const [messageData, setMessageData] = useState<MessageInputs>({
    target: MessageTarget.PARENT,
    type: MessageType.SMS,
    context: '',
    isReply: false,
    receivedMessage: '',
    relationship: MessageRelationship.PARENT,
  });

  // Pumui form
  const [pumuiData, setPumuiData] = useState<PumuiInputs>({
    type: PumuiType.GOODS,
    title: '',
    relatedDoc: '',
    budget: '',
    calcDetails: '',
    details: '',
    purpose: '',
    target: '',
    datetime: '',
    place: '',
    agenda: '',
    attendees: '',
  });

  // Meeting minutes form
  const [meetingMinutesData, setMeetingMinutesData] = useState<MeetingMinutesInputs>({
    title: '',
    schoolName: '',
    datetime: '',
    place: '',
    attendees: '',
    topic: '',
    context: '',
  });

  // Promotion form
  const [promotionData, setPromotionData] = useState<PromotionInputs>({
    schoolName: '',
    datetime: '',
    target: '',
    content: '',
    purpose: '',
    interview: '',
  });

  // Gonggo form
  const [gonggoData, setGonggoData] = useState<GonggoInputs>({
    title: '',
    number: '',
    content: '',
    deadline: '',
    contact: '',
    extraInfo: '',
  });

  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load school name from config on mount
  useEffect(() => {
    window.electronAPI.getConfig('schoolName').then((v: unknown) => {
      const val = v as string;
      setMeetingMinutesData(prev => ({ ...prev, schoolName: prev.schoolName || val || '' }));
    });
  }, []);

  // Loading message cycling
  useEffect(() => {
    if (isGenerating) {
      let idx = 0;
      setLoadingMessage(LOADING_MESSAGES[0]);
      loadingIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[idx]);
      }, 2500);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    }
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [isGenerating]);

  // ─── Build prompt context ──────────────────────────────────────────────────

  const buildPromptContext = (): string => {
    switch (activeTab) {
      case DocType.GONGMUN: {
        const typeLabel = gongmunData.type === GongmunType.INTERNAL ? '내부결재' : '대외공문';
        return `[공문 유형]: ${typeLabel}\n[수신자]: ${gongmunData.recipient || '(미입력)'}\n[제목]: ${gongmunData.title || '(미입력)'}\n[본문 요청사항]: ${gongmunData.bodyContext || '(미입력)'}`;
      }
      case DocType.PLAN:
        return `[주제/사업명]: ${planData.topic}\n[대상]: ${planData.target}\n[예산]: ${planData.budget}\n[추가 사항]: ${planData.extraInfo}`;
      case DocType.REPORT:
        return `[결과 요약 및 요청사항]: ${reportData.summary}`;
      case DocType.NEWSLETTER:
        return `[제목]: ${newsletterData.title}\n[대상]: ${newsletterData.target}\n[내용]: ${newsletterData.context}`;
      case DocType.MESSAGE: {
        const typeLabel = messageData.type === MessageType.SMS ? '단문(SMS)' : '장문(LMS)';
        let msgCtx = `[수신 대상]: ${messageData.target}\n[문자 유형]: ${typeLabel}\n[내용]: ${messageData.context}`;
        if (messageData.isReply && messageData.receivedMessage.trim()) {
          msgCtx += `\n[답장 생성]: 예\n[나와의 관계]: ${messageData.relationship}\n[받은 메시지]: ${messageData.receivedMessage}`;
        }
        return msgCtx;
      }
      case DocType.PUMUI: {
        let ctx = `[품의 유형]: ${pumuiData.type}\n[품의 제목/건명]: ${pumuiData.title}\n[관련 공문/근거]: ${pumuiData.relatedDoc}\n[소요 예산]: ${pumuiData.budget}원\n[산출 내역]: ${pumuiData.calcDetails}`;
        if (pumuiData.type === PumuiType.GOODS) {
          ctx += `\n[세부 내역(물품명, 수량, 단가)]: ${pumuiData.details || ''}\n[구입 목적]: ${pumuiData.purpose || ''}`;
        } else if (pumuiData.type === PumuiType.ALLOWANCE) {
          ctx += `\n[지급 대상]: ${pumuiData.target || ''}\n[사업 일시]: ${pumuiData.datetime || ''}`;
        } else if (pumuiData.type === PumuiType.BIZ_PROMOTION) {
          ctx += `\n[일시]: ${pumuiData.datetime || ''}\n[장소]: ${pumuiData.place || ''}\n[협의 안건]: ${pumuiData.agenda || ''}\n[참석자]: ${pumuiData.attendees || ''}`;
        }
        return ctx;
      }
      case DocType.MEETING_MINUTES:
        return `[제목]: ${meetingMinutesData.title}\n[학교명]: ${meetingMinutesData.schoolName}\n[일시]: ${meetingMinutesData.datetime}\n[장소]: ${meetingMinutesData.place}\n[출석자]: ${meetingMinutesData.attendees}\n[회의 안건]: ${meetingMinutesData.topic}\n[회의 내용]: ${meetingMinutesData.context}`;
      case DocType.PROMOTION:
        return `[학교명]: ${promotionData.schoolName}\n[행사 일시]: ${promotionData.datetime}\n[대상]: ${promotionData.target}\n[내용]: ${promotionData.content}\n[목적/의의]: ${promotionData.purpose}\n[인터뷰 대상자]: ${promotionData.interview}`;
      default:
        return '';
    }
  };

  // ─── Get HWPX data for template filling ───────────────────────────────────

  const getHwpxTitleFromContent = (content: string, tab: DocType): string => {
    let title = '';
    if (tab === DocType.GONGMUN) title = gongmunData.title;
    else if (tab === DocType.PLAN) title = planData.topic;
    else if (tab === DocType.REPORT) title = reportData.summary.substring(0, 30);
    else if (tab === DocType.NEWSLETTER) title = newsletterData.title;
    else if (tab === DocType.MESSAGE) title = messageData.context.substring(0, 20);
    else if (tab === DocType.PUMUI) title = pumuiData.title;
    else if (tab === DocType.MEETING_MINUTES) title = meetingMinutesData.title;
    else if (tab === DocType.PROMOTION) title = promotionData.content.substring(0, 30);
    else if (tab === DocType.GONGGO) title = gonggoData.title;
    return title || 'document';
  };

  const extractResult = (raw: string): { cleanContent: string; fillData: any[] | null } => {
    const START = '___HWPX_FILL_START___';
    const END = '___HWPX_FILL_END___';
    const si = raw.indexOf(START);
    const ei = raw.indexOf(END);
    if (si === -1 || ei === -1 || ei <= si) return { cleanContent: raw.trim(), fillData: null };
    const jsonStr = raw.substring(si + START.length, ei).trim();
    const cleanContent = raw.substring(0, si).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      return { cleanContent, fillData: Array.isArray(parsed) ? parsed : null };
    } catch {
      return { cleanContent, fillData: null };
    }
  };

  // ─── Handle Generate ───────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    startGeneration(`SCHOOL_DOC_${activeTab}`);
    try {
      let result: string;
      if (activeTab === DocType.GONGGO) {
        result = await generateDocument(
          activeTab,
          '',
          undefined,
          pageCount,
          schoolYear,
          uploadedFiles,
          uploadedTemplates,
          templateText,
          GongmunComplexity.MEDIUM,
          gonggoData,
        );
      } else {
        const context = buildPromptContext();
        const gongmunType = activeTab === DocType.GONGMUN ? gongmunData.type : undefined;
        const gongmunComplexity = activeTab === DocType.GONGMUN ? gongmunData.complexity : GongmunComplexity.MEDIUM;
        result = await generateDocument(
          activeTab,
          context,
          gongmunType,
          pageCount,
          schoolYear,
          uploadedFiles,
          uploadedTemplates,
          templateText,
          gongmunComplexity,
          undefined,
        );
      }
      const { cleanContent, fillData } = extractResult(result);
      setContentByTab(prev => ({ ...prev, [activeTab]: cleanContent }));
      setHwpxFillDataByTab(prev => ({ ...prev, [activeTab]: fillData }));
    } catch (err: any) {
      setError(err.message || 'AI 문서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      endGeneration();
    }
  };

  // ─── Tab definitions ───────────────────────────────────────────────────────

  const tabs = [
    { type: DocType.GONGMUN, icon: FileText, label: '공문서 작성' },
    { type: DocType.PLAN, icon: ClipboardList, label: '계획서 작성' },
    { type: DocType.REPORT, icon: FileOutput, label: '보고서 작성' },
    { type: DocType.PUMUI, icon: Receipt, label: '품의서 작성' },
    { type: DocType.MEETING_MINUTES, icon: Users, label: '회의록 작성' },
    { type: DocType.PROMOTION, icon: Megaphone, label: '홍보자료 작성' },
    { type: DocType.NEWSLETTER, icon: Mail, label: '가정통신문 작성' },
    { type: DocType.MESSAGE, icon: Smartphone, label: '문자메세지 작성' },
    { type: DocType.GONGGO, icon: MegaphoneIcon, label: '공고문 작성' },
  ];

  // ─── Style helpers ─────────────────────────────────────────────────────────

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide';
  const sectionClass = 'mb-4';

  // ─── Render ────────────────────────────────────────────────────────────────

  const hwpxTemplateFile = uploadedTemplates.length > 0 ? uploadedTemplates[0].file : undefined;

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA]">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left: input panel */}
        <div className="w-[360px] shrink-0 bg-white rounded-lg border border-gray-300 shadow-sm flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 shrink-0">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-blue-500" />
              입력 정보
            </h3>
          </div>

          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Common settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>학년도</label>
                <input
                  type="text"
                  className={inputClass}
                  value={schoolYear}
                  onChange={e => setSchoolYear(e.target.value)}
                  placeholder="예: 2026"
                />
              </div>
              {(activeTab === DocType.PLAN || activeTab === DocType.REPORT || activeTab === DocType.PROMOTION) && (
                <div>
                  <label className={labelClass}>분량 (쪽)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={pageCount}
                    min={1}
                    max={10}
                    onChange={e => setPageCount(parseInt(e.target.value) || 2)}
                  />
                </div>
              )}
            </div>

            <hr className="border-gray-200" />

            {/* Dynamic form by tab */}

            {/* 공문서 */}
            {activeTab === DocType.GONGMUN && (
              <div className="space-y-4">
                <div className={sectionClass}>
                  <label className={labelClass}>공문 유형</label>
                  <div className="flex gap-2">
                    {[
                      { val: GongmunType.INTERNAL, label: '내부결재' },
                      { val: GongmunType.EXTERNAL, label: '대외공문' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setGongmunData({ ...gongmunData, type: opt.val })}
                        className={`flex-1 py-1.5 text-sm rounded-md border transition-all ${
                          gongmunData.type === opt.val
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={sectionClass}>
                  <label className={labelClass}>공문 복잡도</label>
                  <div className="flex gap-2">
                    {[
                      { val: GongmunComplexity.SIMPLE, label: '간단' },
                      { val: GongmunComplexity.MEDIUM, label: '중간' },
                      { val: GongmunComplexity.DETAILED, label: '상세' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setGongmunData({ ...gongmunData, complexity: opt.val })}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-all ${
                          gongmunData.complexity === opt.val
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {gongmunData.type === GongmunType.EXTERNAL && (
                  <div>
                    <label className={labelClass}>수신자</label>
                    <input type="text" className={inputClass} placeholder="예: ○○교육지원청 교육장" value={gongmunData.recipient} onChange={e => setGongmunData({ ...gongmunData, recipient: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className={labelClass}>제목 (건명)</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 현장체험학습 운영 계획 안내" value={gongmunData.title} onChange={e => setGongmunData({ ...gongmunData, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>본문 요청 사항</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="공문에 들어갈 핵심 내용, 일시, 장소, 대상 등을 자유롭게 입력하세요." value={gongmunData.bodyContext} onChange={e => setGongmunData({ ...gongmunData, bodyContext: e.target.value })} />
                </div>
              </div>
            )}

            {/* 계획서 */}
            {activeTab === DocType.PLAN && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>주제 / 사업명</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 독서교육 활성화 계획" value={planData.topic} onChange={e => setPlanData({ ...planData, topic: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>대상</label>
                  <input type="text" className={inputClass} placeholder="예: 전교생, 3학년, 교직원" value={planData.target} onChange={e => setPlanData({ ...planData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>예산 (원)</label>
                  <input type="text" className={inputClass} placeholder="예: 1,500,000" value={planData.budget} onChange={e => setPlanData({ ...planData, budget: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>추가 사항 (선택)</label>
                  <textarea className={`${inputClass} min-h-[100px] resize-none`} placeholder="포함되어야 할 특이사항, 일정, 방법 등을 자유롭게 입력하세요." value={planData.extraInfo} onChange={e => setPlanData({ ...planData, extraInfo: e.target.value })} />
                </div>
              </div>
            )}

            {/* 보고서 */}
            {activeTab === DocType.REPORT && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>결과 요약 및 요청사항</label>
                  <textarea className={`${inputClass} min-h-[160px] resize-none`} placeholder="보고서로 작성할 내용을 요약하여 입력하세요. 행사명, 일시, 장소, 참여 인원, 주요 내용, 성과 등을 포함해 주세요." value={reportData.summary} onChange={e => setReportData({ ...reportData, summary: e.target.value })} />
                </div>
              </div>
            )}

            {/* 품의서 */}
            {activeTab === DocType.PUMUI && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>품의 유형</label>
                  <div className="flex gap-2">
                    {[
                      { val: PumuiType.GOODS, label: '물품 구입' },
                      { val: PumuiType.ALLOWANCE, label: '수당 지급' },
                      { val: PumuiType.BIZ_PROMOTION, label: '업무추진비' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setPumuiData({ ...pumuiData, type: opt.val })}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-all ${
                          pumuiData.type === opt.val
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>품의 제목 / 건명</label>
                  <input type="text" className={inputClass} placeholder="예: 수학 교구 구입 품의" value={pumuiData.title} onChange={e => setPumuiData({ ...pumuiData, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>관련 공문 / 근거</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 교육과정 운영 계획" value={pumuiData.relatedDoc} onChange={e => setPumuiData({ ...pumuiData, relatedDoc: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>소요 예산 (원)</label>
                  <input type="text" className={inputClass} placeholder="예: 300,000" value={pumuiData.budget} onChange={e => setPumuiData({ ...pumuiData, budget: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>산출 내역</label>
                  <input type="text" className={inputClass} placeholder="예: 노트 20권 × 5,000원 = 100,000원" value={pumuiData.calcDetails} onChange={e => setPumuiData({ ...pumuiData, calcDetails: e.target.value })} />
                </div>
                {pumuiData.type === PumuiType.GOODS && (
                  <>
                    <div>
                      <label className={labelClass}>세부 내역 (물품명, 수량, 단가)</label>
                      <textarea className={`${inputClass} min-h-[80px] resize-none`} placeholder="구입할 물품 목록을 입력하세요." value={pumuiData.details || ''} onChange={e => setPumuiData({ ...pumuiData, details: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>구입 목적</label>
                      <input type="text" className={inputClass} placeholder="예: 수업 자료 보강" value={pumuiData.purpose || ''} onChange={e => setPumuiData({ ...pumuiData, purpose: e.target.value })} />
                    </div>
                  </>
                )}
                {pumuiData.type === PumuiType.ALLOWANCE && (
                  <>
                    <div>
                      <label className={labelClass}>지급 대상</label>
                      <input type="text" className={inputClass} placeholder="예: 방과후 강사 3명" value={pumuiData.target || ''} onChange={e => setPumuiData({ ...pumuiData, target: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>사업 일시</label>
                      <input type="text" className={inputClass} placeholder="예: 2026. 3. 1. ~ 6. 30." value={pumuiData.datetime || ''} onChange={e => setPumuiData({ ...pumuiData, datetime: e.target.value })} />
                    </div>
                  </>
                )}
                {pumuiData.type === PumuiType.BIZ_PROMOTION && (
                  <>
                    <div>
                      <label className={labelClass}>일시</label>
                      <input type="text" className={inputClass} placeholder="예: 2026. 4. 10.(금) 15:00" value={pumuiData.datetime || ''} onChange={e => setPumuiData({ ...pumuiData, datetime: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>장소</label>
                      <input type="text" className={inputClass} placeholder="예: 교장실" value={pumuiData.place || ''} onChange={e => setPumuiData({ ...pumuiData, place: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>협의 안건</label>
                      <textarea className={`${inputClass} min-h-[80px] resize-none`} placeholder="협의할 주요 안건을 입력하세요." value={pumuiData.agenda || ''} onChange={e => setPumuiData({ ...pumuiData, agenda: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>참석자</label>
                      <input type="text" className={inputClass} placeholder="예: 교장, 교감, 부장교사" value={pumuiData.attendees || ''} onChange={e => setPumuiData({ ...pumuiData, attendees: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 회의록 */}
            {activeTab === DocType.MEETING_MINUTES && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>회의 제목</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 1학기 교육과정위원회 협의회" value={meetingMinutesData.title} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>학교명</label>
                  <input type="text" className={inputClass} placeholder="예: ○○초등학교" value={meetingMinutesData.schoolName} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, schoolName: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>일시</label>
                  <input type="text" className={inputClass} placeholder="예: 2026. 3. 5.(목) 16:00" value={meetingMinutesData.datetime} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, datetime: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>장소</label>
                  <input type="text" className={inputClass} placeholder="예: 교무실" value={meetingMinutesData.place} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, place: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>출석위원</label>
                  <input type="text" className={inputClass} placeholder="예: 교장, 교감, 교무부장, 연구부장" value={meetingMinutesData.attendees} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, attendees: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>회의 안건</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 교육과정 편성 검토" value={meetingMinutesData.topic} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, topic: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>회의 내용 요약</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="회의에서 논의된 주요 내용, 결정 사항, 발언 요점 등을 입력하세요." value={meetingMinutesData.context} onChange={e => setMeetingMinutesData({ ...meetingMinutesData, context: e.target.value })} />
                </div>
              </div>
            )}

            {/* 홍보자료 */}
            {activeTab === DocType.PROMOTION && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>학교명</label>
                  <input type="text" className={inputClass} placeholder="예: ○○초등학교" value={promotionData.schoolName} onChange={e => setPromotionData({ ...promotionData, schoolName: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>행사 일시</label>
                  <input type="text" className={inputClass} placeholder="예: 2026. 5. 15.(금) 10:00" value={promotionData.datetime} onChange={e => setPromotionData({ ...promotionData, datetime: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>홍보 대상</label>
                  <input type="text" className={inputClass} placeholder="예: 학부모, 지역 주민" value={promotionData.target} onChange={e => setPromotionData({ ...promotionData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>홍보 내용</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="행사 내용, 프로그램, 특이사항 등을 입력하세요." value={promotionData.content} onChange={e => setPromotionData({ ...promotionData, content: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>목적 / 의의</label>
                  <input type="text" className={inputClass} placeholder="예: 지역사회와의 교육 공동체 형성" value={promotionData.purpose} onChange={e => setPromotionData({ ...promotionData, purpose: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>인터뷰 대상자 (선택)</label>
                  <input type="text" className={inputClass} placeholder="예: 교장 선생님, 담당 교사" value={promotionData.interview} onChange={e => setPromotionData({ ...promotionData, interview: e.target.value })} />
                </div>
              </div>
            )}

            {/* 가정통신문 */}
            {activeTab === DocType.NEWSLETTER && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>제목</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 학교 운동회 안내" value={newsletterData.title} onChange={e => setNewsletterData({ ...newsletterData, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>수신 대상</label>
                  <input type="text" className={inputClass} placeholder="예: 전교생 학부모님" value={newsletterData.target} onChange={e => setNewsletterData({ ...newsletterData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>안내 내용</label>
                  <textarea className={`${inputClass} min-h-[140px] resize-none`} placeholder="가정통신문에 포함될 주요 내용, 일시, 장소, 준비물, 협조 사항 등을 입력하세요." value={newsletterData.context} onChange={e => setNewsletterData({ ...newsletterData, context: e.target.value })} />
                </div>
              </div>
            )}

            {/* 문자메세지 */}
            {activeTab === DocType.MESSAGE && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>수신 대상</label>
                  <div className="flex gap-2">
                    {[MessageTarget.PARENT, MessageTarget.TEACHER, MessageTarget.STUDENT].map(t => (
                      <button
                        key={t}
                        onClick={() => setMessageData({ ...messageData, target: t })}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-all ${
                          messageData.target === t
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>문자 유형</label>
                  <div className="flex gap-2">
                    {[
                      { val: MessageType.SMS, label: '단문 (SMS)' },
                      { val: MessageType.LMS, label: '장문 (LMS)' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setMessageData({ ...messageData, type: opt.val })}
                        className={`flex-1 py-1.5 text-sm rounded-md border transition-all ${
                          messageData.type === opt.val
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reply toggle */}
                <div className="flex items-center gap-2 py-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={messageData.isReply}
                      onChange={e => setMessageData({ ...messageData, isReply: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">답장 생성</span>
                  </label>
                  <span className="text-xs text-gray-400">받은 메시지에 대한 답장을 생성합니다.</span>
                </div>

                {messageData.isReply && (
                  <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div>
                      <label className={labelClass}>나와의 관계</label>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.values(MessageRelationship).map(r => (
                          <button
                            key={r}
                            onClick={() => setMessageData({ ...messageData, relationship: r })}
                            className={`px-3 py-1 text-xs rounded-full border transition-all ${
                              messageData.relationship === r
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>받은 메시지</label>
                      <textarea
                        className={`${inputClass} min-h-[80px] resize-none`}
                        placeholder="답장할 메시지를 붙여넣기 하세요."
                        value={messageData.receivedMessage}
                        onChange={e => setMessageData({ ...messageData, receivedMessage: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelClass}>{messageData.isReply ? '답장 내용 / 추가 요청사항' : '전달 내용'}</label>
                  <textarea className={`${inputClass} min-h-[100px] resize-none`} placeholder={messageData.isReply ? '답장에 포함할 내용이나 요청사항을 입력하세요. (비워도 됩니다)' : '문자에 담을 내용을 입력하세요.'} value={messageData.context} onChange={e => setMessageData({ ...messageData, context: e.target.value })} />
                </div>
              </div>
            )}

            {/* 공고문 */}
            {activeTab === DocType.GONGGO && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>공고 제목</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 방과후학교 강사 모집 공고" value={gonggoData.title} onChange={(e) => setGonggoData({...gonggoData, title: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>공고 번호 (선택)</label>
                  <input type="text" className={inputClass} placeholder="예: 제2026-001호" value={gonggoData.number} onChange={(e) => setGonggoData({...gonggoData, number: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>공고 내용 요약</label>
                  <textarea className={`${inputClass} min-h-[120px] resize-none`} placeholder="모집/공고 내용을 요약하여 입력하세요." value={gonggoData.content} onChange={(e) => setGonggoData({...gonggoData, content: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>접수 기간 / 마감일</label>
                  <input type="text" className={inputClass} placeholder="예: 2026. 3. 1.(일) ~ 3. 15.(일)" value={gonggoData.deadline} onChange={(e) => setGonggoData({...gonggoData, deadline: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>문의처</label>
                  <input type="text" className={inputClass} placeholder="예: 교무부 (054-000-0000)" value={gonggoData.contact} onChange={(e) => setGonggoData({...gonggoData, contact: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>추가 사항 (선택)</label>
                  <textarea className={`${inputClass} min-h-[80px] resize-none`} placeholder="기타 공고에 포함될 추가 사항" value={gonggoData.extraInfo} onChange={(e) => setGonggoData({...gonggoData, extraInfo: e.target.value})} />
                </div>
              </div>
            )}

            <hr className="border-gray-200" />

            {/* File uploads */}
            <div>
              <FileUpload
                label="참고 자료 (선택)"
                files={uploadedFiles}
                onFilesChange={files => setFilesByTab(prev => ({ ...prev, [activeTab]: files }))}
                multiple={true}
              />
            </div>

            <div>
              <div className="mb-2">
                <label className={labelClass}>양식 / 템플릿 (선택)</label>
              </div>
              <FileUpload
                label="양식 파일 업로드"
                files={uploadedTemplates}
                onFilesChange={files => setTemplatesByTab(prev => ({ ...prev, [activeTab]: files }))}
                multiple={false}
              />
              <div className="mt-2">
                <label className={labelClass}>양식 직접 입력 (선택)</label>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-none`}
                  placeholder="양식 구조나 항목을 텍스트로 직접 입력해도 됩니다."
                  value={templateText}
                  onChange={e => setTemplateTextByTab(prev => ({ ...prev, [activeTab]: e.target.value }))}
                />
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                isGenerating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="truncate">{loadingMessage}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  {activeTab === DocType.GONGMUN ? '공문서 생성' :
                   activeTab === DocType.PLAN ? '계획서 생성' :
                   activeTab === DocType.REPORT ? '보고서 생성' :
                   activeTab === DocType.PUMUI ? '품의서 생성' :
                   activeTab === DocType.MEETING_MINUTES ? '회의록 생성' :
                   activeTab === DocType.PROMOTION ? '홍보자료 생성' :
                   activeTab === DocType.NEWSLETTER ? '가정통신문 생성' :
                   activeTab === DocType.MESSAGE ? '문자메세지 생성' :
                   activeTab === DocType.GONGGO ? '공고문 생성' :
                   '문서 생성'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: output panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {generatedContent ? (
            <GeneratedDisplay
              content={generatedContent}
              hwpxFillData={hwpxFillData}
              hwpxTemplate={hwpxTemplateFile}
            />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-lg border border-gray-300 shadow-sm">
              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <svg className="animate-spin w-8 h-8 text-blue-500 mb-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-600 mb-1">문서를 생성하는 중...</p>
                  <p className="text-sm text-gray-400">{loadingMessage}</p>
                </div>
              ) : EXAMPLE_DOCS[activeTab] ? (
                <>
                  <div className="shrink-0 bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wide">예시 문서</span>
                    <span className="text-xs text-blue-500">정보를 입력하고 생성하면 아래와 유사한 형식으로 만들어집니다.</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      srcDoc={EXAMPLE_DOCS[activeTab]}
                      sandbox=""
                      className="w-full h-full border-0"
                      title="예시 문서"
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="bg-blue-50 p-4 rounded-full mb-4">
                    <FileText className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-600 mb-2">문서를 생성해 주세요</h3>
                  <p className="text-sm text-gray-400 max-w-xs">
                    왼쪽 패널에서 필요한 정보를 입력한 후<br />생성 버튼을 눌러주세요.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchoolDocPanel;
