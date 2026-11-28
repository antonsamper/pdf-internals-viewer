/** Check a commit subject or pull request title against the format in AGENTS.md. */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TYPES = ['feat', 'fix', 'chore', 'docs', 'ci', 'test', 'perf', 'refactor'];

export const AREAS = ['inspector', 'site', 'search', 'infra', 'brand', 'repo'];
export const MAX_LENGTH = 72;

const pattern = new RegExp(`^\\[PIV-[0-9]+\\] (${TYPES.join('|')})\\((${AREAS.join('|')})\\): [a-z0-9]([^A-Z]*[^A-Z.])?$`);
// Git writes these subjects itself. Squash merges replace them with the PR title, so they never reach main.
const gitSubject =
  /^(Merge (branch(es)?|remote-tracking branch(es)?|commit|tags?|pull request|HEAD,) |Merge (\S+:\/\/|[./])|Revert "|Reapply "|(fixup|squash|amend)! )/;

export const titleProblem = function titleProblem(title) {
  if (!pattern.test(title)) {
    return `"${title}" must match '[PIV-<issue>] type(scope): summary'. The type is one of ${TYPES.join(', ')}, the scope is one of ${AREAS.join(', ')}, and the summary is all lowercase with no full stop. See AGENTS.md.`;
  }

  const length = [...title].length;

  if (length > MAX_LENGTH) {
    return `"${title}" is ${length} characters. The limit is ${MAX_LENGTH}.`;
  }

  return undefined;
};

/** Git's subject is the whole first paragraph, joined into one line. */
export const commitSubjectProblem = function commitSubjectProblem(message) {
  // `git commit -v` appends the diff below a scissors line.
  const lines = message
    .split(/^# -+ >8 -+$/m)[0]
    .split('\n')
    .filter((line) => {
      return !line.startsWith('#');
    });
  const start = lines.findIndex((line) => {
    return line.trim() !== '';
  });
  const paragraph = start === -1 ? [] : lines.slice(start);
  const end = paragraph.findIndex((line) => {
    return line.trim() === '';
  });
  const subject = (end === -1 ? paragraph : paragraph.slice(0, end))
    .map((line) => {
      return line.trim();
    })
    .join(' ');

  return gitSubject.test(subject) ? undefined : titleProblem(subject);
};

// GitHub reads each output line as a possible workflow command, so a title must not start a new line.
const annotation = function annotation(text) {
  return `::error::${text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`;
};

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [first, file] = process.argv.slice(2);
  const problem = first === '--commit-msg-file' ? commitSubjectProblem(readFileSync(file, 'utf8')) : titleProblem(first ?? '');

  if (problem) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.log(annotation(problem));
    } else {
      console.error(problem);
    }

    process.exitCode = 1;
  }
}
