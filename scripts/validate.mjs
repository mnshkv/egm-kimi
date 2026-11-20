#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (message) => errors.push(message);

function read(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

function parseFrontmatter(relPath) {
  const text = read(relPath);
  if (!text.startsWith("---\n")) {
    fail(`${relPath}: missing frontmatter`);
    return {};
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    fail(`${relPath}: unterminated frontmatter`);
    return {};
  }
  const lines = text.slice(4, end).split("\n");
  const fields = {};
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (/^[>|][-+]?$/.test(rawValue)) {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        block.push(lines[i + 1].trim());
        i += 1;
      }
      fields[key] = rawValue.startsWith("|") ? block.join("\n") : block.join(" ");
    } else {
      fields[key] = rawValue.replace(/^["']|["']$/g, "").trim();
    }
  }
  return fields;
}

function requireInsideRoot(relPath, label) {
  const full = resolve(root, relPath);
  if (!full.startsWith(root + sep)) {
    fail(`${label}: path escapes the plugin root: ${relPath}`);
    return false;
  }
  if (!existsSync(full)) {
    fail(`${label}: path does not exist: ${relPath}`);
    return false;
  }
  return true;
}

// 1. Manifest
const manifest = JSON.parse(read("kimi.plugin.json"));
if (!/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(manifest.name ?? "")) {
  fail(`kimi.plugin.json: invalid name "${manifest.name}"`);
}
for (const field of ["version", "description"]) {
  if (!manifest[field]) fail(`kimi.plugin.json: missing ${field}`);
}

const skillRoot = manifest.skills ?? "./skills/";
const agentRoot = manifest.agents ?? "./agents/";
const commandRoot = manifest.commands;
if (!requireInsideRoot(skillRoot, "kimi.plugin.json skills")) process.exit(1);
if (!requireInsideRoot(agentRoot, "kimi.plugin.json agents")) process.exit(1);
if (commandRoot) requireInsideRoot(commandRoot, "kimi.plugin.json commands");

// 2. Skills
const skillNames = new Map();
for (const entry of readdirSync(join(root, skillRoot), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const rel = join(skillRoot, entry.name, "SKILL.md");
  if (!existsSync(join(root, rel))) {
    fail(`skills: ${entry.name}/SKILL.md is missing`);
    continue;
  }
  const fields = parseFrontmatter(rel);
  if (!fields.name) fail(`${rel}: frontmatter name is missing`);
  if (!fields.description) fail(`${rel}: frontmatter description is missing`);
  if (fields.name && fields.name !== entry.name) {
    fail(`${rel}: frontmatter name "${fields.name}" does not match directory "${entry.name}"`);
  }
  if (fields.name) {
    if (skillNames.has(fields.name)) fail(`${rel}: duplicate skill name "${fields.name}"`);
    skillNames.set(fields.name, rel);
  }

  const body = read(rel);
  const dir = dirname(rel);
  for (const [, asset] of body.matchAll(/\$\{KIMI_SKILL_DIR\}\/([A-Za-z0-9_./-]+)/g)) {
    const target = join(dir, asset);
    if (!existsSync(join(root, target))) fail(`${rel}: missing asset ${asset}`);
  }
  for (const [, asset] of body.matchAll(/\.\.\/\.\.\/resources\/([A-Za-z0-9_./{}-]+)/g)) {
    if (asset.includes("{")) continue;
    if (!existsSync(join(root, "resources", asset))) fail(`${rel}: missing asset resources/${asset}`);
  }
}

// 3. Agents
const personaNames = new Map();
for (const entry of readdirSync(join(root, agentRoot), { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
  const rel = join(agentRoot, entry.name);
  const fields = parseFrontmatter(rel);
  if (!fields.name) fail(`${rel}: frontmatter name is missing`);
  if (!fields.description) fail(`${rel}: frontmatter description is missing`);
  if (fields.name) {
    if (personaNames.has(fields.name)) fail(`${rel}: duplicate persona name "${fields.name}"`);
    personaNames.set(fields.name, rel);
  }
}

// 4. Personas referenced from skills must exist
for (const rel of skillNames.values()) {
  const body = read(rel);
  for (const [, file] of body.matchAll(/agents\/([A-Za-z0-9_.-]+\.md)/g)) {
    if (!existsSync(join(root, agentRoot, file))) {
      fail(`${rel}: references missing persona file agents/${file}`);
    }
  }
}

// 5. Commands
if (commandRoot) {
  const commandNames = new Set();
  for (const entry of readdirSync(join(root, commandRoot), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const rel = join(commandRoot, entry.name);
    const fields = parseFrontmatter(rel);
    const expected = entry.name.replace(/\.md$/, "");
    if (fields.name && fields.name !== expected) {
      fail(`${rel}: frontmatter name "${fields.name}" does not match file name "${expected}"`);
    }
    if (!fields.description) fail(`${rel}: frontmatter description is missing`);
    if (commandNames.has(expected)) fail(`${rel}: duplicate command name "${expected}"`);
    commandNames.add(expected);

    const body = read(rel);
    const skillRef = /`([a-z0-9-]+):([a-z0-9-]+)`/.exec(body);
    if (!skillRef) {
      fail(`${rel}: no skill reference found`);
    } else if (!skillNames.has(skillRef[2])) {
      fail(`${rel}: references unknown skill ${skillRef[2]}`);
    }
  }
}

// 6. Persona types referenced by skills exist
const personas = new Set(personaNames.keys());
for (const rel of skillNames.values()) {
  const body = read(rel);
  for (const [, name] of body.matchAll(/`(egm-[a-z0-9-]+)`/g)) {
    if (!personas.has(name) && !skillNames.has(name)) {
      fail(`${rel}: unknown name "${name}" — not a persona and not a skill`);
    }
  }
}

if (!existsSync(join(root, "LICENSE"))) fail("LICENSE is missing");

if (errors.length > 0) {
  console.error(`Plugin validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(
  `Plugin ${manifest.name} ${manifest.version} ok: ${skillNames.size} skills, ${personaNames.size} personas, ${commandRoot ? "commands present" : "no commands"}.`,
);