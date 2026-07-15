# 오픈소스 라이선스 고지 (Third-Party Notices)

EduNote는 아래 오픈소스 소프트웨어를 사용합니다. 각 구성요소는 해당
라이선스 조건에 따라 배포되며, 원저작권자에게 감사드립니다. 아래 목록에
직접 명시된 패키지 외에도, 이들이 의존하는 하위(전이) 패키지가 각자의
라이선스(대부분 MIT·ISC·BSD·Apache-2.0)로 함께 포함됩니다.

---

## 사용 패키지 목록

### Apache License 2.0

- **@google/genai** — Copyright Google LLC — https://github.com/googleapis/js-genai
- **firebase** (및 @firebase/*, @grpc/*, google-auth-library, gaxios 등 관련 구성요소) — Copyright Google LLC — https://github.com/firebase/firebase-js-sdk
- **hwpxlib** — Copyright Neolord0 및 기여자 — https://github.com/neolord0/hwpxlib
  - EduNote의 `src/main/hwpxSkeleton.ts`에 포함된 빈 HWPX 문서 골격(base64)은
    hwpxlib 프로젝트의 테스트 픽스처(`testFile/tool/blank.hwpx`)에서 파생한 것입니다.

### MIT License

- **react**, **react-dom** — Copyright (c) Meta Platforms, Inc. and affiliates — https://github.com/facebook/react
- **electron-store** — Copyright (c) Sindre Sorhus — https://github.com/sindresorhus/electron-store
- **qrcode** — Copyright (c) 2012 Ryan Day — https://github.com/soldair/node-qrcode
- **@xmldom/xmldom** — Copyright 2019-present Christopher J. Brody 및 기여자 — https://github.com/xmldom/xmldom
- **react-markdown** — Copyright (c) Espen Hovlandsdal — https://github.com/remarkjs/react-markdown
- **remark**, **remark-gfm**, **remark-rehype**, **rehype-stringify** — Copyright (c) Titus Wormer — https://github.com/remarkjs / https://github.com/rehypejs
- **jszip** — Copyright (c) 2009-2016 Stuart Knightley 및 기여자 — https://github.com/Stuk/jszip
  - jszip은 MIT 또는 GPLv3 듀얼 라이선스이며, EduNote는 **MIT 라이선스**를 선택해 사용합니다.

### ISC License

- **lucide-react** — Copyright (c) Lucide Contributors 2022 (Feather 유래 부분은 Copyright (c) 2013-2022 Cole Bemis) — https://github.com/lucide-icons/lucide

### MIT AND Zlib License

- **pako** — Copyright (C) 2014-2017 Vitaly Puzrin and Andrei Tuputcyn — https://github.com/nodeca/pako
  - (jszip의 하위 의존성으로 포함)

### SIL Open Font License 1.1

- **Pretendard** (@fontsource/pretendard로 포함) — Copyright (c) 2021 Kil Hyung-jin, with Reserved Font Name 'Pretendard' — https://github.com/orioncactus/pretendard
  - Pretendard는 Adobe의 Source Sans(Copyright 2014-2021 Adobe, with Reserved Font Name 'Source')에서 파생되었습니다.

---

이 앱은 Electron 런타임 위에서 동작하며, Electron 및 그에 포함된
Chromium·Node.js 등의 구성요소는 각자의 라이선스로 배포됩니다. 해당
라이선스 전문은 배포 패키지에 함께 포함된 Electron 라이선스 파일을
참고하십시오.

---

## 라이선스 전문

### Apache License 2.0

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   전문: http://www.apache.org/licenses/LICENSE-2.0
```

### MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### ISC License

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### zlib License (pako)

```
This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

### SIL Open Font License, Version 1.1

```
Copyright (c) 2021, Kil Hyung-jin (https://github.com/orioncactus/pretendard),
with Reserved Font Name 'Pretendard'.
Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is available with a FAQ at: https://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply to any
document created using the fonts or their derivatives.

전문: https://scripts.sil.org/OFL
```
