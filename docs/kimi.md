# Kimi Code CLI integration

This plugin is the Kimi Code CLI port of the Elephant-Goldfish Model. The
workflow, personas and document standards are unchanged. Only the harness
plumbing differs, and this page describes that plumbing.

## Layout

```
egm-kimi/
  kimi.plugin.json        plugin manifest
  skills/<skill>/SKILL.md one skill per workflow step
  agents/<persona>.md     reviewer personas (Goldfish)
  resources/              document standards and shared execution rules
  commands/<name>.md      /egm:<name> slash commands
```

The plugin root is the directory that contains `kimi.plugin.json`. From a skill
at `skills/<skill>/SKILL.md`, the plugin root is two directories up, so persona
files are reachable as `../../agents/<file>.md`.

## Delegation: how a Goldfish is spawned

Kimi's `Agent` tool starts a subagent in a fresh context. That fresh context is
the whole point of the model: reviewers must not see the main conversation.

1. Read the persona file under `agents/` and its frontmatter `name`
   (`egm-zoom-out`, `egm-comprehension`, `egm-design`, ...).
2. Call `Agent` with that name as `subagent_type` and the constructed prompt.
3. If Kimi rejects the named type, call `Agent` with
   `subagent_type: "explore"` and put `Read <plugin root>/agents/<file>.md
   first` at the top of the prompt.

Reviewers are read-only. Use `explore` (or the persona type) and never `coder`
for review steps; a reviewer that edits the workspace is not a Goldfish.

Launch independent reviewers in parallel by sending several `Agent` calls in one
message. Do not rely on nested subagents: a persona that would spawn its own
reviewers (the synthesizer, a sub-agent bootstrap orchestrator) should instead
work with the findings it is given, or be replaced by direct dispatch from the
main agent.

## Structured gates

Every "single-select gate" or "multiple-choice gate" in the skills maps to Kimi's
`AskUserQuestion`: one question, two to four options, recommended option first.
Open-ended answers (a file path, free-form notes) stay plain chat text, as the
skills already say.

## Artifacts

Briefs, drafts and review reports are written with the `Write` tool, never pasted
into chat. Paths resolve against the user's project working directory.

Plugin assets are addressed two ways: `${KIMI_SKILL_DIR}` for files that sit next
to a skill (its `references/` folder), and `../../resources/...` from a skill for
the shared document standards at the plugin root.

## Commands

| Command | Skill |
| --- | --- |
| `/egm:brainstorm` | `egm:egm-brainstorm` |
| `/egm:draft` | `egm:egm-draft` |
| `/egm:review` | `egm:egm-review` |
| `/egm:review-loop` | `egm:egm-review-loop` |
| `/egm:resolve` | `egm:egm-resolve` |
| `/egm:lite` | `egm:egm-lite` |
| `/egm:bootstrap` | `egm:egm-bootstrap` |
| `/egm:drift-report` | `egm:egm-drift-report` |

The skills are also reachable as `/skill:egm:<skill>`. They keep the upstream
hint `disable-model-invocation: true`: these are heavy, interactive workflows
started by the user, not routines to auto-invoke mid-conversation.

## Differences from the upstream harnesses

* No runtime subagent registration: Kimi agents are declared in `agents/` and
  discovered from the plugin.
* No `${CLAUDE_PLUGIN_ROOT}`: use relative paths from the skill directory, as
  described above.
* The review loop is driven by the main agent, not by a synthesizer that spawns
  its own swarm.
* Test scenarios and packaging files from the upstream repository are not part
  of this plugin.