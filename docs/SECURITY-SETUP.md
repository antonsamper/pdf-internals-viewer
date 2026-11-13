# Repository security setup

## Checked-in safeguards

The Checks workflow pins actions to full commit SHAs, grants only `contents: read`, and disables checkout credential persistence. Its `secrets` job installs Gitleaks 8.30.0 using a pinned SHA-256 and scans all fetched Git history with redacted output. Updating Gitleaks requires reviewing its release and updating both version and digest in the workflow. To scan locally with Gitleaks installed:

```sh
gitleaks git . --log-opts="--all --full-history" --redact=100 --no-banner
```

Run this before committing sensitive configuration. CI detects leaks after a push; it does not prevent the initial upload. Revoke/rotate any exposed credential before considering history cleanup. Keep `.gitleaks.toml`'s default detectors enabled and avoid broad allowlists.

Dependabot checks npm/pnpm dependencies and GitHub Actions weekly after `.github/dependabot.yml` reaches `main`. Review its PRs normally; no automatic merging is configured. Exact parser/preview version and hash guards intentionally require maintenance during dependency upgrades. Do not remove them merely to make an update pass. The known Zod advisory and backport remain documented in [DEPENDENCIES.md](DEPENDENCIES.md).

## GitHub settings

As of 2026-11-13, the repository is public. The active [Protect main ruleset](https://github.com/antonsamper/pdf-internals-viewer/rules/27212164) requires pull requests and successful up-to-date `secrets`, `check`, and all three browser checks. It blocks force pushes and deletion, has no bypass actors, and requires zero reviewer approvals so the sole maintainer can merge their own PRs. The legacy branch-protection API example below is a setup reference; inspect the active ruleset before adding overlapping protection.

On 2026-11-12, Dependabot alerts and automated security update PRs were enabled. The repository remained private. GitHub rejected the following settings under the current private repository/plan: private vulnerability reporting (404), secret scanning/push protection (unavailable), branch protection (403 requiring Pro or public visibility), and external fork workflow approval (422 requiring public visibility).

After these workflow changes reach `main` and the repository becomes public, run the following with an administrator's authenticated GitHub CLI. These commands do not change visibility or deploy the application.

```sh
gh api --method PUT repos/antonsamper/pdf-internals-viewer/private-vulnerability-reporting

gh api --method PATCH repos/antonsamper/pdf-internals-viewer --input - <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON

gh api --method PUT repos/antonsamper/pdf-internals-viewer/actions/permissions/fork-pr-contributor-approval --input - <<'JSON'
{ "approval_policy": "all_external_contributors" }
JSON

gh api --method PUT repos/antonsamper/pdf-internals-viewer/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "secrets",
      "check",
      "browsers (chromium)",
      "browsers (firefox)",
      "browsers (webkit)"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

The protection policy requires a PR and successful up-to-date checks, including the secret scan, and applies to administrators. It requires zero independent approvals so a sole maintainer can merge their own PR after checks pass. Increase the approval count when another trusted maintainer is available. This command replaces the branch's protection policy; review existing protections before rerunning it later.

Verify the resulting settings in GitHub's repository Settings and Security pages, and confirm the private reporting link in [SECURITY.md](../SECURITY.md) works. Public secret scanning can notify credential providers, so do not rely on it as the first pre-publication scan.

## Publishing and future deployment automation

Making the repository public exposes branch history, PR discussions, and existing Actions logs. Scan those surfaces before changing visibility. Keep `.context/`, local credentials, generated artifacts and downloaded private PDFs out of Git.

The Checks workflow publishes to Cloudflare Pages only after successful checks on pushes to `main`; pull request runs do not deploy. Cloudflare credentials are supplied only to the production deployment steps. Manual publication is also available. See [hosting](HOSTING.md) for the deployment flow.

## References

- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [Dependabot configuration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [Repository settings API](https://docs.github.com/en/rest/repos/repos)
- [Actions permissions API](https://docs.github.com/en/rest/actions/permissions)
