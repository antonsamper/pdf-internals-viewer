# Security policy

## Reporting a vulnerability

Please report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/antonsamper/pdf-internals-viewer/security/advisories/new). Do not post credentials, private PDFs or exploit details in public issues or pull requests.

Include the affected commit, reproduction steps using a synthetic PDF where possible, the expected impact, and your browser and its version. Never attach a confidential document.

## Supported versions

Security fixes target the `main` branch and its production deployment. Older snapshots are not maintained.

## Data and credentials

PDF inspection and preview run locally in the browser. The application does not upload or store documents. Production deploys run only from GitHub Actions after all checks pass on `main`. Cloudflare credentials are repository Actions secrets and are never exposed to pull request runs.

CI scans the full Git history with Gitleaks and redacts secret values in its output. A clean scan does not rule out custom or encoded credentials. If a credential leaks, revoke and rotate it immediately, review the provider's logs for misuse, and decide whether history or log cleanup is needed.
