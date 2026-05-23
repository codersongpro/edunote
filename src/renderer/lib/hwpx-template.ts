import JSZip from "jszip";

export type HwpxTemplateData = Record<string, string>;

function escapeXml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeSafeFilename(name: string) {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

export function getHwpxFilename(title?: string) {
  const base = title?.trim() ? title.trim() : "AI_생성문서";
  return `${makeSafeFilename(base)}.hwpx`;
}

/**
 * HWPX 템플릿 내부의 {{key}}를 data[key]로 치환합니다.
 *
 * 핵심 원칙:
 * - HWPX 구조 전체를 새로 만들지 않습니다.
 * - 기존 양식의 Contents/section*.xml 안 텍스트만 치환합니다.
 * - 표, 글꼴, 여백, 스타일은 템플릿 파일을 그대로 유지합니다.
 */
export async function fillHwpxTemplate(
  templateBuffer: ArrayBuffer,
  data: HwpxTemplateData
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBuffer);

  const sectionFiles = Object.keys(zip.files).filter((name) =>
    /^Contents\/section\d+\.xml$/.test(name)
  );

  if (sectionFiles.length === 0) {
    throw new Error("HWPX 템플릿에서 Contents/section*.xml 파일을 찾지 못했습니다.");
  }

  for (const sectionPath of sectionFiles) {
    const file = zip.file(sectionPath);
    if (!file) continue;

    let xml = await file.async("string");

    for (const [key, rawValue] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      const value = escapeXml(rawValue ?? "");

      xml = xml.split(placeholder).join(value);
    }

    zip.file(sectionPath, xml);
  }

  const result = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });

  return result;
}
