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
  // 공문서 — AI 활용 수업 연수 운영 승인 요청 (외부발송)
  [DocType.GONGMUN]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;background:#fff;padding:28px 36px;line-height:1.75}.org{font-size:15pt;font-weight:900;letter-spacing:2px;margin-bottom:4px}.approval{display:flex;border:1px solid #555;width:220px;margin-left:auto;margin-bottom:14px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555;padding:3px 0}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:10px 0 6px}.rule{border:none;border-top:2px solid #111;margin:4px 0 10px}.meta table{width:100%;border-collapse:collapse;margin-bottom:12px}.meta td{padding:4px 8px;vertical-align:top;font-size:10.5pt}.meta td.k{width:60px;font-weight:bold;white-space:nowrap}.meta td.v{border-bottom:1px solid #ddd}.body-text p{margin-bottom:8px}.body-text .indent{padding-left:18px}.attach{margin-top:14px;font-size:10pt}.sig-block{margin-top:36px;text-align:center;font-size:10.5pt;line-height:2.4}</style></head><body><div class="org">○ ○ 고 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기안</div><div class="apv-name">홍길동</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">이부장</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div><hr class="rule"><div class="meta"><table><tr><td class="k">수 신</td><td class="v">○○교육지원청 교육장</td></tr><tr><td class="k">경 유</td><td class="v">중등교육과장</td></tr><tr><td class="k">제 목</td><td class="v">2026학년도 교원 AI 활용 수업 역량 강화 연수 운영 승인 요청</td></tr></table></div><div class="body-text"><p>1. 관련: 교육혁신과-2026-0214 「미래형 수업 혁신 교원 역량 강화 기본 계획」(2026.02.10.)</p><p>2. 위 관련에 의거하여 2026학년도 교원 AI 활용 수업 역량 강화 연수를 다음과 같이 운영하고자 승인을 요청합니다.</p><p class="indent">가. 연수명: 2026학년도 교원 AI 활용 수업 역량 강화 직무연수</p><p class="indent">나. 일시: 2026. 8. 4.(월) ~ 8. 5.(화) (2일, 15시간)</p><p class="indent">다. 장소: ○○교육연수원 대강의실</p><p class="indent">라. 대상: 전 교직원 38명</p><p class="indent">마. 주요 내용: 생성형 AI 수업 설계, 에듀테크 도구 실습, AI 윤리 교육</p><div class="attach">붙 임&nbsp;&nbsp;1. 교원 AI 활용 수업 역량 강화 연수 세부 운영 계획서 1부.&nbsp;&nbsp;끝.</div></div><div class="sig-block">○ ○ 고 등 학 교 장</div></body></html>`,

  // 계획서 — AI 활용 수업 연수 운영 계획 (내부결재) + 예산 항목
  [DocType.PLAN]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:24px 32px;line-height:1.75}.doc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.org{font-size:14pt;font-weight:900;letter-spacing:2px}.approval{display:flex;border:1px solid #555;width:200px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:8px 0 5px}hr.rule{border:none;border-top:2px solid #111;margin:6px 0 14px}h1{font-size:14pt;text-align:center;font-weight:900;margin:6px 0 16px;letter-spacing:1px}h2{font-size:11pt;font-weight:bold;margin:14px 0 5px;padding-left:6px;border-left:3px solid #1565c0;color:#1565c0}p{margin:3px 0 5px}ul{padding-left:20px;margin:3px 0}li{margin:2px 0}table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:10pt}th{background:#e3eaf5;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}.tc{text-align:center}.tr{text-align:right}.sum{background:#e3eaf5;font-weight:bold}</style></head><body><div class="doc-top"><div class="org">○ ○ 초 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기안</div><div class="apv-name">홍길동</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">이영희</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div></div><hr class="rule"><h1>2026학년도 교원 AI 활용 수업 역량 강화 연수 운영 계획</h1><h2>1. 목적</h2><p>2022 개정 교육과정의 디지털·AI 소양 교육을 효과적으로 실현할 수 있도록 교원의 AI 기반 수업 설계 역량을 강화한다.</p><h2>2. 방침</h2><ul><li>교육부 「디지털 기반 교육혁신 방안」에 근거한 교원 연수 운영</li><li>실습 중심 연수로 교실 현장 즉시 적용 가능한 역량 함양</li><li>학교급·교과별 맞춤형 AI 도구 활용 사례 중심 구성</li></ul><h2>3. 세부 운영 계획</h2><table><tr><th>일시</th><th>내용</th><th>강사</th><th class="tc" width="50">시간</th><th>비고</th></tr><tr><td class="tc">8.4.(월) 오전</td><td>생성형 AI 수업 설계 이론 및 사례</td><td>외부 강사</td><td class="tc">3h</td><td>강의실</td></tr><tr><td class="tc">8.4.(월) 오후</td><td>ChatGPT·Gemini 수업 활용 실습</td><td>교내 연구부</td><td class="tc">3h</td><td>컴퓨터실</td></tr><tr><td class="tc">8.5.(화) 오전</td><td>에듀테크 플랫폼 활용(패들렛·클래스팅)</td><td>외부 강사</td><td class="tc">3h</td><td>컴퓨터실</td></tr><tr><td class="tc">8.5.(화) 오후</td><td>AI 윤리·저작권 및 수업 나눔</td><td>교내 부장</td><td class="tc">3h</td><td>강의실</td></tr></table><h2>4. 예산 계획</h2><table><tr><th class="tc" width="35">No</th><th>항목</th><th>산출 근거</th><th class="tc" width="95">금액(원)</th></tr><tr><td class="tc">1</td><td>외부 강사료</td><td>2명 × 6h × 70,000원</td><td class="tr">840,000</td></tr><tr><td class="tc">2</td><td>연수 교재·인쇄물</td><td>38명 × 3,000원</td><td class="tr">114,000</td></tr><tr><td class="tc">3</td><td>실습 재료비</td><td>포스트잇·펜 세트 등</td><td class="tr">46,000</td></tr><tr><td class="tc sum" colspan="3">합 계</td><td class="tr sum">1,000,000</td></tr></table><h2>5. 기대 효과</h2><p>AI 수업 도구 활용 능력 향상으로 학생 참여형 수업 문화 정착 및 디지털 교육혁신 가속화</p></body></html>`,

  // 보고서 — AI 활용 수업 연수 결과 보고
  [DocType.REPORT]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:24px 32px;line-height:1.8}.doc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.org{font-size:14pt;font-weight:900;letter-spacing:2px}.approval{display:flex;border:1px solid #555;width:200px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:8px 0 5px}hr.rule{border:none;border-top:2px solid #111;margin:6px 0 14px}h1{font-size:14pt;text-align:center;font-weight:900;margin:6px 0 16px}h2{font-size:11pt;font-weight:bold;margin:14px 0 5px;padding-left:6px;border-left:3px solid #2e7d32;color:#2e7d32}p{margin:3px 0 5px}ul{padding-left:20px;margin:3px 0}li{margin:2px 0}table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:10pt}th{background:#e8f5e9;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}.tc{text-align:center}</style></head><body><div class="doc-top"><div class="org">○ ○ 초 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기안</div><div class="apv-name">홍길동</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">이영희</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div></div><hr class="rule"><h1>2026학년도 교원 AI 활용 수업 역량 강화 연수 결과 보고</h1><h2>1. 연수 개요</h2><table><tr><th width="90">항목</th><th>내용</th></tr><tr><td class="tc">일시</td><td>2026. 8. 4.(월) ~ 8. 5.(화) (2일, 15시간)</td></tr><tr><td class="tc">장소</td><td>○○교육연수원 대강의실 및 컴퓨터실</td></tr><tr><td class="tc">참가</td><td>교직원 36명 / 전체 38명 (참가율 94.7%)</td></tr><tr><td class="tc">집행 예산</td><td>998,000원 / 편성 1,000,000원</td></tr></table><h2>2. 프로그램별 운영 결과</h2><ul><li>생성형 AI 수업 설계 — 교과별 AI 프롬프트 작성 전략 습득 및 우수 사례 발표</li><li>ChatGPT·Gemini 실습 — 국어·수학·과학 수업 자료 즉석 생성 실습 완료</li><li>에듀테크 플랫폼 — 패들렛 기반 모둠 수업 보드 1인 1작품 완성</li><li>AI 윤리·저작권 — 학생 지도 시나리오 토의 및 사례 공유</li></ul><h2>3. 성과 및 평가</h2><p>만족도 조사 평균 4.7점(5점 만점). '즉시 수업 활용 가능성' 항목 4.9점으로 최고점. 연수 2주 후 AI 도구를 실제 수업에 적용한 교원 73%로 연수 효과 높음.</p><h2>4. 개선 사항</h2><p>컴퓨터실 인터넷 속도 저하로 실습 중 지연 발생 → 차년도 Wi-Fi 환경 개선 후 운영 권고</p></body></html>`,

  // 품의서 — AI 연수 외부 강사료 지급 품의
  [DocType.PUMUI]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:24px 32px;line-height:1.75}.doc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.org{font-size:14pt;font-weight:900;letter-spacing:2px}.approval{display:flex;border:1px solid #555;width:240px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:8px 0 5px}hr.rule{border:none;border-top:2px solid #111;margin:6px 0 14px}h1{font-size:13pt;text-align:center;font-weight:900;margin:6px 0 14px}table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:10pt}th{background:#fff3e0;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}td.k{background:#fafafa;font-weight:bold;text-align:center;width:100px}.tc{text-align:center}.tr{text-align:right}.sum{background:#fff3e0;font-weight:bold}p{margin:5px 0}.sign{margin-top:20px;text-align:right;font-size:10pt;line-height:2}</style></head><body><div class="doc-top"><div class="org">○ ○ 초 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기안</div><div class="apv-name">홍길동</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">이영희</div></div><div class="apv-cell"><div class="apv-label">예산</div><div class="apv-name">박행정</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div></div><hr class="rule"><h1>AI 활용 수업 역량 강화 연수 강사료 지급 품의서</h1><table><tr><td class="k">품의 제목</td><td>2026학년도 교원 AI 활용 수업 연수 외부 강사료 지급 품의</td></tr><tr><td class="k">관련 근거</td><td>2026학년도 교원 AI 활용 수업 역량 강화 연수 운영 계획(교장 결재 2026.07.01.)</td></tr><tr><td class="k">예산 과목</td><td>교원연수비-강사료(목 240)</td></tr></table><table><tr><th class="tc" width="30">No</th><th>강사명</th><th>강의 내용</th><th class="tc" width="50">시간</th><th class="tc" width="70">단가(원)</th><th class="tc" width="80">금액(원)</th></tr><tr><td class="tc">1</td><td>김○○ 강사</td><td>생성형 AI 수업 설계 이론 및 사례</td><td class="tc">6h</td><td class="tr">70,000</td><td class="tr">420,000</td></tr><tr><td class="tc">2</td><td>박○○ 강사</td><td>에듀테크 플랫폼 활용 실습</td><td class="tc">6h</td><td class="tr">70,000</td><td class="tr">420,000</td></tr><tr><td class="tc sum" colspan="5">합 계</td><td class="tr sum">840,000</td></tr></table><p>위와 같이 강사료 지급을 품의하오니 결재하여 주시기 바랍니다.</p><div class="sign">2026년 8월 6일<br>기안: 연구부장 홍 길 동</div></body></html>`,

  // 회의록 — AI 활용 수업 연수 운영 협의회
  [DocType.MEETING_MINUTES]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:24px 32px;line-height:1.8}.doc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.org{font-size:14pt;font-weight:900;letter-spacing:2px}.approval{display:flex;border:1px solid #555;width:200px}.apv-cell{flex:1;text-align:center;border-right:1px solid #555}.apv-cell:last-child{border-right:none}.apv-label{font-size:8pt;color:#555;border-bottom:1px solid #555;padding:2px 0}.apv-name{font-size:9.5pt;padding:8px 0 5px}hr.rule{border:none;border-top:2px solid #111;margin:6px 0 14px}h1{font-size:13pt;text-align:center;font-weight:900;margin:6px 0 14px}table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:10pt}th{background:#f3e5f5;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}td.k{background:#fafafa;font-weight:bold;text-align:center;width:80px}h2{font-size:11pt;font-weight:bold;margin:14px 0 5px;color:#6a1b9a;border-left:3px solid #6a1b9a;padding-left:6px}ul{padding-left:20px;margin:3px 0}li{margin:3px 0}.result{color:#1565c0;font-weight:bold}.sign{text-align:right;margin-top:18px;font-size:10pt;line-height:2}</style></head><body><div class="doc-top"><div class="org">○ ○ 초 등 학 교</div><div class="approval"><div class="apv-cell"><div class="apv-label">기록</div><div class="apv-name">이영희</div></div><div class="apv-cell"><div class="apv-label">검토</div><div class="apv-name">박부장</div></div><div class="apv-cell"><div class="apv-label">결재</div><div class="apv-name">김교장</div></div></div></div><hr class="rule"><h1>2026학년도 교원 AI 활용 수업 연수 운영 협의회 회의록</h1><table><tr><td class="k">일시</td><td>2026. 6. 19.(목) 15:30 ~ 17:00</td><td class="k">장소</td><td>교장실</td></tr><tr><td class="k">참석자</td><td colspan="3">교장, 교감, 연구부장, 학년부장 5명, 정보담당 2명 (총 9명)</td></tr><tr><td class="k">불참자</td><td colspan="3">없음</td></tr></table><h2>1. 안건 및 심의결과</h2><ul><li>[안건 1] 2026학년도 교원 AI 활용 수업 역량 강화 연수 운영 계획 심의<br><span class="result">→ 수정 가결</span> (연수 일정 8월 초로 조정, 컴퓨터실 사전 점검 후 확정)</li><li>[안건 2] 외부 강사 선정 및 강사료 예산 심의<br><span class="result">→ 원안 가결</span> (에듀테크 전문 강사 2명 섭외 승인, 1인당 6h × 70,000원)</li></ul><h2>2. 토의 사항</h2><ul><li>시간표: 오전 이론·오후 실습 구성 확정</li><li>연수 효과 측정: 연수 전·후 AI 활용 역량 자가진단 설문 실시하기로 함</li><li>미참석 교원: 녹화본 제공 및 개별 지원 방안 마련</li></ul><h2>3. 기타</h2><ul><li>연수 결과 보고서 9월 중 작성·제출 (연구부장)</li></ul><div class="sign">기록자: 연구부장 이 영 희</div></body></html>`,

  // 홍보자료 — AI 활용 수업 연수 참가 안내 (교직원 대상 card style)
  [DocType.PROMOTION]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;background:#f0f4ff;padding:20px}.card{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.10)}.banner{background:linear-gradient(135deg,#1565c0 0%,#1e88e5 60%,#42a5f5 100%);padding:28px 24px 22px;color:#fff}.banner .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);border-radius:20px;font-size:9pt;padding:2px 12px;margin-bottom:10px}.banner h1{font-size:17pt;font-weight:900;line-height:1.3;margin-bottom:6px}.banner p{font-size:10pt;opacity:.9}.body{padding:18px 20px 14px}.deadline{background:#fff8e1;border:1.5px solid #ffca28;border-radius:10px;padding:10px 16px;text-align:center;font-size:10.5pt;font-weight:bold;color:#e65100;margin-bottom:16px}.section{margin-bottom:14px}.section-title{font-size:10pt;font-weight:bold;color:#1565c0;margin-bottom:7px;display:flex;align-items:center;gap:5px}.section-title::before{content:'';display:block;width:3px;height:13px;background:#1565c0;border-radius:2px}.item{display:flex;align-items:flex-start;gap:8px;padding:5px 0;font-size:10pt;border-bottom:1px solid #f0f0f0}.item:last-child{border-bottom:none}.dot{width:6px;height:6px;border-radius:50%;background:#1e88e5;margin-top:5px;flex-shrink:0}.footer{background:#f5f7ff;padding:10px 20px;text-align:center;font-size:9pt;color:#888;border-top:1px solid #e8eaf6}</style></head><body><div class="card"><div class="banner"><div class="badge">2026학년도 교원 직무연수</div><h1>교원 AI 활용<br>수업 연수</h1><p>○○초등학교 연구부</p></div><div class="body"><div class="deadline">📅 신청: 7. 7.(월) ~ 7. 18.(금) 마감 · 선착순 40명</div><div class="section"><div class="section-title">연수 개요</div><div class="item"><div class="dot"></div><div><b>일시</b>: 2026. 8. 4.(월) ~ 8. 5.(화) 09:00~17:00</div></div><div class="item"><div class="dot"></div><div><b>장소</b>: ○○교육연수원 대강의실 · 컴퓨터실</div></div><div class="item"><div class="dot"></div><div><b>학점</b>: 직무연수 15시간 (1학점) 인정</div></div></div><div class="section"><div class="section-title">주요 프로그램</div><div class="item"><div class="dot"></div><div>생성형 AI(ChatGPT·Gemini) 수업 설계 이론 및 실습</div></div><div class="item"><div class="dot"></div><div>에듀테크 플랫폼(패들렛·클래스팅) 수업 적용</div></div><div class="item"><div class="dot"></div><div>AI 윤리·저작권 교육 및 수업 사례 나눔</div></div></div><div class="section"><div class="section-title">신청 방법</div><div class="item"><div class="dot"></div><div>나이스 연수 시스템 또는 연구부 방문 신청</div></div><div class="item"><div class="dot"></div><div>문의: 연구부 ☎ 02-○○○-○○○○</div></div></div></div><div class="footer">○○초등학교 | 연구부</div></div></body></html>`,

  // 가정통신문 — 자녀 AI 디지털 소양 교육 안내
  [DocType.NEWSLETTER]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;background:#f7f8fc;padding:16px}.wrap{max-width:500px;margin:0 auto}.header{background:#1565c0;color:#fff;border-radius:14px 14px 0 0;padding:18px 20px 14px}.header .meta{font-size:9pt;opacity:.8;margin-bottom:4px}.header h1{font-size:14pt;font-weight:900}.header .date{font-size:9pt;opacity:.75;margin-top:4px}.card{background:#fff;border-radius:0 0 14px 14px;padding:16px 18px 18px;box-shadow:0 2px 10px rgba(0,0,0,.08)}.section{padding:12px 0;border-bottom:1px solid #f0f0f0}.section:last-child{border-bottom:none}.sec-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}.sec-icon{width:28px;height:28px;border-radius:8px;background:#e3f2fd;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}.sec-title{font-size:10.5pt;font-weight:bold;color:#1565c0}.sec-body{font-size:10pt;color:#333;line-height:1.8}.sec-body ul{padding-left:16px}.sec-body li{margin:2px 0}.highlight-box{background:#fff8e1;border-left:3px solid #ffc107;border-radius:0 8px 8px 0;padding:8px 12px;margin:8px 0;font-size:10pt;color:#795548}.footer{text-align:center;font-size:9pt;color:#aaa;margin-top:12px}</style></head><body><div class="wrap"><div class="header"><div class="meta">○○초등학교 가정통신문</div><h1>자녀 AI 디지털 소양 교육 안내</h1><div class="date">2026년 3월 17일 (월)</div></div><div class="card"><div class="section"><div class="sec-header"><div class="sec-icon">🤖</div><div class="sec-title">2022 개정 교육과정의 AI 교육</div></div><div class="sec-body">안녕하세요, 학부모님. 올해부터 2022 개정 교육과정이 전면 적용되어 모든 학년에서 AI·디지털 소양 교육이 강화됩니다. 학생들은 생성형 AI 도구의 원리와 올바른 활용법을 배우게 됩니다.</div></div><div class="section"><div class="sec-header"><div class="sec-icon">📚</div><div class="sec-title">주요 교육 내용</div></div><div class="sec-body"><ul><li>AI가 무엇인지, 어떻게 작동하는지 이해하기</li><li>생성형 AI 도구 올바르게 활용하는 방법</li><li>AI 결과물의 비판적 검토 및 사실 확인</li><li>개인정보·저작권·AI 윤리 실천</li></ul></div></div><div class="section"><div class="sec-header"><div class="sec-icon">🏠</div><div class="sec-title">가정에서의 협력 요청</div></div><div class="sec-body"><div class="highlight-box">AI 도구는 <b>학습 보조 도구</b>입니다. 숙제·과제를 AI에게 맡기기보다 <b>함께 생각하는 도구</b>로 활용하도록 지도 부탁드립니다.</div><ul><li>AI 사용 시간 가정 내 규칙 정하기</li><li>자녀와 함께 AI 결과물 비판적으로 살펴보기</li></ul></div></div></div><div class="footer">○○초등학교 | 교육과정부</div></div></body></html>`,

  // 문자메시지 — AI 연수 일정 안내 (교직원 대상, 카카오 스타일)
  [DocType.MESSAGE]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;background:#b2c7d9;padding:20px;min-height:100vh}.phone{max-width:340px;margin:0 auto;background:#b2c7d9;border-radius:20px;padding:16px 10px;box-shadow:0 4px 20px rgba(0,0,0,.2)}.status-bar{text-align:center;font-size:8pt;color:#fff;margin-bottom:8px;opacity:.8}.chat-header{background:#fff;border-radius:10px 10px 0 0;padding:10px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e0e0e0}.avatar{width:34px;height:34px;border-radius:50%;background:#1565c0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13pt;font-weight:bold}.chat-name{font-size:10.5pt;font-weight:bold;color:#111}.chat-sub{font-size:8.5pt;color:#888}.chat-body{background:#b2c7d9;padding:14px 8px;min-height:160px}.bubble-wrap{display:flex;gap:8px;margin-bottom:12px}.b-avatar{width:30px;height:30px;border-radius:50%;background:#1565c0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10pt;font-weight:bold;flex-shrink:0}.b-name{font-size:8.5pt;color:#555;margin-bottom:3px}.bubble{background:#fff;border-radius:0 12px 12px 12px;padding:10px 13px;font-size:10pt;line-height:1.7;box-shadow:0 1px 3px rgba(0,0,0,.1);max-width:250px}.bubble b{color:#1565c0}.bubble .divider{border:none;border-top:1px dashed #ddd;margin:7px 0}.time{font-size:8pt;color:#888;align-self:flex-end;margin-left:4px}.chat-input{background:#fff;border-radius:0 0 10px 10px;padding:8px 10px;display:flex;gap:6px;align-items:center}.input-box{flex:1;background:#f5f5f5;border-radius:20px;padding:6px 12px;font-size:9.5pt;color:#999}</style></head><body><div class="phone"><div class="status-bar">08:30</div><div class="chat-header"><div class="avatar">홍</div><div><div class="chat-name">홍길동 연구부장</div><div class="chat-sub">○○초등학교</div></div></div><div class="chat-body"><div class="bubble-wrap"><div class="b-avatar">홍</div><div><div class="b-name">홍길동 연구부장</div><div class="bubble">선생님들 안녕하세요! 연구부 홍길동입니다. 😊<hr class="divider"><b>📌 AI 활용 수업 연수 안내</b><br><br>• 일시: 8. 4.(월)~5.(화) 09:00~17:00<br>• 장소: ○○교육연수원<br>• 신청: 7. 18.(금)까지 연구부<br><br>15시간 직무연수 학점 인정! 많은 참여 부탁드려요 🙏</div><div class="time">08:30</div></div></div></div><div class="chat-input"><div class="input-box">메시지 입력...</div></div></div></body></html>`,

  // 공고문 — AI 활용 수업 연수 참가자 모집 공고
  [DocType.GONGGO]: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10.5pt;color:#111;padding:28px 36px;line-height:1.8}.top{text-align:center;border-bottom:3px double #111;padding-bottom:14px;margin-bottom:16px}.school{font-size:10pt;color:#555;margin-bottom:6px}.top h1{font-size:20pt;font-weight:900;letter-spacing:4px;margin-bottom:4px}.top h2{font-size:12pt;font-weight:normal;color:#333}.docnum{font-size:9.5pt;color:#666;margin-top:6px}h3{font-size:11pt;font-weight:bold;margin:14px 0 6px;color:#b71c1c;border-left:3px solid #b71c1c;padding-left:7px}table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:10pt}th{background:#ffebee;border:1px solid #999;padding:5px 8px;font-weight:bold;text-align:center}td{border:1px solid #bbb;padding:5px 8px;vertical-align:top}.tc{text-align:center}ul{padding-left:20px;margin:3px 0}li{margin:3px 0}p{margin:4px 0}.sig{text-align:center;margin-top:36px;font-size:11pt;font-weight:bold;line-height:2.5;border-top:1px solid #ddd;padding-top:18px}.stamp{font-size:9pt;color:#888}</style></head><body><div class="top"><div class="school">○○초등학교</div><h1>공 고</h1><h2>2026학년도 교원 AI 활용 수업 역량 강화 연수 참가자 모집 공고</h2><div class="docnum">○○초 공고 제2026-008호</div></div><h3>1. 목적</h3><p>교원의 AI 활용 수업 역량을 강화하고 2022 개정 교육과정의 디지털 소양 교육을 내실 있게 운영하기 위하여 연수 참가자를 모집합니다.</p><h3>2. 연수 개요</h3><table><tr><th>항목</th><th>내용</th></tr><tr><td>연수명</td><td>2026학년도 교원 AI 활용 수업 역량 강화 직무연수</td></tr><tr><td>일시·장소</td><td>2026. 8. 4.(월) ~ 8. 5.(화) / ○○교육연수원 대강의실</td></tr><tr><td>인정 학점</td><td>직무연수 15시간 (1학점)</td></tr><tr><td>모집 인원</td><td>40명 (선착순)</td></tr></table><h3>3. 신청 일정 및 방법</h3><table><tr><th>구분</th><th>기간</th><th>방법</th></tr><tr><td>참가 신청</td><td class="tc">2026. 7. 7.(월) ~ 7. 18.(금)</td><td>나이스 연수 시스템 또는 연구부 방문</td></tr><tr><td>선발 결과 통보</td><td class="tc">2026. 7. 22.(화)</td><td>개별 문자 통보</td></tr></table><h3>4. 주요 연수 내용</h3><ul><li>생성형 AI(ChatGPT·Gemini) 수업 설계 이론 및 사례</li><li>에듀테크 플랫폼(패들렛·클래스팅) 수업 활용 실습</li><li>AI 윤리·저작권 교육 및 수업 나눔</li></ul><h3>5. 문의</h3><p>연구부 ☎ 02-○○○-○○○○</p><div class="sig">2026년 7월 1일<br>○ ○ 초 등 학 교 장<br><span class="stamp">(직인 생략)</span></div></body></html>`,
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
