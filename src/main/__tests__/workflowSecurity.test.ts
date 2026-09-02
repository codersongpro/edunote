import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { load } from 'js-yaml';

function readWorkflow(name: string): { raw: string; config: any } {
  const filePath = path.resolve(process.cwd(), '.github', 'workflows', name);
  const raw = fs.readFileSync(filePath, 'utf8');
  return { raw, config: load(raw) };
}

function actionUses(config: any): string[] {
  return Object.values(config.jobs as Record<string, any>)
    .flatMap(job => job.steps ?? [])
    .map((step: any) => step.uses)
    .filter((uses: unknown): uses is string => typeof uses === 'string');
}

describe('GitHub Actions 공급망 정책', () => {
  it('CI는 PR에서 읽기 권한으로 검증하고 모든 action을 commit SHA로 고정한다', () => {
    const { config } = readWorkflow('build-win.yml');

    expect(config.on.pull_request).toBeTruthy();
    expect(config.permissions).toEqual({ contents: 'read' });
    expect(actionUses(config).every(uses => /@[0-9a-f]{40}$/.test(uses))).toBe(true);
  });

  it('릴리스는 태그에서만 실행하고 기존 버전 덮어쓰기와 main 직접 push를 하지 않는다', () => {
    const { raw, config } = readWorkflow('release-win.yml');
    const releaseJob = config.jobs.release;

    expect(config.on.push.tags).toEqual(['v*']);
    expect(releaseJob.environment).toBe('release');
    expect(releaseJob.permissions).toMatchObject({
      contents: 'write',
      'id-token': 'write',
      attestations: 'write',
    });
    expect(actionUses(config).every(uses => /@[0-9a-f]{40}$/.test(uses))).toBe(true);
    expect(raw).toContain('gh release view');
    expect(raw).not.toContain('--clobber');
    expect(raw).not.toMatch(/git\s+push/);
  });
});
