# Diagnostics

Pupitre writes a log of what it does and, if it crashes, a crash dump. Both stay on the machine
they were written on: there is no telemetry, and nothing is uploaded.

## Where the files are

`src/main/diagnostics.ts` sends the log to `main.log` in the folder Electron reports as
`app.getPath("logs")`, and starts Electron's crash reporter with `uploadToServer: false`, so Crashpad
keeps its dumps in `app.getPath("crashDumps")`. Both follow the app's data folder:

|         | Log                               | Crash dumps                                      |
| :------ | :-------------------------------- | :----------------------------------------------- |
| Windows | `%APPDATA%\Pupitre\logs\main.log` | `%APPDATA%\Pupitre\Crashpad`                     |
| macOS   | `~/Library/Logs/Pupitre/main.log` | `~/Library/Application Support/Pupitre/Crashpad` |
| Linux   | `~/.config/Pupitre/logs/main.log` | `~/.config/Pupitre/Crashpad`                     |

On Linux the paths follow `$XDG_CONFIG_HOME` when it is set. The log is written synchronously and
rotated to `main.old.log` once it passes 5 MB, so the folder never holds more than two files' worth
of history. A run of the end-to-end suite sets its own `--user-data-dir`, so its log sits there
instead of in the folders above.

## What Report an Issue prefills

Help › Report an Issue opens the GitHub new-issue page with the title `Pupitre <version>: `, a short
"What happened?" and "What I expected" template, and a diagnostics footer: the Pupitre version,
Electron's version, the platform, the OS release and the architecture, and the path of the log file.

Only that path is in the issue. The log is never read, attached or sent by the app: nothing leaves
the machine until the issue is posted, and posting it is a click the user makes. To let a maintainer
see what happened, attach the log file to the issue by hand — `main.log`, and `main.old.log` if the
problem started before the last rotation. A crash dump from the `Crashpad` folder can be attached
too.

## Keeping more of the log

The file takes `info` and above, which is the startup line and any error that escaped, with its
stack. To watch a run more closely, set `PUPITRE_LOG_LEVEL` for it:

```sh
PUPITRE_LOG_LEVEL=debug npm run dev
```

On Windows PowerShell that is `$env:PUPITRE_LOG_LEVEL = "debug"; npm run dev`, and a packaged app
started from a terminal reads the same variable. The levels are `silly`, `debug`, `verbose`, `info`,
`warn` and `error`, from the noisiest to the quietest; a value the app does not know leaves the log
at `info`, and the log says so.

## Privacy

The log holds what the app writes to it: its startup line, and every error that escapes with its
stack. It never holds the text of a document, and a report names the log file rather than reading
it. Read `main.log` in a text editor before attaching it if a file name you opened should not travel
with the issue.
