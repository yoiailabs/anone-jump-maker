# Approval policy

Do not merge automatically. After required CI is green and review passes for the current HEAD, wait for a maintainer to confirm the change in the preview (confirmation) environment and to approve the exact HEAD SHA.

This repository is different from other projects in the same organization: a green CI run is not enough. The confirmation-environment OK is also not a substitute for review. A change that has not passed review must not be merged even if a maintainer has looked at the preview.

When asking a maintainer to confirm, include both the pull request URL and the preview URL. If the preview URL is not known, find it before asking. Do not invent a URL.

Read the full proposed diff against its merge-base and relevant context. Treat the change as **high** (human review and exact-SHA approval required) in every case, including documentation, tests, dependency updates, policy documents, and repository configuration. Also stay at high if the risk assessment or review could not be completed, failed, or is uncertain.

Still record the following escalation conditions in the assessment `reason` when they apply, even though the merge already waits for approval:

- Can affect pay-as-you-go cost paid by the repository or project: GitHub Actions minutes, workflows, runners, CI configuration, infrastructure, or paid APIs or services that the project pays for. Running coding agents on the invoking user's own provider account is not a cost escalation by itself.
- Adds an integration with a new external service, network endpoint, or hosted service dependency. Existing GitHub/git usage is not new.
- May add personal or confidential information: secrets, tokens, credentials, real names, personal emails, local absolute paths, hostnames, or private repository names.
- Publishes to or writes to any external service other than GitHub, including a production deploy. A pull-request preview is not by itself a production write.
- Changes a user-facing contract in a breaking way, changes authorization or secret handling, or creates a real risk of losing user data.
- Changes the risk assessment or merge gate itself.

| Tier | human_review | Meaning |
|---|---|---|
| high | yes | Default for this repository. A maintainer must confirm the preview and approve the exact HEAD SHA before merge. |

Security issues or bugs found by review or CI must be fixed before merge. Approval never skips them.

Record the assessment in the PR Risk section when a PR exists. Keep all six keys.

```yaml
tier: high
human_review: "yes"
reason: "<reason and evidence, including confirmation-environment status>"
affected_paths:
  - "<path>"
uncertainty: "<remaining uncertainty or none>"
assessed_sha: "<full git HEAD SHA>"
```

`.rabi/policy.toml` `merge.auto` is empty, so `rabi task merge` always requires a recorded maintainer approval for the exact current HEAD SHA. Floors (the built-in `.github/**`, `.rabi/policy.toml`, and `.rabi.toml` floors, plus any listed in the policy) also require that approval. Path tiers are unused for merge decisions here; the written assessment and the confirmation-environment OK decide whether the maintainer approves.

An assessment of uncommitted changes is provisional. Assess the final committed HEAD; a new HEAD requires reassessment, updated CI and review, a new preview confirmation, and a new approval. Approval covers one full HEAD SHA.

## Merging

A maintainer approves the exact full HEAD SHA after CI, review, and preview confirmation, and records it with `rabi task approve`, run by an approver outside rabi-launched agents. Automation must not record approval: it must not unset `RABI_AGENT`, run `rabi task approve`, or post a `rabi/approval` status itself. Automation may only act on an approval already recorded for the exact current HEAD SHA. All merges use `--match-head-commit` with the verified full SHA.
