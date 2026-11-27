/** Check a commit subject or pull request title against the format in AGENTS.md. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TYPES = ['feat', 'fix', 'chore', 'docs', 'ci', 'test', 'perf', 'refactor'];
export const AREAS = ['inspector', 'site', 'search', 'infra', 'brand', 'repo'];
export const MAX_LENGTH = 72;

const pattern = new RegExp(`^\\[PIV-[0-9]+\\] (${TYPES.join('|')})\\((${AREAS.join('|')})\\): [a-z0-9]([^A-Z]*[^A-Z.])?$`);
// Git writes these subjects itself. Squash merges replace them with the PR title, so they never reach main.
const gitSubject = /^(Merge |Revert "|fixup! |squash! |amend! )/;

export const titleProblem = function titleProblem(title) {
  if (!pattern.test(title)) {
    return `"${title}" must match '[PIV-<issue>] type(scope): summary'. The scope is one of ${AREAS.join(', ')}, and the summary is all lowercase with no full stop. See AGENTS.md.`;
  }
  const length = [...title].length;
  if (length > MAX_LENGTH) {
    return `"${title}" is ${length} characters. The limit is ${MAX_LENGTH}.`;
  }
  return undefined;
};

export const commitSubjectProblem = function commitSubjectProblem(message) {
  const subject = (
    message.split('\n').find((line) => {
      return !line.startsWith('#') && line.trim() !== '';
    }) ?? ''
  ).trimEnd();
  return gitSubject.test(subject) ? undefined : titleProblem(subject);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [flag, value] = process.argv.slice(2);
  const problem = flag === '--commit-msg-file' ? commitSubjectProblem(readFileSync(value, 'utf8')) : titleProblem(flag ?? '');
  if (problem) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.log(`::error::${problem}`);
    } else {
      console.error(problem);
    }
    process.exitCode = 1;
  }
}
