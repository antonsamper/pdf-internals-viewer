import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error Node ESM scripts have no declaration file.
import { AREAS, MAX_LENGTH, commitSubjectProblem, titleProblem } from '../scripts/check-title.mjs';

const script = resolve('scripts/check-title.mjs');

const run = (args: string[], options: { actions?: boolean; path?: string } = {}) => {
  return spawnSync(process.execPath, [options.path ?? script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: options.actions ? 'true' : '' },
  });
};

describe('titleProblem', () => {
  it.each(AREAS as string[])('accepts the %s scope', (area) => {
    expect(titleProblem(`[PIV-1] feat(${area}): add page-text search`)).toBeUndefined();
  });

  it.each([
    ['no scope', '[PIV-1] chore: remove comments'],
    ['an empty scope', '[PIV-1] chore(): remove comments'],
    ['an unknown scope', '[PIV-1] feat(parser): add a parser'],
    ['an uppercase scope', '[PIV-1] feat(Repo): add a parser'],
    ['an unknown type', '[PIV-1] build(infra): add a parser'],
    ['an uppercase summary', '[PIV-1] feat(site): add PDF guide'],
    ['a full stop', '[PIV-1] feat(site): add a guide.'],
    ['no ticket', 'feat(site): add a guide'],
  ])('rejects %s', (_, title) => {
    expect(titleProblem(title)).toMatch(/must match/);
  });

  it('allows the length limit and rejects one character more', () => {
    const title = '[PIV-1] chore(infra): ';
    expect(titleProblem(title + 'a'.repeat(MAX_LENGTH - title.length))).toBeUndefined();
    expect(titleProblem(title + 'a'.repeat(MAX_LENGTH + 1 - title.length))).toMatch(/characters/);
  });
});

describe('commitSubjectProblem', () => {
  it('checks the first paragraph that is not a comment', () => {
    expect(commitSubjectProblem('# Please enter the commit message\n\n[PIV-1] fix(search): keep the note \n\nBody\n')).toBeUndefined();
    expect(commitSubjectProblem('add page-text search\n# [PIV-1] fix(search): keep the note\n')).toMatch(/must match/);
  });

  it('checks every line of the first paragraph, as git joins them into the subject', () => {
    expect(commitSubjectProblem('[PIV-1] fix(search): keep the note\nAnd More\n')).toMatch(/must match/);
  });

  it('rejects an empty message', () => {
    expect(commitSubjectProblem('# Only comments\n')).toMatch(/must match/);
  });

  it.each([
    "Merge branch 'main' into PIV-1",
    "Merge remote-tracking branch 'origin/main' into PIV-1",
    'Revert "[PIV-1] fix(search): keep the note"',
    'Reapply "[PIV-1] fix(search): keep the note"',
    'fixup! [PIV-1] fix(search): keep the note',
    'squash! [PIV-1] fix(search): keep the note',
    'amend! [PIV-1] fix(search): keep the note',
  ])('skips the subject git writes: %s', (subject) => {
    expect(commitSubjectProblem(`${subject}\n`)).toBeUndefined();
  });

  it('checks a hand-written subject that only starts like a merge', () => {
    expect(commitSubjectProblem('Merge the two panels\n')).toMatch(/must match/);
  });
});

describe('check-title command', () => {
  it('exits 1 for a bad title and 0 for a good one', () => {
    expect(run(['[PIV-1] chore: x']).status).toBe(1);
    expect(run(['[PIV-1] chore(repo): x']).status).toBe(0);
  });

  it('reads a commit message file', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'check-title-')), 'COMMIT_EDITMSG');
    writeFileSync(file, 'add page-text search\n');
    expect(run(['--commit-msg-file', file]).status).toBe(1);
    writeFileSync(file, '[PIV-1] feat(search): add page-text search\n');
    expect(run(['--commit-msg-file', file]).status).toBe(0);
  });

  it('runs the check when started through a symlink', () => {
    const link = join(mkdtempSync(join(tmpdir(), 'check-title-')), 'check-title.mjs');
    symlinkSync(script, link);
    expect(run(['[PIV-1] chore: x'], { path: link }).status).toBe(1);
  });

  it('prints one GitHub annotation line, even for a title with a newline', () => {
    const result = run(['bad\n::warning::second'], { actions: true });
    expect(result.status).toBe(1);
    expect(result.stdout.trimEnd().split('\n')).toEqual([expect.stringMatching(/^::error::"bad%0A::warning::second" must match/)]);
  });
});
