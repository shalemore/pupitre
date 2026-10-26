# Supply chain

What a release proves about the files it publishes, what watches the code between releases, and the
repository settings a workflow cannot turn on itself.

## What a release produces

`release.yml` builds the installers of three platforms in parallel jobs and collects them in one
draft release. Each build job also leaves, beside them:

- `pupitre-<platform>.cdx.json`, the CycloneDX SBOM of the dependencies `npm sbom` resolves from the
  lockfile.
- A build provenance attestation for every installer of that job, signed by GitHub Actions, which
  names the repository, the commit and the workflow run the file came from.
- An SBOM attestation, which ties each of those installers to the SBOM file.

The two attestations are signed with the identity of the workflow run through OpenID Connect rather
than with a key in the repository, which is why the job asks for `id-token: write` and
`attestations: write`. They run after the build steps, so a run that cannot sign one fails the
release instead of publishing files that nothing vouches for.

The files to attest come from `scripts/release-artifacts.ts`, which prints the installers in
`release/` (`nsis` `.exe`, `.dmg`, `.zip`, `.AppImage`, `.deb`) and exits non-zero when there are
none. `release/*` itself is not used: the folder also holds the unpacked app folders and the update
metadata, and an attestation over a directory says nothing.

### Verifying a download

```sh
gh attestation verify Pupitre-0.7.2-win-x64.exe --repo shalemore/pupitre
```

`gh` looks the attestation up in the repository, checks its signature and the certificate the run
was issued with, and prints the subject digest and the workflow that signed it. The command fails
when the file has no attestation or when its digest is not the one attested, so a modified installer
is refused. `--predicate-type https://cyclonedx.org/bom` verifies the SBOM attestation instead of
the provenance, and `--format json` prints either for a script to read.

## CodeQL and Scorecard

Both workflows post what they find to the Security tab of the repository. CodeQL also reports on the
pull request that caused an alert. Scorecard has no pull request trigger: it scores the default
branch on a push to `main`, when a branch protection rule changes and weekly, so its report reaches
the Security tab rather than a review.

`codeql.yml` runs CodeQL, GitHub's static analysis, on every push to `main`, on pull requests and
weekly. It reads the JavaScript and TypeScript of the whole project — the main process, the preload
script and the renderer — as source, so it needs neither `npm install` nor a build. Its alerts are
the usual ones for that language: an injection through a document or an IPC payload, an unsafe DOM
write, data taken from disk without validation. Check them under Security › Code scanning; an alert
on a pull request blocks nothing by itself unless branch protection requires the check.

`scorecard.yml` runs OpenSSF Scorecard, which does not read the code but asks the GitHub API how the
project is run: is `main` protected, is a code review needed, are actions pinned, is there a
security policy and a dependency update tool, are releases signed. It runs when a branch protection
rule changes, on every push to `main` and weekly, and publishes the score to the OpenSSF database
next to the SARIF copy in the Security tab, where it can also be read at
`securityscorecards.dev/viewer/?uri=github.com/shalemore/pupitre`. It scores public repositories
only, and only their default branch: a private repository has no score.

## Pinned actions and Renovate

Every third-party action is used as a full commit SHA with the version it belongs to in a trailing
comment, `actions/checkout@11d5960a… # v4`. A tag is a moving pointer that whoever owns the
repository can point anywhere, and a workflow that runs on a pushed tag runs whatever it is pointed
at; a commit cannot be swapped for another. Local actions (`./.github/actions/...`) stay on their
path, since they are part of this repository and reviewed with it.

Renovate keeps those digests current. `renovate.json` extends `config:recommended` for the usual
update policy and `:pinDigests`, which writes the SHA and the comment when a new version of an action
is out, and enables lock file maintenance so `package-lock.json` is refreshed without a dependency
changing. Its pull requests go through CI like any other change. Renovate has to be installed on the
repository — the hosted app for a public repository — before any of it runs.

## Settings a workflow cannot turn on

A repository owner does these once, in Settings:

- **Branch protection on `main`** — require a pull request and the CI and CodeQL checks, and turn off
  force pushes. Scorecard scores the protection that is configured, and a rule that names a required
  check also makes that workflow a gate.
- **Private vulnerability reporting** (Settings › Code security) — lets a reporter open a draft
  advisory that only the maintainers see, instead of a public issue. [SECURITY.md](../SECURITY.md)
  sends a reporter there.
- **Dependabot alerts** and the dependency graph (Settings › Code security) — turns on the alerts the
  npm advisories in `package-lock.json` produce. Alerts are what an updated lockfile closes, and
  Dependabot can open the pull request for one.
- **Code scanning** — the CodeQL and Scorecard workflows upload their SARIF to it, and enabling it
  is what makes the Security tab show the alerts at all.

Attestations are stored by the repository, and a private repository can read them back only with
GitHub Enterprise; on a public repository `gh attestation verify` works as described above.
