# Security policy

## Supported versions

Fixes go into the current minor line and are published as a new release of it; an older line gets
none. The latest release is on the [Releases](https://github.com/shalemore/pupitre/releases) page.

| Version | Supported |
| :------ | :-------- |
| 0.7.x   | Yes       |
| < 0.7   | No        |

## Reporting a vulnerability

Do not open a public issue. Use GitHub's private vulnerability reporting instead: on the
[Security tab](https://github.com/shalemore/pupitre/security) of the repository, under Advisories,
choose _Report a vulnerability_. Only the maintainers see what you write, and the report stays
private until an advisory is published.

Please include:

- the Pupitre version and the platform, and whether the app came from a release or from a build of
  the source;
- what an attacker gains, and what they have to get a user to do first;
- the steps that reproduce it, or a proof of concept, with any file or document it needs reduced to
  the smallest version that still shows the problem.

A report is acknowledged within a few days, and the reply says whether it is accepted and what the
fix looks like. If it is, the fix ships in a release and the advisory credits the reporter unless
they ask otherwise. This is a project run in its spare time: there is no bug bounty and no payment
for a report.

## What a release proves

Every installer is attested against the workflow run that built it, and `gh attestation verify`
checks that before the file is trusted; CodeQL and OpenSSF Scorecard read the code and the
repository between releases. [docs/supply-chain.md](docs/supply-chain.md) describes both and how to
verify a download.
