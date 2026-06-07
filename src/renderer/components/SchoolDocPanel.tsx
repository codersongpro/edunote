import React, { useState, useRef, useEffect } from 'react';
import { FileText, PenTool, ClipboardList, Wand2, AlertCircle, Layers, FileOutput, ArrowRight, Layout, MessageSquare, Calendar, AlignLeft, AlignJustify, List, CheckCircle, AlertTriangle, Receipt, Users, Megaphone, Mail, Smartphone, Monitor, Megaphone as MegaphoneIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { DocType, GongmunInputs, PlanInputs, ReportInputs, MessageInputs, NewsletterInputs, PumuiInputs, MeetingMinutesInputs, PromotionInputs, GonggoInputs, FileData, GongmunType, MessageTarget, MessageType, MessageRelationship, GongmunComplexity, PumuiType, AppMode } from '../types';
import { generateDocument } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { GeneratedDisplay } from './GeneratedDisplay';
import { LOADING_MESSAGES } from '../constants';
import { useGenerationTracker } from '../hooks/useGenerationTracker';
import { playSuccessSound } from '../lib/soundEffect';
import { stripGeneratedCodeFences } from '../lib/generatedContent';

// ─── Example Documents ───────────────────────────────────────────────────────

const EXAMPLE_DOCS: Partial<Record<DocType, string>> = {
  [DocType.GONGMUN]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; padding: 20px 30px;">  수신 &nbsp;수신자 참조<br>  (경유)<br>  제목 &nbsp;<strong>2026학년도 AI활용 수업 연수계획</strong><br><br>  1. 관련: 창의특수교육과-1234(2026. 3. 2.)「2026학년도 충북GEG 운영 계획」<br>  2. 위 호와 관련하여 2026. 충북GEG 워크숍을 다음과 같이 실시하오니, 각급 학교 및 기관의 교직원이 참여할 수 있도록 안내하여 주시기 바랍니다.<br>  &nbsp;&nbsp;가. 일시: 2026. 4. 18.(토) 10:00 ~ 16:00<br>  &nbsp;&nbsp;나. 장소: 충청북도교육청 교육연구정보원 시청각실<br>  &nbsp;&nbsp;다. 대상: 관내 초·중·고등학교 희망 교원 및 교육전문직원<br>  &nbsp;&nbsp;라. 내용: 구글 교육용 도구를 활용한 미래형 수업 설계 및 에듀테크 실습<br><br>  붙임 &nbsp;2026. 충북GEG 워크숍 운영 계획서 1부. &nbsp;끝.</div></body></html>`,
  [DocType.PLAN]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; max-width: 800px; margin: 0 auto; padding: 20px 30px;">    <!-- 문서 제목 영역 -->    <div style="text-align: center; margin-bottom: 30px;">        <h1 style="font-size: 22pt; font-weight: bold; margin-bottom: 10px;">2026학년도 교원 AI 활용 수업 역량 강화 연수 운영 계획</h1>        <p style="font-size: 14pt; font-style: italic; color: #4b5563; margin: 0;">- AI와 함께 열어가는 미래 교육, 교실 속 디지털 혁신의 첫걸음 -</p>    </div>    <!-- 1. 추진배경 -->    <div style="margin-bottom: 25px;">        <h2 style="font-size: 15pt; font-weight: bold; margin-bottom: 10px;">1. 추진배경</h2>        <div style="margin-left: 10px;">            가. 2022 개정 교육과정 도입에 따른 디지털 소양 교육 강화 및 에듀테크 활용 수업 확대 필요성 증대<br>            나. 인공지능(AI) 기술의 급격한 발전에 발맞추어 교원의 디지털 기반 교수·학습 설계 및 실행 역량 강화 요구<br>            다. 학생 맞춤형 개별화 교육 실현을 위한 교사의 AI 도구 활용 능력 및 에듀테크 활용 수업 전문성 신장 필요        </div>    </div>    <!-- 2. 목적 -->    <div style="margin-bottom: 25px;">        <h2 style="font-size: 15pt; font-weight: bold; margin-bottom: 10px;">2. 목적</h2>        <div style="margin-left: 10px;">            가. AI 및 에듀테크 도구를 활용한 맞춤형 수업 설계 및 평가 역량 강화<br>            나. 교실 수업 개선을 위한 교원 간 공동체적 연구 및 실천 문화 조성<br>            다. 디지털 대전환 시대에 부합하는 미래지향적 공교육 신뢰도 제고        </div>    </div>    <!-- 3. 운영방침 -->    <div style="margin-bottom: 25px;">        <h2 style="font-size: 15pt; font-weight: bold; margin-bottom: 10px;">3. 운영방침</h2>        <div style="margin-left: 10px;">            가. 본 연수는 전 교원을 대상으로 하며, 자발적 참여와 실습 중심의 워크숍 형태로 운영한다.<br>            나. 학교 교육과정 운영에 지장이 없는 방과후 시간 또는 전문적 학습공동체의 날을 활용하여 실시한다.<br>            다. 연수 강사는 AI 교육 분야의 외부 전문가 또는 교내 전문 교사를 초빙하여 전문성을 확보한다.<br>            라. 연수 이수 시간에 대한 상시 연수 학점(직무연수) 인정을 추진한다.        </div>    </div>    <!-- 4. 세부추진계획 -->    <div style="margin-bottom: 25px;">        <h2 style="font-size: 15pt; font-weight: bold; margin-bottom: 10px;">4. 세부추진계획</h2>        <div style="margin-left: 10px;">            가. 연수 개요<br>            &nbsp;&nbsp;1) 일시: 2026년 4월 ~ 6월 (총 3회, 회당 2시간, 총 6시간)<br>            &nbsp;&nbsp;2) 대상: 전 교원<br>            &nbsp;&nbsp;3) 장소: 컴퓨터실 및 각 학년 연구실<br>            &nbsp;&nbsp;4) 방법: 대면 실습 및 토론 중심 워크숍<br>            <br>            나. 회차별 연수 세부 내용            <table border="1" style="border-collapse:collapse; width:100%; color:#000000; border:1px solid black; text-align:center; margin-top:10px; font-size:11pt;">                <thead>                    <tr style="background-color:#f3f4f6; font-weight:bold;">                        <th style="padding:8px; border:1px solid black; width:10%;">회차</th>                        <th style="padding:8px; border:1px solid black; width:15%;">일시</th>                        <th style="padding:8px; border:1px solid black; width:30%;">주제</th>                        <th style="padding:8px; border:1px solid black; width:35%;">주요 내용</th>                        <th style="padding:8px; border:1px solid black; width:10%;">비고</th>                    </tr>                </thead>                <tbody>                    <tr>                        <td style="padding:8px; border:1px solid black;">1회차</td>                        <td style="padding:8px; border:1px solid black;">4월 중</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">AI 교육의 이해와 트렌드</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">- 생성형 AI(ChatGPT, 뤼튼 등) 기초<br>- 교육용 AI 도구의 윤리적 활용 방안</td>                        <td style="padding:8px; border:1px solid black;">외부강사</td>                    </tr>                    <tr>                        <td style="padding:8px; border:1px solid black;">2회차</td>                        <td style="padding:8px; border:1px solid black;">5월 중</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">AI 도구를 활용한 수업 설계</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">- 교과별 AI 활용 수업 지도안 작성 실습<br>- Canva, Gamma 등 시각 자료 제작 도구 활용</td>                        <td style="padding:8px; border:1px solid black;">내부강사</td>                    </tr>                    <tr>                        <td style="padding:8px; border:1px solid black;">3회차</td>                        <td style="padding:8px; border:1px solid black;">6월 중</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">AI 기반 평가 및 피드백</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">- AI 평가 도구를 활용한 과정중심 평가 설계<br>- 학생 맞춤형 피드백 자동화 사례 공유</td>                        <td style="padding:8px; border:1px solid black;">내부강사</td>                    </tr>                </tbody>            </table>        </div>    </div>    <!-- 페이지 분할선 (A4 2장 분량 조절을 위한 페이지 브레이크) -->    <hr style="page-break-after: always; border: none; border-top: 2px dashed #9ca3af; margin: 40px 0;">    <!-- 5. 소요예산 -->    <div style="margin-bottom: 25px;">        <h2 style="font-size: 15pt; font-weight: bold; margin-bottom: 10px;">5. 소요예산</h2>        <div style="margin-left: 10px;">            가. 총 예산액: 금500,000원 (금오십만원)<br>            나. 예산 과목: 학교운영비 - 교원연수운영 - 교원역량강화연수<br>            다. 세부 집행 내역            <table border="1" style="border-collapse:collapse; width:100%; color:#000000; border:1px solid black; text-align:center; margin-top:10px; font-size:11pt;">                <thead>                    <tr style="background-color:#f3f4f6; font-weight:bold;">                        <th style="padding:8px; border:1px solid black; width:20%;">목</th>                        <th style="padding:8px; border:1px solid black; width:20%;">세목</th>                        <th style="padding:8px; border:1px solid black; width:35%;">산출내역</th>                        <th style="padding:8px; border:1px solid black; width:15%;">금액(원)</th>                        <th style="padding:8px; border:1px solid black; width:10%;">비고</th>                    </tr>                </thead>                <tbody>                    <tr>                        <td style="padding:8px; border:1px solid black;">강사료</td>                        <td style="padding:8px; border:1px solid black;">강사수당</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">외부 강사 초빙료 (150,000원 × 2시간)</td>                        <td style="padding:8px; border:1px solid black; text-align:right;">300,000</td>                        <td style="padding:8px; border:1px solid black;">1회차</td>                    </tr>                    <tr>                        <td style="padding:8px; border:1px solid black;">수수료및임차료</td>                        <td style="padding:8px; border:1px solid black;">교재인쇄비</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">연수 교재 및 실습 자료 인쇄 (10,000원 × 10부)</td>                        <td style="padding:8px; border:1px solid black; text-align:right;">100,000</td>                        <td style="padding:8px; border:1px solid black;">자체제작</td>                    </tr>                    <tr>                        <td style="padding:8px; border:1px solid black;">운영비</td>                        <td style="padding:8px; border:1px solid black;">급량비(다과)</td>                        <td style="padding:8px; border:1px solid black; text-align:left;">연수 참석자 다과 및 음료 구매 (5,000원 × 20명)</td>                        <td style="padding:8px; border:1px solid black; text-align:right;">100,000</td>                        <td style="padding:8px; border:1px solid black;">-</td>                    </tr>                    <tr style="background-color:#f9fafb; font-weight:bold;">                        <td colspan="3" style="padding:8px; border:1px solid black; text-align:center;">합 계</td>                        <td style="padding:8px; border:1px solid black; text-align:right;">500,000</td>                        <td style="padding:8px; border:1px solid black;">-</td>                    </tr>                </tbody>            </table>        </div>    </div>    <!-- 6. 기대효과 -->    <div style="margin-bottom: 25px;">        <h2 style="font-size: 15pt; font-weight: bold; margin-bottom: 10px;">6. 기대효과</h2>        <div style="margin-left: 10px;">            가. 교원의 AI 및 에듀테크 활용 능력 향상으로 학생 맞춤형 개별화 수업 활성화<br>            나. 디지털 기반의 다양한 수업 모델 개발 및 적용을 통한 교실 수업의 질적 개선<br>            다. 미래 교육 환경 변화에 능동적으로 대처하는 교원의 전문성 및 자신감 고취        </div>    </div></div></body></html>`,
  [DocType.REPORT]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; max-width:800px; margin:0 auto; padding: 20px 30px;"><div style="text-align:center; margin-bottom:30px;"><h1 style="font-size:22pt; font-weight:bold; margin-bottom:10px;">2026학년도 교원 AI 활용 수업 역량 강화 연수 운영 결과 보고서</h1><p style="font-size:14pt; font-style:italic; color:#4b5563; margin:0;">- AI와 함께 열어가는 미래 교육, 교실 속 디지털 혁신의 첫걸음 -</p></div><div style="margin-bottom:25px;"><h2 style="font-size:15pt; font-weight:bold; margin-bottom:10px;">1. 추진 개요</h2><div style="margin-left:10px;">사업명: 2026학년도 교원 AI 활용 수업 역량 강화 연수 / 기간: 2026. 4. 15. ~ 6. 17. (총 3회, 6시간) / 대상: 전 교원 20명 / 예산: 500,000원 (집행률 100%)</div></div><div style="margin-bottom:25px;"><h2 style="font-size:15pt; font-weight:bold; margin-bottom:10px;">2. 추진 실적</h2><div style="margin-left:10px;"><table border="1" style="border-collapse:collapse; width:100%; border:1px solid black; text-align:center; font-size:11pt;"><thead><tr style="background-color:#f3f4f6; font-weight:bold;"><th style="padding:8px; border:1px solid black; width:30%;">항목</th><th style="padding:8px; border:1px solid black; width:35%;">계획</th><th style="padding:8px; border:1px solid black; width:35%;">결과</th></tr></thead><tbody><tr><td style="padding:8px; border:1px solid black;">운영 횟수</td><td style="padding:8px; border:1px solid black;">3회</td><td style="padding:8px; border:1px solid black;">3회</td></tr><tr><td style="padding:8px; border:1px solid black;">총 연수 시간</td><td style="padding:8px; border:1px solid black;">6시간</td><td style="padding:8px; border:1px solid black;">6시간</td></tr><tr><td style="padding:8px; border:1px solid black;">참여 인원</td><td style="padding:8px; border:1px solid black;">전 교원</td><td style="padding:8px; border:1px solid black;">20명</td></tr></tbody></table></div></div><div style="margin-bottom:25px;"><h2 style="font-size:15pt; font-weight:bold; margin-bottom:10px;">3. 세부 운영 결과</h2><div style="margin-left:10px;">가. 회차별 결과<br><table border="1" style="border-collapse:collapse; width:100%; border:1px solid black; text-align:center; font-size:11pt; margin-top:8px;"><thead><tr style="background-color:#f3f4f6; font-weight:bold;"><th style="padding:8px; border:1px solid black; width:10%;">회차</th><th style="padding:8px; border:1px solid black; width:15%;">일시</th><th style="padding:8px; border:1px solid black; width:30%;">주제</th><th style="padding:8px; border:1px solid black; width:35%;">주요 내용 및 결과</th><th style="padding:8px; border:1px solid black; width:10%;">비고</th></tr></thead><tbody><tr><td style="padding:8px; border:1px solid black;">1회차</td><td style="padding:8px; border:1px solid black;">4.15.(수)</td><td style="padding:8px; border:1px solid black; text-align:left;">AI 교육의 이해와 트렌드</td><td style="padding:8px; border:1px solid black; text-align:left;">- 생성형 AI(ChatGPT, 뤼튼 등) 기초 실습 완료<br>- 교육용 AI 윤리 가이드라인 학습 및 토론 실시</td><td style="padding:8px; border:1px solid black;">외부강사</td></tr><tr><td style="padding:8px; border:1px solid black;">2회차</td><td style="padding:8px; border:1px solid black;">5.20.(수)</td><td style="padding:8px; border:1px solid black; text-align:left;">AI 도구를 활용한 수업 설계</td><td style="padding:8px; border:1px solid black; text-align:left;">- 교과별 AI 활용 수업 지도안 작성 실습 완료<br>- Canva, Gamma 활용 시각 자료 제작 완료</td><td style="padding:8px; border:1px solid black;">내부강사</td></tr><tr><td style="padding:8px; border:1px solid black;">3회차</td><td style="padding:8px; border:1px solid black;">6.17.(수)</td><td style="padding:8px; border:1px solid black; text-align:left;">AI 기반 평가 및 피드백</td><td style="padding:8px; border:1px solid black; text-align:left;">- AI 평가 도구 활용 과정중심 평가 설계 실습<br>- 학생 맞춤형 피드백 자동화 사례 공유 완료</td><td style="padding:8px; border:1px solid black;">내부강사</td></tr></tbody></table><br>나. 연수 운영 사진<table border="1" style="border-collapse:collapse; width:100%; border:1px solid black; text-align:center; font-size:11pt; margin-top:8px;"><tbody><tr><td style="padding:8px; border:1px solid black; width:50%; height:150px; vertical-align:middle; color:#6b7280;">[사진 첨부]<br><br>1회차 생성형 AI 기초 실습 및 윤리 교육 전경</td><td style="padding:8px; border:1px solid black; width:50%; height:150px; vertical-align:middle; color:#6b7280;">[사진 첨부]<br><br>2회차 AI 활용 수업 지도안 작성 및 실습 장면</td></tr><tr><td style="padding:8px; border:1px solid black; height:150px; vertical-align:middle; color:#6b7280;">[사진 첨부]<br><br>3회차 과정중심 평가 도구 실습 및 피드백 공유</td><td style="padding:8px; border:1px solid black; height:150px; vertical-align:middle; color:#6b7280;">[사진 첨부]<br><br>연수 결과 종합 토론 및 소감 발표</td></tr></tbody></table></div></div><hr style="page-break-after:always; border:none; border-top:2px dashed #9ca3af; margin:40px 0;"><div style="margin-bottom:25px;"><h2 style="font-size:15pt; font-weight:bold; margin-bottom:10px;">4. 만족도 조사 결과</h2><div style="margin-left:10px;"><table border="1" style="border-collapse:collapse; width:100%; border:1px solid black; text-align:center; font-size:11pt;"><thead><tr style="background-color:#f3f4f6; font-weight:bold;"><th style="padding:8px; border:1px solid black; width:35%;">조사 항목</th><th style="padding:8px; border:1px solid black; width:20%;">만족도(5점)</th><th style="padding:8px; border:1px solid black; width:45%;">주요 의견</th></tr></thead><tbody><tr><td style="padding:8px; border:1px solid black;">연수 내용의 유익성</td><td style="padding:8px; border:1px solid black;">4.8</td><td style="padding:8px; border:1px solid black; text-align:left;">실제 수업에 바로 적용 가능한 내용 구성 호평</td></tr><tr><td style="padding:8px; border:1px solid black;">강사 전문성 및 진행 방식</td><td style="padding:8px; border:1px solid black;">4.7</td><td style="padding:8px; border:1px solid black; text-align:left;">실습 중심 운영 방식 만족도 높음</td></tr><tr><td style="padding:8px; border:1px solid black;">연수 시간 및 환경</td><td style="padding:8px; border:1px solid black;">4.5</td><td style="padding:8px; border:1px solid black; text-align:left;">연수 시간 확대 및 후속 연수 요구</td></tr><tr style="background-color:#f9fafb; font-weight:bold;"><td style="padding:8px; border:1px solid black;">종합 만족도</td><td style="padding:8px; border:1px solid black;">4.7</td><td style="padding:8px; border:1px solid black; text-align:left;">응답자 20명 기준</td></tr></tbody></table></div></div><div style="margin-bottom:25px;"><h2 style="font-size:15pt; font-weight:bold; margin-bottom:10px;">5. 소요예산 정산</h2><div style="margin-left:10px;">가. 총 집행액: 금500,000원 (금오십만원) — 집행률 100%<br>나. 예산 과목: 학교운영비 - 교원연수운영 - 교원역량강화연수<br>다. 세부 정산 내역<table border="1" style="border-collapse:collapse; width:100%; border:1px solid black; text-align:center; font-size:11pt; margin-top:8px;"><thead><tr style="background-color:#f3f4f6; font-weight:bold;"><th style="padding:8px; border:1px solid black; width:13%;">목</th><th style="padding:8px; border:1px solid black; width:13%;">세목</th><th style="padding:8px; border:1px solid black; width:30%;">산출내역</th><th style="padding:8px; border:1px solid black; width:12%;">계획액(원)</th><th style="padding:8px; border:1px solid black; width:12%;">집행액(원)</th><th style="padding:8px; border:1px solid black; width:10%;">잔액(원)</th><th style="padding:8px; border:1px solid black; width:10%;">비고</th></tr></thead><tbody><tr><td style="padding:8px; border:1px solid black;">강사료</td><td style="padding:8px; border:1px solid black;">강사수당</td><td style="padding:8px; border:1px solid black; text-align:left;">외부 강사 초빙료 (150,000원 × 2시간)</td><td style="padding:8px; border:1px solid black; text-align:right;">300,000</td><td style="padding:8px; border:1px solid black; text-align:right;">300,000</td><td style="padding:8px; border:1px solid black; text-align:right;">0</td><td style="padding:8px; border:1px solid black;">1회차</td></tr><tr><td style="padding:8px; border:1px solid black;">수수료</td><td style="padding:8px; border:1px solid black;">교재인쇄비</td><td style="padding:8px; border:1px solid black; text-align:left;">연수 교재 및 실습 자료 인쇄 (10,000원 × 10부)</td><td style="padding:8px; border:1px solid black; text-align:right;">100,000</td><td style="padding:8px; border:1px solid black; text-align:right;">100,000</td><td style="padding:8px; border:1px solid black; text-align:right;">0</td><td style="padding:8px; border:1px solid black;">자체제작</td></tr><tr><td style="padding:8px; border:1px solid black;">운영비</td><td style="padding:8px; border:1px solid black;">급량비</td><td style="padding:8px; border:1px solid black; text-align:left;">연수 참석자 다과 및 음료 (5,000원 × 20명)</td><td style="padding:8px; border:1px solid black; text-align:right;">100,000</td><td style="padding:8px; border:1px solid black; text-align:right;">100,000</td><td style="padding:8px; border:1px solid black; text-align:right;">0</td><td style="padding:8px; border:1px solid black;">-</td></tr><tr style="background-color:#f9fafb; font-weight:bold;"><td colspan="3" style="padding:8px; border:1px solid black; text-align:center;">합 계</td><td style="padding:8px; border:1px solid black; text-align:right;">500,000</td><td style="padding:8px; border:1px solid black; text-align:right;">500,000</td><td style="padding:8px; border:1px solid black; text-align:right;">0</td><td style="padding:8px; border:1px solid black;">-</td></tr></tbody></table></div></div><div style="margin-bottom:25px;"><h2 style="font-size:15pt; font-weight:bold; margin-bottom:10px;">6. 운영 성과 및 제언</h2><div style="margin-left:10px;">가. 운영 성과<br>&nbsp;&nbsp;1) 전 교원(20명) 대상 3회 연수 완료, 직무연수 6시간 이수 처리 완료하였음.<br>&nbsp;&nbsp;2) AI 수업 설계 실습을 통해 교과별 AI 활용 지도안 20종 이상 개발하였음.<br>&nbsp;&nbsp;3) 연수 후 참여 교원의 85%가 수업 내 AI 도구 활용 의향을 밝혔음.<br>나. 제언 및 향후 계획<br>&nbsp;&nbsp;1) 일회성 연수에 그치지 않도록 교내 전문적 학습공동체와 연계한 지속적 수업 나눔 및 모니터링이 필요함.<br>&nbsp;&nbsp;2) 하반기에는 교과별 특성에 맞춘 심화 과정(AI 디지털교과서 활용 구체화) 연수 개설을 검토할 필요가 있음.</div></div></div></body></html>`,
  [DocType.PUMUI]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; padding: 20px; max-width: 800px; margin: 0 auto;">  <div style="text-align: center; font-size: 20pt; font-weight: bold; margin-bottom: 30px; letter-spacing: 10px;">지출품의서</div>  <div style="line-height: 2.0; margin-bottom: 20px;">    1. 관련: 창의특수교육과-1234(2026.5.24.)<br>    2. 2026. AI수업 역량강화 연수 운영을 위해 다음과 같이 물품을 구입하고자 합니다.<br>    &nbsp;&nbsp;가. 내역: 2026. AI수업 역량강화 연수 운영 물품<br>    &nbsp;&nbsp;나. 용도: 교원 역량 강화<br>    &nbsp;&nbsp;다. 소요예산: 금500,000원 (금오십만원)<br>    &nbsp;&nbsp;라. 산출내역: 노트 100개 * 3,000원 + 펜 100개 * 2,000원 = 500,000원<br><br>    붙임 &nbsp;지출품의서 1부. &nbsp;끝.  </div></div></body></html>`,
  [DocType.MEETING_MINUTES]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; padding: 20px;">  <div style="text-align:right; font-size:11pt; font-weight:bold; margin-bottom:10px;"><br></div>  <div style="text-align:center; font-size:22pt; font-weight:bold; margin-bottom:30px; letter-spacing:2px;">2026. AI수업 역량강화 연수 운영 협의</div><div style="text-align:center; font-size:22pt; font-weight:bold; margin-bottom:30px; letter-spacing:2px;"><span style="font-size: 14.6667px; text-align: right;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 충북초등학교</span></div>  <table border="1" style="border-collapse:collapse; width:100%; color:#000000; border:1px solid black; font-size:12pt;">    <tbody><tr style="height:45px;">      <td style="width:15%; text-align:center; background-color:#f3f4f6; font-weight:bold; border:1px solid black;">일 시</td>      <td style="width:35%; padding-left:15px; border:1px solid black;">2026. 5. 24.(일) <br>15:30 ~ 16:30</td>      <td style="width:15%; text-align:center; background-color:#f3f4f6; font-weight:bold; border:1px solid black;">장 소</td>      <td style="width:35%; padding-left:15px; border:1px solid black;">교무실</td>    </tr>    <tr style="height:45px;">      <td style="text-align:center; background-color:#f3f4f6; font-weight:bold; border:1px solid black;">출석위원</td>      <td colspan="3" style="padding-left:15px; border:1px solid black;">교장, 교감, 교무부장, 연구부장, 정보부장 (총 5명)</td>    </tr>    <tr style="height:45px;">      <td style="text-align:center; background-color:#f3f4f6; font-weight:bold; border:1px solid black;">회의안건</td>      <td colspan="3" style="padding-left:15px; font-weight:bold; border:1px solid black;">2026. AI수업 역량강화 연수 운영 적절성 검토</td>    </tr>    <tr style="height:40px;">      <td colspan="4" style="text-align:center; background-color:#e5e7eb; font-weight:bold; border:1px solid black; letter-spacing:4px;">회 의 내 용</td>    </tr>    <tr>      <td style="text-align:center; background-color:#f3f4f6; font-weight:bold; vertical-align:middle; padding:15px; border:1px solid black;">정보<br>부장</td>      <td colspan="3" style="padding:15px; line-height:1.6; border:1px solid black; text-align:justify;">        금일 협의회는 '2026학년도 AI수업 역량강화 연수' 운영 계획의 적절성을 검토하고, 교원의 디지털 기반 교수학습 역량을 효과적으로 지원하기 위해 마련되었습니다. 이번 연수는 단순 이론 강의를 탈피하여 생성형 AI 및 AI 코스웨어를 활용한 실습 중심의 교육과정으로 기획하였습니다. 연수 일정, 강사 구성 및 운영 방식의 적절성에 대해 고견을 부탁드립니다.      </td>    </tr>    <tr>      <td style="text-align:center; background-color:#f3f4f6; font-weight:bold; vertical-align:middle; padding:15px; border:1px solid black;">연구<br>부장</td>      <td colspan="3" style="padding:15px; line-height:1.6; border:1px solid black; text-align:justify;">        제시해주신 연수 프로그램을 보니 최근 교육과정 개정 방향과 우리 학교의 디지털 교육 환경에 매우 부합합니다. 특히 교사들이 직접 노트북을 활용해 수업 설계안을 작성해보는 실습 중심의 운영 방식이 매우 적절하다고 생각합니다. 다만, 교사들의 디지털 기기 활용 숙련도 편차를 고려하여 실습 시 도움을 줄 수 있는 보조 인력이나 멘토 교사를 지정해 운영하면 연수 효과가 더욱 극대화될 것입니다.      </td>    </tr>    <tr>      <td style="text-align:center; background-color:#f3f4f6; font-weight:bold; vertical-align:middle; padding:15px; border:1px solid black;">교무<br>부장</td>      <td colspan="3" style="padding:15px; line-height:1.6; border:1px solid black; text-align:justify;">        연수 일정이 6월 중 전문적 학습공동체의 날(수요일 오후)로 계획되어 있어, 수업 결손 없이 전 교원이 안정적으로 참여하기에 매우 적절한 시기입니다. 연수 당일 교무실 및 행정실과의 긴밀한 협조를 통해 무선 네트워크 환경을 사전 점검하고 멀티탭 등 기자재를 충분히 확보하여 연수 운영에 차질이 없도록 행정적 지원을 아끼지 않겠습니다.      </td>    </tr>    <tr>      <td style="text-align:center; background-color:#f3f4f6; font-weight:bold; vertical-align:middle; padding:15px; border:1px solid black;">교감</td>      <td colspan="3" style="padding:15px; line-height:1.6; border:1px solid black; text-align:justify;">        AI 시대에 교원의 디지털 역량 강화는 학교 교육력 제고를 위한 필수 과제입니다. 이번 연수 운영 방식은 교사들의 실제적인 수업 설계 능력을 키우는 데 매우 적합하게 설계되었습니다. 연수 이후에도 교사들이 수업 시간에 AI 도구를 적극적으로 활용할 수 있도록, 우수 수업 사례를 공유하는 사후 피드백 기회를 마련해 주시기 바라며, 관련 예산은 적극 지원하겠습니다.      </td>    </tr>    <tr>      <td style="text-align:center; background-color:#f3f4f6; font-weight:bold; vertical-align:middle; padding:15px; border:1px solid black;">교장</td>      <td colspan="3" style="padding:15px; line-height:1.6; border:1px solid black; text-align:justify;">        모든 위원님들의 긍정적인 검토와 건설적인 제안에 감사드립니다. 이번 'AI수업 역량강화 연수'는 우리 충북초등학교 교원들이 미래 교육을 선도하는 역량을 갖추는 데 중요한 디딤돌이 될 것입니다. 제안해주신 실습 보조 인력 활용 및 사후 사례 공유 방안을 적극 반영하여 연수 계획을 최종 확정해 주시기 바랍니다. 학교 차원에서도 교원 역량 강화를 위한 행·재정적 지원을 아끼지 않겠습니다. 정보부장님께서는 오늘 협의된 내용을 바탕으로 연수 준비에 만전을 기해 주시기 바랍니다.      </td>    </tr>    <tr style="height:60px;">      <td colspan="4" style="text-align:center; font-weight:bold; background-color:#f9fafb; border:1px solid black; font-size:11pt; color:#4b5563;">        ※ 본 협의회 결과는 업무관리시스템 결재로 서명을 대신함.      </td>    </tr>  </tbody></table></div></body></html>`,
  [DocType.PROMOTION]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; max-width:800px; margin:0 auto; padding:20px;">  <!-- 보도자료 헤더 -->  <div style="text-align:center; margin-bottom:30px;">    <span style="font-size:16pt; font-weight:bold; color:#2563eb; border:1px solid #2563eb; padding:5px 15px; display:inline-block; margin-bottom:15px;">보도자료</span>    <h1 style="font-size:22pt; font-weight:bold; margin:10px 0; line-height:1.3;">충북초등학교, ‘2026 교원 AI·에듀테크 역량 강화 워크숍’ 성료</h1>    <p style="font-size:14pt; color:#4b5563; margin-top:5px;">- 생성형 AI(ChatGPT·Gemini) 활용 수업 설계부터 에듀테크 실습, AI 윤리 교육까지 미래 교육 선도 -</p>  </div>  <table border="1" style="border-collapse:collapse; width:100%; color:#000000; border:1px solid #cbd5e1; margin-bottom:30px; font-size:11pt;">    <tbody><tr>      <td style="background-color:#f1f5f9; padding:10px; font-weight:bold; width:15%; text-align:center;">배포일시</td>      <td style="padding:10px; width:35%;">2026년 8월 5일(수) 즉시 배포 가능</td>      <td style="background-color:#f1f5f9; padding:10px; font-weight:bold; width:15%; text-align:center;">담당부서</td>      <td style="padding:10px; width:35%;">충북초등학교 정보과학부</td>    </tr>    <tr>      <td style="background-color:#f1f5f9; padding:10px; font-weight:bold; text-align:center;">문의처</td>      <td style="padding:10px;">교무실 (043-XXX-XXXX)</td>      <td style="background-color:#f1f5f9; padding:10px; font-weight:bold; text-align:center;">담당자</td>      <td style="padding:10px;">교사 OOO</td>    </tr>  </tbody></table>  <!-- 본문 도입 -->  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    충북초등학교(교장 OOO)는 지난 8월 4일(월)부터 5일(화)까지 이틀간 교내 컴퓨터실 및 다목적실에서 전 교원과 지역사회 교육 관계자들을 대상으로 ‘2026학년도 교원 AI·에듀테크 역량 강화 워크숍’을 성공적으로 개최했다고 밝혔다.   </p>  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    이번 워크숍은 급변하는 디지털 대전환 시대를 맞아 교원들의 생성형 AI 및 에듀테크 활용 역량을 강화하고, 이를 실제 초등 교육과정에 효과적으로 융합하여 학생 맞춤형 미래 교육을 실현하기 위해 마련되었다. 이틀간 매일 오전 9시부터 오후 5시까지 집중 연수 형태로 진행된 이번 행사에는 충북초등학교 전 교원뿐만 아니라 미래 교육에 관심이 높은 지역사회 교육 관계자들도 함께 참여하여 뜨거운 열기 속에 진행되었다.  </p>  <!-- 본문 전개 1 -->  <h2 style="font-size:15pt; font-weight:bold; border-left:5px solid #2563eb; padding-left:10px; margin:30px 0 15px 0;">■ 생성형 AI 활용 수업 설계 및 에듀테크 플랫폼 실습 집중 교육</h2>  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    워크숍 첫째 날인 4일에는 생성형 AI의 교육적 활용을 주제로 한 이론 및 실습 교육이 집중적으로 이루어졌다. 참가자들은 대표적인 생성형 AI 플랫폼인 ChatGPT와 Gemini의 기본 개념과 작동 원리를 이해하고, 이를 활용한 맞춤형 수업 설계법을 학습했다. 교사들은 개별 교과 및 학생들의 발달 단계에 맞는 최적의 프롬프트(명령어) 작성법을 실습하며, 학생들의 창의성과 비판적 사고력을 자극할 수 있는 혁신적인 수업 계획안을 직접 설계하는 시간을 가졌다.  </p>  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    이어 오후 세션에서는 학교 현장에서 즉각적으로 활용 가능한 대표적인 에듀테크 플랫폼인 패들렛(Padlet)과 클래스팅(Classting)의 수업 적용 실무 훈련이 진행되었다. 교사들은 플랫폼을 활용한 실시간 협업 학습 환경 구축, 온라인 포트폴리오 제작, 학생 맞춤형 피드백 제공 등 디지털 도구를 활용한 상호작용 중심의 수업 운영 노하우를 직접 체험하며 역량을 다졌다.  </p>  <hr style="page-break-after: always; border: none; border-top: 2px dashed #9ca3af; margin: 40px 0;">  <!-- 본문 전개 2 -->  <h2 style="font-size:15pt; font-weight:bold; border-left:5px solid #2563eb; padding-left:10px; margin:30px 0 15px 0;">■ AI 윤리·저작권 교육 및 현장 중심의 수업 사례 나눔</h2>  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    둘째 날인 5일에는 기술적 활용을 넘어 올바른 디지털 시민성을 기르기 위한 AI 윤리 및 저작권 교육이 심도 있게 다뤄졌다. 인공지능 생성물의 저작권 귀속 문제, 표절 예방, 개인정보 보호 등 교실에서 발생할 수 있는 실제적인 윤리적 쟁점들에 대해 전문가 특강과 토론이 이어졌다. 이를 통해 교사들은 학생들이 안전하고 책임감 있게 AI 기술을 활용할 수 있도록 지도하는 구체적인 방안을 정립했다.  </p>  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    워크숍의 대미는 교사들이 직접 개발한 AI 활용 수업 사례를 공유하는 ‘수업 사례 나눔’ 세션이 장식했다. 참가자들은 워크숍 기간 동안 설계한 수업 안을 발표하고 서로 피드백을 주고받으며 수업의 완성도를 높였다. 이 자리에는 지역사회 관계자들도 동참하여 학교와 지역사회가 함께하는 미래 교육 생태계 조성 방안에 대해 심도 있는 의견을 교환했다.  </p>  <!-- 본문 결론 및 인터뷰 -->  <h2 style="font-size:15pt; font-weight:bold; border-left:5px solid #2563eb; padding-left:10px; margin:30px 0 15px 0;">■ "미래 교육의 발판 마련"... 교원 및 학교장 소감</h2>  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    이번 워크숍에 참여한 충북초등학교 OOO 교사는 “평소 생성형 AI를 수업에 어떻게 적용해야 할지 막막했는데, 이번 연수를 통해 ChatGPT와 Gemini를 활용한 구체적인 수업 설계법을 익힐 수 있어 매우 즐겁고 의미 있는 시간이었다”라며, “새 학기에는 학생들이 에듀테크 플랫폼을 통해 더 주도적으로 학습에 참여할 수 있도록 수업을 구성해 보겠다”라고 소감을 전했다.  </p>  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    충북초등학교 OOO 교장은 “이번 워크숍은 우리 학교가 디지털 대전환 시대의 미래 교육을 선도하는 중요한 발판이 되었다”라며, “교사들의 열정적인 참여 덕분에 학교의 교육 경쟁력이 한층 더 발전되었음을 느낀다. 앞으로도 교원들이 디지털 역량을 마음껏 펼칠 수 있도록 행·재정적 지원을 아끼지 않겠다”라고 강조했다.  </p>  <p style="text-indent:20px; margin-bottom:20px; text-align:justify;">    충북초등학교는 이번 워크숍에서 도출된 다양한 수업 설계안과 에듀테크 활용 사례를 실제 교육과정에 적극 반영할 예정이며, 앞으로도 지속적인 교원 연수와 지역사회 협력을 통해 미래형 학교 모델을 구축해 나갈 계획이다.  </p>  <div style="text-align:center; margin-top:40px; font-weight:bold; color:#4b5563;">    &lt;끝&gt;  </div>  <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 40px 0;">  <!-- SNS 홍보용 요약 -->  <div style="background-color:#f8fafc; border:1px solid #e2e8f0; padding:25px; border-radius:8px;">    <h3 style="font-size:14pt; font-weight:bold; color:#0f172a; margin-top:0; margin-bottom:15px; display:flex; align-items:center;">      <span style="background-color:#3b82f6; color:#ffffff; padding:2px 8px; border-radius:4px; font-size:10pt; margin-right:8px;">SNS 홍보용 요약</span>      🤖 충북초등학교, AI·에듀테크 워크숍 현장 속으로! 🚀    </h3>    <p style="margin:0 0 15px 0; font-size:12pt; line-height:1.7; color:#334155;">      안녕하세요, 충북초등학교 가족 여러분! 💕<br>      우리 학교 선생님들이 여름방학에도 뜨거운 열정으로 뭉쳤습니다! 🔥<br><br>      지난 8월 4일부터 5일까지 이틀간, 미래 교육을 준비하는 <strong>'2026 교원 AI·에듀테크 역량 강화 워크숍'</strong>이 열렸답니다. 💻✨<br><br>      🤖 <strong>선생님들은 무엇을 배웠을까요?</strong><br>      • ChatGPT와 Gemini를 활용한 똑똑한 수업 설계법! 📝<br>      • 패들렛, 클래스팅 등 에듀테크 플랫폼 실무 실습! 💻<br>      • 안전하고 올바른 AI 윤리 및 저작권 교육! ⚖️<br>      • 선생님들의 톡톡 튀는 수업 사례 나눔까지! 💡<br><br>      선생님들의 반짝이는 아이디어와 열정 덕분에 우리 충북초등학교가 한 단계 더 멋지게 발전했음을 느낄 수 있는 시간이었어요. 👍<br>      새 학기, 더욱 재미있고 유익해질 AI 활용 수업을 많이 기대해 주세요! 😍    </p>    <p style="margin:0; font-size:11pt; color:#2563eb; font-weight:bold;">      #충북초등학교 #AI교육 #에듀테크 #미래교육 #선생님응원해요    </p>  </div></div></body></html>`,
  [DocType.NEWSLETTER]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; padding: 20px; max-width: 800px; margin: 0 auto;">  <!-- 제목 영역 -->  <div style="text-align: center; margin-bottom: 40px;">    <span style="font-size: 24pt; font-weight: bold; border-bottom: 2px solid #000000; padding-bottom: 5px;">가 정 통 신 문</span>  </div>  <!-- 수신 및 일련번호 -->  <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 11pt;">    <div>[제 2026-015호]</div>    <div>담당부서: 정보과학부</div>  </div>  <!-- 제목 -->  <div style="text-align: center; margin-bottom: 40px;">    <span style="font-size: 18pt; font-weight: bold;">2026학년도 AI 디지털 소양 교육 안내</span>  </div>  <!-- 인사말 -->  <div style="margin-bottom: 25px; text-align: justify;">    학부모님, 안녕하십니까?<br>    새로운 희망으로 가득 찬 2026학년도 새 봄을 맞이하여 학부모님 가정에 늘 건강과 행복이 가득하시기를 기원합니다. 아울러 평소 학교 교육 발전을 위해 따뜻한 관심과 성원을 보내주시는 학부모님께 깊은 감사의 말씀을 드립니다.  </div>  <div style="margin-bottom: 25px; text-align: justify;">    최근 인공지능(AI) 기술의 급격한 발전은 우리의 일상과 교육 환경에 큰 변화를 가져오고 있습니다. 이에 우리 학교에서는 학생들이 디지털 대전환 시대를 주도할 주체적이고 책임감 있는 시민으로 성장할 수 있도록 <strong>'AI 디지털 소양 교육'</strong>을 실시하고자 합니다.   </div>  <div style="margin-bottom: 35px; text-align: justify;">    이번 교육은 학생들이 단순히 기술을 사용하는 소비자에 머무는 것이 아니라, AI의 원리를 이해하고 올바르게 활용할 수 있는 역량을 기르는 데 초점을 맞추고 있습니다. 가정에서도 자녀들이 올바른 디지털 습관을 형성할 수 있도록 아래의 교육 내용을 참고하시어 많은 관심과 지도 편달을 부탁드립니다.  </div>  <!-- 본문 (핵심 안내) -->  <div style="background-color: #f9f9f9; border: 1px solid #e0e0e0; padding: 25px; margin-bottom: 35px; border-radius: 5px;">    <div style="text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; color: #1a365d;">      [ AI 디지털 소양 교육 주요 내용 ]    </div>        <table border="1" style="border-collapse:collapse; width:100%; color:#000000; border:1px solid #cbd5e1; background-color: #ffffff;">      <thead>        <tr style="background-color: #f1f5f9;">          <th style="padding: 12px; width: 30%; font-weight: bold; border: 1px solid #cbd5e1;">교육 영역</th>          <th style="padding: 12px; width: 70%; font-weight: bold; border: 1px solid #cbd5e1;">세부 교육 내용</th>        </tr>      </thead>      <tbody>        <tr>          <td style="padding: 12px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1;">AI의 이해와 원리</td>          <td style="padding: 12px; border: 1px solid #cbd5e1; line-height: 1.5;">            - 인공지능(AI)의 개념 및 발전 과정 이해하기<br>            - 데이터 학습과 알고리즘 등 AI의 기본 작동 원리 파악하기          </td>        </tr>        <tr>          <td style="padding: 12px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1;">생성형 AI의 올바른 활용</td>          <td style="padding: 12px; border: 1px solid #cbd5e1; line-height: 1.5;">            - 생성형 AI 도구(챗봇, 이미지 생성 등)의 특징 이해하기<br>            - 학습 및 문제 해결을 위한 효과적인 질문(프롬프트) 작성법 실습          </td>        </tr>        <tr>          <td style="padding: 12px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1;">비판적 검토 및 사실 확인</td>          <td style="padding: 12px; border: 1px solid #cbd5e1; line-height: 1.5;">            - AI가 생성한 결과물의 오류(환각 현상 등) 가능성 인지하기<br>            - 정보의 출처를 확인하고 비판적으로 검증하는 태도 기르기          </td>        </tr>        <tr>          <td style="padding: 12px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1;">AI 윤리 및 저작권 준수</td>          <td style="padding: 12px; border: 1px solid #cbd5e1; line-height: 1.5;">            - AI 활용 과정에서의 개인정보 보호 수칙 준수하기<br>            - 타인의 저작권 존중 및 AI 창작물의 올바른 인용 방법 실천          </td>        </tr>      </tbody>    </table>  </div>  <!-- 가정에서의 지도 사항 -->  <div style="margin-bottom: 35px;">    <div style="font-weight: bold; font-size: 14pt; margin-bottom: 10px;">■ 가정 내 지도 협조 사항</div>    <div style="margin-left: 10px; line-height: 1.8;">      1. 자녀가 생성형 AI를 사용할 때 개인정보(이름, 주소, 학교명 등)를 입력하지 않도록 지도해 주십시오.<br>      2. AI가 제공하는 답변이 항상 사실은 아님을 알려주시고, 중요한 정보는 반드시 교과서나 백과사전 등을 통해 교차 검증하도록 독려해 주십시오.<br>      3. 과제 수행 시 AI의 결과물을 그대로 복사하여 제출하지 않고, 자녀의 생각과 의견을 더해 주도적으로 학습할 수 있도록 이끌어 주십시오.    </div>  </div>  <!-- 맺음말 -->  <div style="margin-bottom: 50px; text-align: justify;">    본 교육을 통해 우리 학생들이 디지털 기술을 안전하고 유익하게 활용하는 지혜로운 인재로 성장할 수 있도록 학교에서도 최선을 다해 지도하겠습니다. 학부모님들의 지속적인 관심과 협조를 부탁드립니다. 감사합니다.  </div>  <!-- 날짜 및 발신인 -->  <div style="text-align: center; margin-top: 50px; margin-bottom: 20px;">    <span style="font-size: 14pt; font-weight: bold;">2026년 3월 16일</span>  </div>  <div style="text-align: center; margin-top: 30px; font-size: 18pt; font-weight: bold; letter-spacing: 5px;">    O O 초 등 학 교 장 <span style="font-size: 14pt; font-weight: normal; letter-spacing: 0px;">(직인생략)</span>  </div></div></body></html>`,
  [DocType.MESSAGE]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; max-width:600px; margin:0 auto; padding:20px; border:1px solid #dddddd;"><div style="text-align:center; margin-bottom:20px;"><span style="font-size:16pt; font-weight:bold; border-bottom:2px solid #000000; padding-bottom:5px;">[2026학년도 학부모 알림 문자 메시지(LMS) 안]</span></div><div style="background-color:#f9f9f9; border:1px solid #cccccc; padding:20px; white-space:pre-wrap; font-family:'Courier New', Courier, monospace; line-height:1.8;">[○○학교/AI 디지털 소양 교육 안내]

안녕하세요, 학부모님.
2026학년도 미래 인재 양성을 위한 '학부모 AI 디지털 소양 교육'을 아래와 같이 안내해 드립니다.

급변하는 디지털 시대에 자녀의 올바른 디지털 기기 사용과 AI 기술 이해를 돕기 위한 유익한 연수이오니 학부모님의 많은 관심과 참여를 부탁드립니다.

1. 교육 주제: 학부모가 알아야 할 AI 디지털 소양 및 올바른 디지털 자녀 지도법
2. 일시: 2026년 ○월 ○일(요일) 14:00 ~ 16:00
3. 장소: 본교 시청각실 (또는 온라인 Zoom 실시간 연수)
4. 대상: 본교 희망 학부모
5. 신청 방법: 가정통신문 앱을 통한 온라인 신청
6. 신청 기한: 2026년 ○월 ○일(요일)까지

※ 원활한 행사 준비를 위해 기한 내 신청해 주시기 바랍니다.
※ 문의: ○○학교 교무실(02-XXX-XXXX)</div></div></body></html>`,
  [DocType.GONGGO]: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body><div style="font-family:'Dotum',sans-serif; font-size:13pt; line-height:1.6; color:#000000; padding: 20px 30px;">    <div style="text-align:center; font-size:20pt; font-weight:bold; margin-bottom:20px;">AI 디지털 소양 교육 강사 채용 공고</div>    <div style="text-align:right; margin-bottom:5px;">미래고등학교 공고 제2026-001호</div>    <div style="text-align:right; margin-bottom:30px;">2025년 11월 1일</div>    <p style="margin-top:0; margin-bottom:15px;">2026학년도 AI 디지털 소양 교육의 원활한 운영을 위하여 역량 있는 강사를 다음과 같이 채용 공고합니다.</p>    <p style="margin-left:0; text-indent:0;">1. 공고 목적</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;가. 2026학년도 AI 디지털 소양 교육의 효율적인 운영 및 학생들의 디지털 역량 강화</p>    <p style="margin-left:0; text-indent:0;">2. 채용 분야 및 인원</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;가. 분야: AI 디지털 소양 교육 강사</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;나. 인원: 0명</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;다. 계약 기간: 2026년 3월 1일 ~ 2027년 2월 28일 (1년)</p>    <p style="margin-left:0; text-indent:0;">3. 지원 자격</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;가. 해당 분야 전문성 및 강의 경험이 풍부한 자</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;나. 교원 자격증 소지자 우대</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;다. 국가공무원법 제33조 각 호의 결격사유에 해당하지 않는 자</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;라. 학생 지도에 대한 열정과 책임감을 가진 자</p>    <p style="margin-left:0; text-indent:0;">4. 근무 조건</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;가. 근무 기간: 2026년 3월 1일 ~ 2027년 2월 28일 (1년)</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;나. 강의 시간: 주당 0~0시간 (학교 교육과정 운영에 따라 협의)</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;다. 강사료: 시간당 00,000원 (학교 예산 범위 내에서 책정)</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;라. 근무 내용: AI 디지털 소양 교육 수업 운영 및 관련 업무</p>    <p style="margin-left:0; text-indent:0;">5. 전형 방법</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;가. 1차 서류 전형</p>    <p style="margin-left:40px; text-indent:0;">&nbsp;&nbsp;&nbsp;&nbsp;1) 제출 서류를 바탕으로 심사</p>    <p style="margin-left:40px; text-indent:0;">&nbsp;&nbsp;&nbsp;&nbsp;2) 합격자 개별 통보</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;나. 2차 면접 전형 (1차 합격자에 한함)</p>    <p style="margin-left:40px; text-indent:0;">&nbsp;&nbsp;&nbsp;&nbsp;1) 서류 전형 합격자에 한하여 면접 실시</p>    <p style="margin-left:40px; text-indent:0;">&nbsp;&nbsp;&nbsp;&nbsp;2) 전문성, 교수 역량, 인성 등 종합 평가</p>    <hr style="page-break-after: always; border: none; border-top: 2px dashed #9ca3af; margin: 40px 0;">    <p style="margin-left:0; text-indent:0;">6. 제출 서류</p>    <p style="margin-bottom:10px;">&nbsp;&nbsp;가. 다음 서류를 제출하여 주시기 바랍니다.</p>    <table border="1" style="border-collapse:collapse;width:100%;color:#000000;border:1px solid black; margin-bottom:20px;">        <thead>            <tr>                <th style="padding:8px; border:1px solid black; text-align:center; background-color:#f2f2f2; width:10%;">번호</th>                <th style="padding:8px; border:1px solid black; text-align:center; background-color:#f2f2f2; width:60%;">서류명</th>                <th style="padding:8px; border:1px solid black; text-align:center; background-color:#f2f2f2; width:30%;">비고</th>            </tr>        </thead>        <tbody>            <tr>                <td style="padding:8px; border:1px solid black; text-align:center;">1</td>                <td style="padding:8px; border:1px solid black;">지원서 (소정 양식)</td>                <td style="padding:8px; border:1px solid black; text-align:center;">1부</td>            </tr>            <tr>                <td style="padding:8px; border:1px solid black; text-align:center;">2</td>                <td style="padding:8px; border:1px solid black;">자기소개서 (자유 양식)</td>                <td style="padding:8px; border:1px solid black; text-align:center;">1부</td>            </tr>            <tr>                <td style="padding:8px; border:1px solid black; text-align:center;">3</td>                <td style="padding:8px; border:1px solid black;">최종학력증명서</td>                <td style="padding:8px; border:1px solid black; text-align:center;">1부</td>            </tr>            <tr>                <td style="padding:8px; border:1px solid black; text-align:center;">4</td>                <td style="padding:8px; border:1px solid black;">경력증명서 (해당자에 한함)</td>                <td style="padding:8px; border:1px solid black; text-align:center;">1부</td>            </tr>            <tr>                <td style="padding:8px; border:1px solid black; text-align:center;">5</td>                <td style="padding:8px; border:1px solid black;">자격증 사본 (해당자에 한함)</td>                <td style="padding:8px; border:1px solid black; text-align:center;">1부</td>            </tr>            <tr>                <td style="padding:8px; border:1px solid black; text-align:center;">6</td>                <td style="padding:8px; border:1px solid black;">개인정보 수집·이용 동의서</td>                <td style="padding:8px; border:1px solid black; text-align:center;">1부</td>            </tr>        </tbody>    </table>    <p style="margin-left:0; text-indent:0;">7. 접수 기간 및 방법</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;가. 접수 기간: 2025.11.04.(월) 09:00 ~ 2025.11.08.(금) 16:00</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;나. 접수 방법: 이메일 접수 (mirae@mirae.go.kr) 또는 본교 교무실 방문 접수</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;다. 유의 사항: 마감 시간 이후 접수 불가</p>    <p style="margin-left:0; text-indent:0;">8. 합격자 발표</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;가. 1차 서류 전형 합격자: 2025.11.11.(월) 개별 통보</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;나. 최종 합격자: 2025.11.15.(금) 개별 통보</p>    <p style="margin-left:0; text-indent:0;">9. 유의 사항</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;가. 제출된 서류는 일체 반환하지 않으며, 기재된 내용이 사실과 다를 경우 채용을 취소할 수 있습니다.</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;나. 응시원서 등에 허위 기재 또는 기재 착오, 구비 서류 미제출 등으로 인한 불이익은 응시자 본인의 책임으로 합니다.</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;다. 본 공고에 명시되지 않은 사항은 본교의 결정에 따릅니다.</p>    <p style="margin-left:20px; text-indent:0;">&nbsp;&nbsp;라. 채용 예정 인원 미달 또는 적격자가 없을 경우 채용하지 않을 수 있습니다.</p>    <p style="margin-top:30px; margin-bottom:5px;">문의처: 미래고등학교 교무실 (02-1234-5678)</p>    <p style="text-align:right; margin-top:30px; margin-bottom:50px;">2025년 11월 1일</p>    <p style="text-align:right; margin-bottom:0;"><b>미래고등학교장 [직인]</b></p></div></body></html>`,
};

// ─── SchoolDocPanel ──────────────────────────────────────────────────────────

interface SchoolDocPanelProps {
  initialTab?: DocType;
}

interface SettingsProfile {
  institution: string;
}

interface DocTemplateFavorite {
  id: string;
  docType: DocType;
  title: string;
  text: string;
  createdAt: string;
}

const DOC_TEMPLATE_FAVORITES_KEY = 'edunote_doc_template_favorites_v1';

export const SchoolDocPanel: React.FC<SchoolDocPanelProps> = ({ initialTab }) => {
  const { startGeneration, endGeneration } = useGenerationTracker(AppMode.SCHOOL_DOC);
  const [activeTab, setActiveTab] = useState<DocType>(initialTab ?? DocType.GONGMUN);
  const [settingsProfile, setSettingsProfile] = useState<SettingsProfile>({
    institution: '',
  });

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inputPanelCollapsed, setInputPanelCollapsed] = useState(false);
  const currentSchoolYear = (() => { const now = new Date(); return String(now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear()); })();
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear);
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
  const [templateFavorites, setTemplateFavorites] = useState<DocTemplateFavorite[]>([]);
  const [hwpxFillDataByTab, setHwpxFillDataByTab] = useState<Record<DocType, any[] | null>>(initTabMap(null));
  const [contentByTab, setContentByTab] = useState<Record<DocType, string>>(initTabMap(''));

  const uploadedFiles = filesByTab[activeTab] ?? [];
  const uploadedTemplates = templatesByTab[activeTab] ?? [];
  const templateText = templateTextByTab[activeTab] ?? '';
  const generatedContent = contentByTab[activeTab] ?? '';
  const hwpxFillData = hwpxFillDataByTab[activeTab] ?? null;
  const activeTemplateFavorites = templateFavorites.filter(item => item.docType === activeTab);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DOC_TEMPLATE_FAVORITES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setTemplateFavorites(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTemplateFavorites([]);
    }
  }, []);

  const saveTemplateFavorites = (next: DocTemplateFavorite[]) => {
    localStorage.setItem(DOC_TEMPLATE_FAVORITES_KEY, JSON.stringify(next.slice(0, 20)));
    setTemplateFavorites(next.slice(0, 20));
  };

  const handleSaveTemplateFavorite = () => {
    const text = templateText.trim();
    if (!text) return;
    const title = window.prompt('템플릿 이름을 입력하세요.', text.split('\n')[0]?.slice(0, 30) || '문서 템플릿');
    if (!title) return;
    const now = new Date();
    saveTemplateFavorites([
      { id: `${now.getTime()}`, docType: activeTab, title, text, createdAt: now.toISOString() },
      ...templateFavorites,
    ]);
  };

  const handleLoadTemplateFavorite = (id: string) => {
    const favorite = templateFavorites.find(item => item.id === id);
    if (!favorite) return;
    setTemplateTextByTab(prev => ({ ...prev, [activeTab]: favorite.text }));
  };

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
    topic: '',
    target: '',
    budget: '',
    extraInfo: '',
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
  const [msgSubTab, setMsgSubTab] = useState<'sms' | 'social'>('sms');

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

  // Load saved user info from config on mount
  useEffect(() => {
    Promise.all([
      window.electronAPI.getConfig('institution'),
      window.electronAPI.getConfig('schoolName'),
    ]).then(([institution, schoolName]) => {
      const school = String(institution || schoolName || '');
      setSettingsProfile({
        institution: school,
      });
      setMeetingMinutesData(prev => ({ ...prev, schoolName: prev.schoolName || school }));
      setPromotionData(prev => ({ ...prev, schoolName: prev.schoolName || school }));
    });
  }, []);

  useEffect(() => {
    const handler = () => setIsGenerating(false);
    window.addEventListener('edunote-generation-reset', handler);
    return () => window.removeEventListener('edunote-generation-reset', handler);
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
        return `[공문 유형]: 내부결재\n[제목]: ${gongmunData.title || '(미입력)'}\n[본문 요청사항]: ${gongmunData.bodyContext || '(미입력)'}`;
      }
      case DocType.PLAN:
        return `[주제/사업명]: ${planData.topic}\n[대상]: ${planData.target}\n[예산]: ${planData.budget}\n[추가 사항]: ${planData.extraInfo}`;
      case DocType.REPORT:
        return `[주제/사업명]: ${reportData.topic}\n[대상]: ${reportData.target}\n[예산]: ${reportData.budget}\n[운영 결과 및 주요 내용]: ${reportData.summary}\n[추가 사항]: ${reportData.extraInfo}`;
      case DocType.NEWSLETTER:
        return `[제목]: ${newsletterData.title}\n[대상]: ${newsletterData.target}\n[내용]: ${newsletterData.context}`;
      case DocType.MESSAGE: {
        if (msgSubTab === 'social') {
          let msgCtx = `[유형]: 소통 메세지\n[나와의 관계]: ${messageData.relationship}\n[작성 내용]: ${messageData.context}`;
          if (messageData.isReply && messageData.receivedMessage.trim()) {
            msgCtx += `\n[답장 생성]: 예\n[받은 메시지]: ${messageData.receivedMessage}`;
          }
          return msgCtx;
        }
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

  const buildProfileContext = (): string => {
    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const lines = [
      `학년도: ${schoolYear}학년도`,
      `오늘 날짜: ${today}`,
      settingsProfile.institution ? `소속기관: ${settingsProfile.institution}` : '',
    ].filter(Boolean);
    return `[참고 기본정보]\n${lines.join('\n')}\n위 정보는 문서 맥락상 필요한 경우에만 반영하세요.`;
  };

  const buildContextWithProfile = (): string => {
    const profileContext = buildProfileContext();
    const promptContext = buildPromptContext();
    return [profileContext, promptContext].filter(Boolean).join('\n\n');
  };

  // ─── Get HWPX data for template filling ───────────────────────────────────

  const getHwpxTitleFromContent = (content: string, tab: DocType): string => {
    let title = '';
    if (tab === DocType.GONGMUN) title = gongmunData.title;
    else if (tab === DocType.PLAN) title = planData.topic;
    else if (tab === DocType.REPORT) title = reportData.topic || reportData.summary.substring(0, 30);
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
    if (si === -1 || ei === -1 || ei <= si) return { cleanContent: stripGeneratedCodeFences(raw), fillData: null };
    const jsonStr = raw.substring(si + START.length, ei).trim();
    const cleanContent = stripGeneratedCodeFences(raw.substring(0, si));
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
          buildProfileContext(),
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
        const context = buildContextWithProfile();
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
      playSuccessSound();
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
    { type: DocType.MEETING_MINUTES, icon: Users, label: '협의록 작성' },
    { type: DocType.PROMOTION, icon: Megaphone, label: '보도자료 작성' },
    { type: DocType.NEWSLETTER, icon: Mail, label: '가정통신문 작성' },
    { type: DocType.MESSAGE, icon: Smartphone, label: '메세지' },
    { type: DocType.GONGGO, icon: MegaphoneIcon, label: '공고문 작성' },
  ];

  // ─── Style helpers ─────────────────────────────────────────────────────────

  const inputClass = 'w-full px-3 py-2 text-sm border border-[#E7E5E4] dark:border-[#2E2822] rounded-md bg-white dark:bg-[#171210] text-[#1C1917] dark:text-[#F0EBE6] placeholder-[#A8A29E] dark:placeholder-[#6B5E57] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-xs font-semibold text-[#78716C] dark:text-[#9C8F87] mb-1 uppercase tracking-wide';
  const sectionClass = 'mb-4';

  // ─── Render ────────────────────────────────────────────────────────────────

  const hwpxTemplateFile = uploadedTemplates.length > 0 ? uploadedTemplates[0].file : undefined;
  const previewHtml = EXAMPLE_DOCS[activeTab]?.replace(
    /<body([^>]*)>/i,
    `<body$1 style="margin:0; background:#f3f4f6; color:#000000; padding:24px;">
      <style>
        .edunote-doc-page{max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:22mm 18mm;box-sizing:border-box;box-shadow:0 8px 24px rgba(15,23,42,.16);word-break:keep-all;overflow-wrap:break-word;}
        .edunote-doc-page table{width:100%;border-collapse:collapse;margin:10pt 0 14pt;}
        .edunote-doc-page th,.edunote-doc-page td{padding:8pt 10pt;vertical-align:middle;}
        .edunote-doc-page p{margin:0 0 8pt;line-height:1.75;}
      </style>
      <div class="edunote-doc-page">`,
  )?.replace(/<\/body>/i, '</div></body>');

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#171210]">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left: input panel */}
        {inputPanelCollapsed && (
          <div className="w-11 shrink-0 bg-white dark:bg-[#221E1B] rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm flex justify-center py-3">
            <button
              onClick={() => setInputPanelCollapsed(false)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1] dark:hover:bg-[#2A2420] transition-colors"
              title="입력 패널 펼치기"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
        {!inputPanelCollapsed && (
        <div className="w-[420px] shrink-0 bg-white dark:bg-[#221E1B] rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="bg-[#FAF9F7] dark:bg-[#171210] border-b border-[#EDE8E1] dark:border-[#2E2822] px-4 py-3 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#44403C] dark:text-[#F0EBE6] flex items-center gap-2">
                <PenTool className="w-4 h-4 text-blue-500" />
                입력 정보
              </h3>
              <button
                onClick={() => setInputPanelCollapsed(true)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#EDE8E1] dark:border-[#2E2822] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#EDE8E1] dark:hover:bg-[#2A2420] transition-colors"
                title="입력 패널 접기"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
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

            <hr className="border-[#EDE8E1] dark:border-[#2E2822]" />

            {/* Dynamic form by tab */}

            {/* 공문서 */}
            {activeTab === DocType.GONGMUN && (
              <div className="space-y-4">
                <div className={sectionClass}>
                  <label className={labelClass}>공문 복잡도</label>
                  <div className="flex gap-2">
                    {[
                      { val: GongmunComplexity.SIMPLE, label: '간단', tooltip: '관련·시행문·붙임으로 구성.\n"붙임과 같이 실시합니다." 형식의 짧고 간결한 공문.' },
                      { val: GongmunComplexity.MEDIUM, label: '중간', tooltip: '관련·본문·개요(가/나/다 3~4항목)·붙임으로 구성.\n일정·장소·대상 등 기본 정보가 담긴 일반 공문.' },
                      { val: GongmunComplexity.DETAILED, label: '상세', tooltip: '관련·본문·개요·행정사항(표 포함)·붙임으로 구성.\n세부 일정·역할 분담·예산 등 내용이 많은 공문.' },
                    ].map(opt => (
                      <div key={opt.val} className="flex-1 relative group">
                        <button
                          onClick={() => setGongmunData({ ...gongmunData, complexity: opt.val })}
                          className={`w-full py-1.5 text-xs rounded-md border transition-all ${
                            gongmunData.complexity === opt.val
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 px-2.5 py-2 text-[11px] leading-relaxed text-white bg-[#1C1917] dark:bg-[#2E2822] rounded-lg shadow-lg hidden group-hover:block z-20 pointer-events-none whitespace-pre-line">
                          {opt.tooltip}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#1C1917] dark:border-b-[#2E2822]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>제목 (건명)</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 AI활용 수업 연수계획" value={gongmunData.title} onChange={e => setGongmunData({ ...gongmunData, title: e.target.value })} />
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
                  <label className={labelClass}>주제 / 사업명</label>
                  <input type="text" className={inputClass} placeholder="예: 2026학년도 독서교육 활성화 운영 결과 보고" value={reportData.topic} onChange={e => setReportData({ ...reportData, topic: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>대상</label>
                  <input type="text" className={inputClass} placeholder="예: 전교생, 3학년, 교직원, 참여 학생 120명" value={reportData.target} onChange={e => setReportData({ ...reportData, target: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>예산 / 집행액 (원)</label>
                  <input type="text" className={inputClass} placeholder="예: 계획액 1,500,000원 / 집행액 1,480,000원" value={reportData.budget} onChange={e => setReportData({ ...reportData, budget: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>운영 결과 및 주요 내용</label>
                  <textarea className={`${inputClass} min-h-[140px] resize-none`} placeholder="행사명, 일시, 장소, 참여 인원, 운영 내용, 주요 성과, 만족도, 개선 사항 등을 입력하세요." value={reportData.summary} onChange={e => setReportData({ ...reportData, summary: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>추가 사항 (선택)</label>
                  <textarea className={`${inputClass} min-h-[100px] resize-none`} placeholder="보고서에 포함되어야 할 특이사항, 사진 설명, 차기 계획, 정산 참고사항 등을 자유롭게 입력하세요." value={reportData.extraInfo} onChange={e => setReportData({ ...reportData, extraInfo: e.target.value })} />
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
                            : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
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

            {/* 협의록 */}
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

            {/* 보도자료 */}
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

            {/* 메세지 */}
            {activeTab === DocType.MESSAGE && (
              <div className="space-y-4">
                {/* 서브탭 */}
                <div className="flex rounded-lg border border-[#EDE8E1] dark:border-[#2E2822] overflow-hidden">
                  {([
                    { key: 'sms' as const, label: '문자' },
                    { key: 'social' as const, label: '소통메세지' },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => { setMsgSubTab(tab.key); setMessageData(d => ({ ...d, isReply: false, context: '', receivedMessage: '' })); }}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                        msgSubTab === tab.key
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#9C8F87] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 문자 (SMS/LMS) */}
                {msgSubTab === 'sms' && (
                  <>
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
                                : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
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
                                : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-2 border-t border-[#EDE8E1] dark:border-[#2E2822]">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={messageData.isReply}
                          onChange={e => setMessageData({ ...messageData, isReply: e.target.checked })}
                          className="w-4 h-4 rounded border-[#E7E5E4] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0]">답장 생성</span>
                      </label>
                      <span className="text-xs text-[#A8A29E] dark:text-[#6B5E57]">받은 메시지에 대한 답장을 생성합니다.</span>
                    </div>
                    {messageData.isReply && (
                      <div className="space-y-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-3">
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
                                    : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
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
                      <textarea
                        className={`${inputClass} min-h-[100px] resize-none`}
                        placeholder={messageData.isReply ? '답장에 포함할 내용이나 요청사항을 입력하세요. (비워도 됩니다)' : '문자에 담을 내용을 입력하세요.'}
                        value={messageData.context}
                        onChange={e => setMessageData({ ...messageData, context: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* 소통메세지 */}
                {msgSubTab === 'social' && (
                  <>
                    <div>
                      <label className={labelClass}>나와의 관계</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[MessageRelationship.SUPERIOR, MessageRelationship.COLLEAGUE, MessageRelationship.PARENT, MessageRelationship.STUDENT, MessageRelationship.FRIEND].map(r => (
                          <button
                            key={r}
                            onClick={() => setMessageData({ ...messageData, relationship: r })}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                              messageData.relationship === r
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-[#171210] text-[#78716C] dark:text-[#C4B8B0] border-[#E7E5E4] dark:border-[#2E2822] hover:border-blue-400'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-2 border-t border-[#EDE8E1] dark:border-[#2E2822]">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={messageData.isReply}
                          onChange={e => setMessageData({ ...messageData, isReply: e.target.checked })}
                          className="w-4 h-4 rounded border-[#E7E5E4] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0]">답장 생성</span>
                      </label>
                      <span className="text-xs text-[#A8A29E] dark:text-[#6B5E57]">받은 메시지에 대한 답장을 생성합니다.</span>
                    </div>
                    {messageData.isReply && (
                      <div className="space-y-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-3">
                        <label className={labelClass}>받은 메시지</label>
                        <textarea
                          className={`${inputClass} min-h-[80px] resize-none`}
                          placeholder="답장할 메시지를 붙여넣기 하세요."
                          value={messageData.receivedMessage}
                          onChange={e => setMessageData({ ...messageData, receivedMessage: e.target.value })}
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelClass}>{messageData.isReply ? '답장 내용 / 추가 요청사항' : '작성 내용 / 요청사항'}</label>
                      <textarea
                        className={`${inputClass} min-h-[100px] resize-none`}
                        placeholder={messageData.isReply ? '답장에 포함할 내용이나 요청사항을 입력하세요.' : '메세지의 목적이나 내용을 입력하세요.'}
                        value={messageData.context}
                        onChange={e => setMessageData({ ...messageData, context: e.target.value })}
                      />
                    </div>
                  </>
                )}
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

            <hr className="border-[#EDE8E1] dark:border-[#2E2822]" />

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
                <div className="mt-2 grid gap-2">
                  <button
                    type="button"
                    onClick={handleSaveTemplateFavorite}
                    disabled={!templateText.trim()}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:text-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900"
                  >
                    현재 양식 즐겨찾기 저장
                  </button>
                  {activeTemplateFavorites.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={e => {
                        handleLoadTemplateFavorite(e.target.value);
                        e.currentTarget.value = '';
                      }}
                      className="w-full rounded-md border border-[#E7E5E4] dark:border-[#2E2822] bg-white dark:bg-[#221E1B] px-2 py-1.5 text-xs text-[#44403C] dark:text-[#C4B8B0]"
                    >
                      <option value="">저장한 양식 불러오기</option>
                      {activeTemplateFavorites.map(item => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-200">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="px-4 py-3 border-t border-[#EDE8E1] dark:border-[#2E2822] bg-[#FAF9F7] dark:bg-[#171210] shrink-0">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                isGenerating
                  ? 'bg-[#E7E5E4] dark:bg-[#2E2822] text-[#78716C] dark:text-[#9C8F87] cursor-not-allowed'
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
                   activeTab === DocType.MEETING_MINUTES ? '협의록 생성' :
                   activeTab === DocType.PROMOTION ? '보도자료 생성' :
                   activeTab === DocType.NEWSLETTER ? '가정통신문 생성' :
                   activeTab === DocType.MESSAGE ? '메세지 생성' :
                   activeTab === DocType.GONGGO ? '공고문 생성' :
                   '문서 생성'}
                </>
              )}
            </button>
          </div>
        </div>
        )}

        {/* Right: output panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {generatedContent ? (
            <GeneratedDisplay
              content={generatedContent}
              hwpxFillData={hwpxFillData}
              hwpxTemplate={hwpxTemplateFile}
            />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#221E1B] rounded-lg border border-[#E7E5E4] dark:border-[#2E2822] shadow-sm">
              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <svg className="animate-spin w-8 h-8 text-blue-500 mb-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="text-sm font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-1">문서를 생성하는 중...</p>
                  <p className="text-sm text-[#A8A29E] dark:text-[#6B5E57]">{loadingMessage}</p>
                </div>
              ) : EXAMPLE_DOCS[activeTab] ? (
                <>
                  <div className="shrink-0 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 px-4 py-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-200 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full uppercase tracking-wide">예시 문서</span>
                    <span className="text-xs text-blue-500 dark:text-blue-300">정보를 입력하고 생성하면 아래와 유사한 형식으로 만들어집니다.</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      srcDoc={previewHtml}
                      sandbox=""
                      className="w-full h-full border-0 bg-white"
                      title="예시 문서"
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-full mb-4">
                    <FileText className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-[#44403C] dark:text-[#C4B8B0] mb-2">문서를 생성해 주세요</h3>
                  <p className="text-sm text-[#A8A29E] dark:text-[#6B5E57] max-w-xs">
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
