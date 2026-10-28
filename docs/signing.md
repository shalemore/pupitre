# Signing and notarization

A release is signed when the workflow has the certificates for it, and built unsigned when it does
not. Besides signing, the packaged binary is hardened with Electron's own fuses, which are set for
every build whether it is signed or not.

## The Electron fuses

`electronFuses` in `electron-builder.yml` is read while packing: electron-builder flips the bytes in
the Electron binary it copies, so the switches hold in the installed app and no environment variable
or command-line argument can take them back. Each one closes a way of running code that was not
built:

- `runAsNode: false` — the binary ignores `ELECTRON_RUN_AS_NODE`, so the app cannot be turned into a
  plain Node interpreter that runs an arbitrary script. Pupitre does not spawn itself, so nothing it
  does loses this.
- `enableNodeOptionsEnvironmentVariable: false` — `NODE_OPTIONS` and `NODE_EXTRA_CA_CERTS` in the
  environment are ignored, so the options the runtime starts with, and the certificates it trusts,
  are the ones it was built with.
- `enableNodeCliInspectArguments: false` — `--inspect` and the other inspector flags do nothing, so a
  release build cannot have a debugger attached to its main process.
- `enableEmbeddedAsarIntegrityValidation: true` — Chromium checks the hash of `app.asar` that
  electron-builder writes into the binary's resources before it loads the archive; a changed archive
  is refused rather than run. macOS has had it since Electron 16, Windows since 30.
- `onlyLoadAppFromAsar: true` — the app can only come from `app.asar`. Without it Electron still
  looks for an unpacked `app/` folder and for `default_app.asar` when the archive is not found, and
  neither of those is covered by the integrity check. The two belong together: one says the archive
  is the one that was built, the other says the archive is all that can run.

`grantFileProtocolExtraPrivileges` stays on. The packaged windows load `out/renderer/index.html`
over `file://`, and the pages rely on the extra privileges that protocol gets in Electron; turning
the fuse off would break them.

What a build really has is readable from the packaged binary:

```sh
npx --no-install electron-fuses read --app release/win-unpacked/Pupitre.exe
```

## Secrets

Signing is driven by environment variables, so the same commands work in the workflow and on a
machine. `release.yml` gives each platform its own step and only the variables it can use: a macOS
certificate never reaches the Windows build, and the Windows certificate never reaches macOS.

| Secret                        | Platform | Contents                                                    |
| :---------------------------- | :------- | :---------------------------------------------------------- |
| `CSC_LINK`                    | macOS    | the Developer ID Application certificate, base64, as `.p12` |
| `CSC_KEY_PASSWORD`            | macOS    | the password the `.p12` was exported with                   |
| `APPLE_ID`                    | macOS    | the Apple ID of the developer account                       |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS    | an app-specific password for that Apple ID, not its own     |
| `APPLE_TEAM_ID`               | macOS    | the team the app is notarized for                           |
| `WIN_CSC_LINK`                | Windows  | the Authenticode certificate, base64, as `.pfx`             |
| `WIN_CSC_KEY_PASSWORD`        | Windows  | the password the `.pfx` was exported with                   |

### macOS

The certificate is a _Developer ID Application_ certificate from the Apple Developer Program; a
certificate for distribution through the App Store does not sign a download from a website. Export
it from Keychain Access as a `.p12` together with its key, then base64 it:

```sh
base64 -i DeveloperIDApplication.p12 | pbcopy
```

electron-builder signs the `.app` with it, importing the certificate into a keychain of its own for
the build. `hardenedRuntime` is on by default for the mac target, which is what notarization
requires; nothing has to set it.

Once the app is signed, electron-builder sends it to `notarytool` and staples the ticket when
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` are in the environment. Without them
it skips notarization and the build carries on.

Notarization happens once the `.app` is signed and before the `.dmg` and the `.zip` are packed from
it, so the stapled ticket travels inside both.

The Apple credentials only mean something together with the signing certificate: they notarize the
`.app` that certificate signed. `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` set
while `CSC_LINK` is missing is a misconfiguration rather than an unsigned build, and macOS may fail
the build for it.

### Windows

The certificate is an Authenticode code signing certificate, exported as a `.pfx` and
base64-encoded:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Clipboard
```

electron-builder hands it to `signtool` and signs the executable and the installer with it.

An open-source project can get a Windows certificate for free from [SignPath](https://signpath.io):
its SignPath Foundation signs releases of open-source projects with its own Authenticode certificate,
through a workflow of its own rather than the secrets above. It is the usual way around paying for a
certificate that SmartScreen accepts.

## Unsigned builds

Both platforms build and run without any of the secrets: electron-builder logs that it skips code
signing and packs the app as it is. What that costs is trust, not function:

- macOS puts a downloaded app under quarantine and Gatekeeper refuses it until the user allows it in
  System Settings, since it is neither signed nor notarized.
- Windows shows the SmartScreen warning (_Windows protected your PC_) until an unsigned or unknown
  download gathers enough reputation, which a certificate buys immediately.

No step treats the secrets as required: a pull request from a fork and a release from a repository
without certificates both build. The one thing the workflow does with them is clear an empty
certificate from the macOS build, where electron-builder would read the empty value as a path.

## Local builds

`npm run dist` on a machine without those variables produces an unsigned app and does not notarize
it. The `afterSign` hook returns as soon as one of the Apple credentials is missing, so the package
step never waits on Apple for a build that is not being released.

To sign and notarize locally, put `CSC_LINK` (a path to the `.p12` works as well as base64) and
`CSC_KEY_PASSWORD` in the environment for the signature, and `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for the notarization, then run `npm run dist`. It
runs the same hook the workflow does.
