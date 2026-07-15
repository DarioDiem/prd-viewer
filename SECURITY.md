# Security policy

## Supported code

Security fixes are applied to the current `prd-v1` line and active branches
intended to merge into it. Historical commits and experimental branches are not
supported releases.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include secrets,
private PRD content, exploit details, or personal data in public discussions.

Use the repository's private GitHub security-advisory reporting channel when it
is available. If that channel is not enabled, contact the repository owner
through a verified private contact method on their GitHub profile before
disclosing technical details. Include:

- the affected commit or branch;
- the impacted component and trust boundary;
- reproduction steps or a minimal proof of concept;
- expected impact;
- any known workaround.

The maintainer should acknowledge receipt, establish a private remediation
channel, and coordinate disclosure after a fix is available. Non-sensitive
hardening suggestions may use a normal GitHub issue.

## Data and deployment boundary

The Viewer is local-first. PRD content must not be sent to third-party services
by default. The MCP server is read-only and local-only; optional HTTP transport
must remain bound to localhost with explicit origin checks. A hosted or shared
deployment requires separate authentication, privacy, retention, and security
review and is not covered by the current local MVP.
