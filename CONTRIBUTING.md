# Contributing

Needs Node.js 22 or later.

```sh
npm install
npm run dev
```

Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before sending a change.
`npm run test:e2e` drives the built app; run `npm run build` first. Commits follow
[Conventional Commits](https://www.conventionalcommits.org). Project conventions are in
[AGENTS.md](AGENTS.md).

The parser benchmark, the end-to-end timings and the bundle size check have their own commands,
described in [docs/performance.md](docs/performance.md).

## Releasing

Change `version` in `package.json` on `main` and commit it as `chore(release): x.y.z`. When the version has no tag yet, `release.yml` builds the installers, publishes the release and sends a Scoop manifest to the `scoop-bucket` repository of the same owner (the repository variable `SCOOP_BUCKET` names another). That needs the secret `SCOOP_BUCKET_TOKEN`: a fine-grained token for the bucket with _Actions: Read and write_. Without it the release is still published; import one later with:

```sh
gh workflow run import-manifest.yml --repo <owner>/scoop-bucket -f repo=<owner>/pupitre -f tag=vX.Y.Z
```

Signing the installers and notarizing the macOS build take their own secrets, described in
[docs/signing.md](docs/signing.md).
