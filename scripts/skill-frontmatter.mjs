const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readFrontmatter(markdown, expectedName) {
  const match = FRONTMATTER.exec(markdown);
  if (!match) throw new Error(`${expectedName}: missing SKILL.md YAML frontmatter`);
  const lines = match[1].split(/\r?\n/);
  if (lines.length !== 2 || !lines[0].startsWith('name: ') || !lines[1].startsWith('description: ')) {
    throw new Error(`${expectedName}: unsupported SKILL.md frontmatter fields (expected name and description)`);
  }
  const name = lines[0].slice('name: '.length);
  if (!SKILL_NAME.test(name) || name !== expectedName) {
    throw new Error(`${expectedName}: invalid SKILL.md name: ${name}`);
  }
  return { match, description: lines[1].slice('description: '.length) };
}

function decodeDescription(raw, tolerant = false) {
  let description;
  if (raw.startsWith("'")) {
    if (raw.length < 2 || !raw.endsWith("'")) throw new Error('unterminated single-quoted description');
    const inner = raw.slice(1, -1);
    if (!tolerant && !/^(?:[^']|'')*$/.test(inner)) {
      throw new Error('unescaped apostrophe in single-quoted description');
    }
    description = inner.replace(/''/g, "'");
  } else if (raw.startsWith('"')) {
    try {
      description = JSON.parse(raw);
    } catch {
      throw new Error('invalid double-quoted description');
    }
  } else {
    // Plain YAML strings cannot contain a colon followed by whitespace, a comment,
    // or leading syntax that would turn the value into another YAML data type.
    const unsafe = /:\s|(?:^|\s)#/.test(raw) ||
      /^[\[\]{},&*!|>%@`]|^[?:-]\s|^(?:null|~|true|false)(?:\s|$)/i.test(raw) ||
      /^[0-9]+(?:\.[0-9]+)?$/.test(raw);
    if (!tolerant && unsafe) throw new Error('unsafe plain YAML description');
    description = raw;
  }
  if (typeof description !== 'string' || !description.trim()) {
    throw new Error('description must be a non-empty string');
  }
  return description;
}

export function validateSkillFrontmatter(markdown, expectedName) {
  const { description } = readFrontmatter(markdown, expectedName);
  try {
    decodeDescription(description);
  } catch (error) {
    throw new Error(`${expectedName}/SKILL.md: ${error.message}`);
  }
}

export function repairSkillFrontmatter(markdown, expectedName) {
  const { match, description } = readFrontmatter(markdown, expectedName);
  try {
    decodeDescription(description);
    return markdown;
  } catch {
    const safeDescription = JSON.stringify(decodeDescription(description, true));
    return `---\nname: ${expectedName}\ndescription: ${safeDescription}\n---` + markdown.slice(match[0].length);
  }
}
