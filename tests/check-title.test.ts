import { describe, expect, it } from 'vitest';

// @ts-expect-error Node ESM scripts have no declaration file.
import { AREAS, commitSubjectProblem, titleProblem } from '../scripts/check-title.mjs';

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

  it('allows 72 characters and rejects 73', () => {
    const title = '[PIV-1] chore(infra): ';
    expect(titleProblem(title + 'a'.repeat(72 - title.length))).toBeUndefined();
    expect(titleProblem(title + 'a'.repeat(73 - title.length))).toMatch(/73 characters/);
  });
});

describe('commitSubjectProblem', () => {
  it('checks the first line that is not a comment', () => {
    expect(commitSubjectProblem('# Please enter the commit message\n\n[PIV-1] fix(search): keep the note \n\nBody\n')).toBeUndefined();
    expect(commitSubjectProblem('add page-text search\n# [PIV-1] fix(search): keep the note\n')).toMatch(/must match/);
  });

  it('rejects an empty message', () => {
    expect(commitSubjectProblem('# Only comments\n')).toMatch(/must match/);
  });

  it.each(["Merge branch 'main' into PIV-1", 'Revert "[PIV-1] fix(search): keep the note"', 'fixup! [PIV-1] fix(search): keep the note'])(
    'skips the subject git writes: %s',
    (subject) => {
      expect(commitSubjectProblem(`${subject}\n`)).toBeUndefined();
    }
  );
});
