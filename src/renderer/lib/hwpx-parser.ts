import JSZip from "jszip";

export interface HwpxFillNode {
  idx: number;
  value: string;
}

export async function extractTextFromHwpx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const sectionFiles = Object.keys(zip.files).filter((name) =>
      /^Contents\/section\d+\.xml$/i.test(name)
    );

    if (sectionFiles.length === 0) {
      return "[알림: HWPX 파일 내에서 본문(Contents/section.xml)을 찾을 수 없습니다.]";
    }

    // Sort section files numerically
    sectionFiles.sort((a, b) => {
      const numA = parseInt(a.match(/section(\d+)/i)?.[1] || "0");
      const numB = parseInt(b.match(/section(\d+)/i)?.[1] || "0");
      return numA - numB;
    });

    let fullText = "[HWPX 구조화된 텍스트 노드 목록]\n";
    let globalIdx = 0;
    let foundText = false;

    for (const sectionPath of sectionFiles) {
      const sectionFile = zip.file(sectionPath);
      if (!sectionFile) continue;

      const xml = await sectionFile.async("string");
      
      // Extract <hp:t> tags globally to match the replacement logic
      const tMatches = xml.match(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g);
      
      if (tMatches) {
        for (const tMatch of tMatches) {
          const contentMatch = tMatch.match(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/);
          let content = contentMatch ? contentMatch[1] : "";
          
          content = content.replace(/<[^>]*>?/gm, "")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");

          // Even if content is empty, we must increment the index to stay synced for fillHwpxTemplate
          if (content.trim()) {
            fullText += `[${globalIdx}] "${content}"\n`;
            foundText = true;
          } else {
             // For empty/whitespace tags, we still show them as (빈칸) if we want Gemini to replace them
             fullText += `[${globalIdx}] (빈칸)\n`;
          }
          globalIdx++;
        }
      }
    }

    if (!foundText) {
      return "[알림: HWPX 파일에서 텍스트를 추출하지 못했습니다. 문서가 이미지로만 구성되어 있거나 특수한 형식일 수 있습니다.]";
    }

    return fullText;
  } catch (error: any) {
    // HWPX 파일이 아닌 경우 (예: HWP 파일을 확장자만 바꾼 경우, 혹은 파일 손상 등)
    return `[알림: 문서에서 텍스트를 추출할 수 없습니다. 
- 파일이 구형 HWP(바이너리) 형식일 경우 추출이 제한될 수 있습니다. 가능하면 HWPX 또는 PDF로 변환하여 업로드해 주세요.
- 파일이 손상되었을 수 있습니다.
AI는 문서의 파일명(${file.name})은 인지하지만, 내용은 정확히 분석하지 못할 수 있습니다.]`;
  }
}

export async function fillHwpxTemplate(file: File, fillData: HwpxFillNode[]): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const sectionFiles = Object.keys(zip.files).filter((name) =>
    /^Contents\/section\d+\.xml$/i.test(name)
  );

  let globalIdx = 0;
  
  sectionFiles.sort((a, b) => {
    const numA = parseInt(a.match(/section(\d+)/i)?.[1] || "0");
    const numB = parseInt(b.match(/section(\d+)/i)?.[1] || "0");
    return numA - numB;
  });

  const fillMap = new Map<number, string>();
  fillData.forEach(item => fillMap.set(Number(item.idx), item.value));

  for (const sectionPath of sectionFiles) {
    const sectionFile = zip.file(sectionPath);
    if (!sectionFile) continue;

    let xml = await sectionFile.async("string");
    
    xml = xml.replace(/(<hp:t[^>]*>)([\s\S]*?)(<\/hp:t>)/g, (match, openTag, content, closeTag) => {
      const currentIdx = globalIdx++;
      if (fillMap.has(currentIdx)) {
        let newValue = String(fillMap.get(currentIdx))
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;')
          .replace(/\n/g, '&#10;');
        
        return `${openTag}${newValue}${closeTag}`;
      }
      return match;
    });

    zip.file(sectionPath, xml);
  }

  return await zip.generateAsync({ type: "blob" });
}


