import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { atomicWriteJsonSync } from '../atomicFile';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('atomicWriteJsonSync', () => {
  it('기존 JSON을 교체하고 임시 파일을 남기지 않는다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edunote-atomic-test-'));
    tempDirs.push(dir);
    const target = path.join(dir, 'data.json');
    fs.writeFileSync(target, '{"before":true}', 'utf8');

    atomicWriteJsonSync(target, { after: true });

    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({ after: true });
    expect(fs.readdirSync(dir)).toEqual(['data.json']);
  });

  it('직렬화가 실패하면 기존 파일을 변경하지 않는다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edunote-atomic-test-'));
    tempDirs.push(dir);
    const target = path.join(dir, 'data.json');
    fs.writeFileSync(target, '{"before":true}', 'utf8');
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => atomicWriteJsonSync(target, circular)).toThrow();
    expect(fs.readFileSync(target, 'utf8')).toBe('{"before":true}');
    expect(fs.readdirSync(dir)).toEqual(['data.json']);
  });
});
