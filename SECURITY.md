# Security policy

## Reporting a vulnerability

Please report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/antonsamper/pdf-internals-viewer/security/advisories/new). Do not post credentials, private PDFs, or exploit details in public issues or pull requests. If private reporting is unavailable, open an issue asking the maintainer to enable a private reporting channel, without disclosing the vulnerability.

Include the affected version or commit, reproduction steps using a synthetic PDF where possible, expected impact, and your browser/version. Never attach a confidential document.

## Supported versions

Security fixes target the current `main` branch and its latest deployment. Older snapshots are not maintained.

## Data and credentials

PDF inspection and preview run locally in the browser. Documents are not uploaded or persisted by the application. Deployment is manual; Cloudflare credentials must stay outside Git and pull request workflows.

CI scans Git history with Gitleaks, with secret values redacted. A clean scan does not guarantee the absence of custom or encoded credentials. If a credential leaks, revoke and rotate it immediately, review provider logs for misuse, and assess whether history/log cleanup is needed.

## Known dependency advisory

The pinned EmbedPDF dependency includes Zod 3.25.76, which is affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Installation and build hooks apply a hash-checked, tested collection-bound backport. This mitigates the tested behavior without resolving the version-based audit finding or all possible resource exhaustion. See [dependency maintenance](docs/DEPENDENCIES.md) and [backport scope](docs/PREVIEW-VALIDATION.md). Upgrades must preserve these checks until a compatible upstream fix replaces the backport.

Repository administrators should follow [the publication security checklist](docs/SECURITY-SETUP.md) when changing visibility.
