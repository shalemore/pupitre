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

On Linux the paths follow `$XDG_CONFIG_HOME` when it is set, and the log is written synchronously
and rotated to `main.old.log` once it passes 5 MB, so the folder never holds more than two files'
worth of history.

A run of the end-to-end or the performance suite passes a `--user-data-dir` of its own, and its log
goes into that profile instead: `<profile>/logs/main.log`, on macOS as much as on the other two. The
system log folder would otherwise keep the log of a profile that a run deletes with itself.

## What Report an Issue prefills

Help › Report an Issue opens the bug report form of the tracker — the repository offers no blank
issue — with its `title`, `version`, `platform` and `log` fields filled in. The title is
`Pupitre <version>: `, the version is the app's, and the platform line carries what the form cannot
ask for on its own: the system, its release and the architecture, and Electron's version.

The form itself asks what happened, what the user expected and how to get back to it, and the
answers are the report. Beyond the platform line above, the only thing about the machine is the
path of the log file, written relative to the home folder when it sits inside it
(`~\AppData\Roaming\Pupitre\logs\main.log`) so that a public issue does not carry the name of the
account it was written under. A path outside the home folder is shown whole.

The log is never read, attached or sent by the app: nothing leaves the machine until the issue is
posted, and posting it is a click the user makes. To let a maintainer see what happened, attach the
log file to the issue by hand — `main.log`, and `main.old.log` if the problem started before the
last rotation. A crash dump from the `Crashpad` folder can be attached too.

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

An uncaught exception and an unhandled rejection both reach the log, with the stack they carry. An
exception leaves the app in a state no window can reach and keeps the single-instance lock, so it is
logged and the app exits; a rejected promise says less about that state, so it is logged and the app
keeps running.

The log holds what the app writes to it: its startup line, and every error that escapes with its
stack. It never holds the text of a document, and a report names the log file rather than reading
it. Read `main.log` in a text editor before attaching it if a file name you opened should not travel
with the issue.
