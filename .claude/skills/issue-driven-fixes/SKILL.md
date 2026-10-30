---
name: issue-driven-fixes
description: Turn a batch of user-reported problems into verified, atomic GitHub issues and fix them one at a time with commits that close them. Use when the user describes several bugs, regressions, or polish requests in plain language and expects them tracked on GitHub, checked before filing, and fixed in order, including when new requests arrive mid-work and when a problem turns out to be different from the report.
---

# Issue-driven fixes

## When this applies

The user describes problems in plain language, often as one long spoken list. They want each real problem tracked on GitHub, verified before it is filed, and fixed one by one. The tracker is the plan; do not keep a TODO document in the repository.

## Rules

- Reply in the user's language. Issues, commit messages, and code comments are English.
- Use `gh` as the account already authenticated; never switch identities and never hardcode a login in commands, links, or notes. Use `@me` or ask `gh` for the current account, so the workflow follows whoever is signed in.
- Work on the branch the user asked for. They often work directly on the default branch without a PR; do not create one unless asked.
- The repository's issue template is optional. A readable issue beats a complete one; do not pad it.
- `tested-locally` is the developer's own label: they checked the fix on their machine. It says nothing about CI, a push, or a released build. Do not add or remove it unless asked.

## 1. Turn the report into atomic issues

- Split the message into one issue per independent problem, in the user's order.
- Verify every report before filing: reproduce it in the running app, or read the code and prove the path. A report that does not reproduce is not filed; keep what you checked for the final report.
- File each confirmed problem with `gh`: a concise English title and body, the behaviour seen, the behaviour expected, how to reproduce, and a short note on where and how it should be fixed.
- Add the fitting English labels (`bug`, `enhancement`, `accessibility`, ...). Do not invent labels the repository does not have.
- Reference related issues in the new issue's body (`See #12`, `Related to #7`). Do not edit earlier issues unless one is actually wrong.
- File the whole confirmed batch before starting to fix anything.
- Keep the batch checklist outside the repository; only a note the developer must read belongs in the project root (see section 3).

## 2. Fix in issue order

- One atomic commit per issue, in English Conventional Commits, with `Closes #N` in the message. The issue closes when the commit reaches the default branch: a push to it, or a PR merged into it.
- When issues are independent — different files, different areas, no shared contract — give them to subagents and let them work in parallel, each in its own worktree. Keep changes that touch the same files, the same IPC or settings contract, or the same UI in one agent, and land the resulting commits in issue order.
- Before calling an issue done, run what AGENTS.md requires (lint, typecheck, knip, tests, build, bundle, and E2E when a flow it covers changed) and check UI changes in the real app.
- If the user reports a new symptom of the **same** issue while its commit is still unpushed, amend it into that commit. Keep that commit's original author and committer dates; an amend must not move them to now. Never rewrite a pushed commit without asking.
- A new, independent problem is its own issue: verify it, file it, then fix it in order.

## 3. Findings that need the developer's attention

When something needs the developer to know or decide — a report that does not reproduce, a design decision, a problem that differs from what was described — write a note named **`NOTE-<slug>.md` in the project root**, where `<slug>` is a short kebab-case English name for the finding (`NOTE-pdf-dark-export.md`). Keep it short, with the same headings each time:

```markdown
# <the finding in one line>

**Reported** — what the user said.
**Found** — what is actually happening.
**Checked** — how this was verified: steps, output, files.
**Options** — what can be done, and the recommendation.
**Status** — open, or settled and removed.
```

The project ignores `/NOTE-*.md`, so the note never reaches a commit; add that line to `.gitignore` if a repository lacks it. Then send one plain sentence such as "what you reported is really X; see `NOTE-x.md`" and **keep working on the task in hand**. The note and the fix are two parallel tracks: do not stop to wait for an answer, and do not file a speculative issue. Delete the note once the problem is settled.

## 4. Requests that arrive mid-work

The user often sends more problems while you are working. Pause long enough to check whether the new one exists, then:

- If the pending batch of issues is not yet filed, finish filing it first, and keep the new item at the end of the queue.
- If it belongs to the issue in progress, amend the fix into that unpushed commit.
- Otherwise add it to the queue as its own issue and continue in order. Never lose an item, and do not let the new message derail the current step.

## 5. Final pass

After the last issue:

- Review the whole diff against AGENTS.md: naming, the strict TypeScript rules, comment style, style usage, test coverage, dead code.
- Fix what the review finds by amending each change into the commit it belongs to, preserving those commits' dates. Do not add a "review fixes" commit.
- Run the full suite again.
- Report to the user: every issue with its commit, what passed, what could not be reproduced or is still open, and that the issues close when the branch is pushed.
- Give the developer a link to the repository's issues filtered to the current author (`author:@me`) and missing `tested-locally`, so they can check the local fixes one by one.

The `gh` and `git-commit` skills hold the tool-level details for the commands involved.
