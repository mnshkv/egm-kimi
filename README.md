# Elephant-Goldfish Model for Kimi Code CLI

[![validate](https://github.com/mnshkv/egm-kimi/actions/workflows/validate.yml/badge.svg)](https://github.com/mnshkv/egm-kimi/actions/workflows/validate.yml)

Design with an elephant, review with a goldfish.

This is a Kimi Code CLI port of [google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model).
The elephant (the main session) holds your project context and drafts the
specification. Goldfish reviewers are subagents started in a fresh context: they
see the document and the material it references, not the conversation that
produced it, so unstated assumptions and blind spots surface before you build.

## Install

From a Kimi Code session:

```
/plugins install https://github.com/mnshkv/egm-kimi
```

Then start a new session or run `/reload`. Kimi copies the plugin to
`~/.kimi-code/plugins/managed/egm`; edits to this source directory need a
reinstall (or `/plugins install` again) to take effect.

## Use

| Command | What it does |
| --- | --- |
| `/egm:brainstorm` | explore an idea, challenge it, write `concepts_brief.md` |
| `/egm:draft` | turn the brief into `design_draft.md`, section by section |
| `/egm:review` | five-stage fresh-context review of a document |
| `/egm:review-loop` | run a configured group of reviewers |
| `/egm:resolve` | work through findings and agree on changes |
| `/egm:lite` | fast-track a small iteration or spec revision |
| `/egm:bootstrap` | document an existing codebase, directory by directory |
| `/egm:drift-report` | compare checked-in documents with the current code |

Reviewing an existing document needs no prior step:

```
/egm:review docs/designs/webhooks.md
```

The skills are also reachable as `/skill:egm:<skill-name>`.

## Layout

```
kimi.plugin.json        manifest: skills, agents, commands, tool mapping
docs/kimi.md            how the model maps onto Kimi Code CLI
skills/                 the eight workflow skills
agents/                 reviewer personas (Goldfish)
resources/              document standards and shared execution rules
commands/               /egm:* slash commands
```

## Requirements

Reviews need subagents: Kimi's `Agent` tool, with read-only `explore` as the
fallback persona type. Without a subagent tool a same-context review is not a
Goldfish review, and the skills stop instead of pretending.

## License and provenance

Apache-2.0, inherited from upstream. See `LICENSE` and `NOTICE`. Not an
officially supported Google product, and this port is not maintained by the
upstream authors.

## Checks

`node scripts/validate.mjs` validates the manifest, every `SKILL.md` frontmatter,
personas, command files and referenced assets. CI runs it on every push and pull
request.
