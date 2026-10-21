import test from 'node:test';
import assert from 'node:assert/strict';
import { repairSkillFrontmatter, validateSkillFrontmatter } from './skill-frontmatter.mjs';

const skill = (description, name = 'bmad-retrospective') =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# Existing workflow\n`;

test('repairs malformed upstream apostrophe without changing the skill body', () => {
  const source = skill("'Review each ticket's story and the epic's results'");
  assert.throws(() => validateSkillFrontmatter(source, 'bmad-retrospective'), /unescaped apostrophe/);
  const repaired = repairSkillFrontmatter(source, 'bmad-retrospective');
  assert.match(repaired, /description: "Review each ticket's story and the epic's results"/);
  assert.ok(repaired.endsWith('# Existing workflow\n'));
  assert.doesNotThrow(() => validateSkillFrontmatter(repaired, 'bmad-retrospective'));
  assert.equal(repairSkillFrontmatter(repaired, 'bmad-retrospective'), repaired);
});

test('preserves valid quoted and unquoted upstream metadata verbatim', () => {
  for (const description of ["'It''s a valid YAML description'", "A valid plain description", '"A valid \\"quoted\\" description"']) {
    const source = skill(description);
    assert.doesNotThrow(() => validateSkillFrontmatter(source, 'bmad-retrospective'));
    assert.equal(repairSkillFrontmatter(source, 'bmad-retrospective'), source);
  }
});

test('quotes plain descriptions containing YAML-significant colon or comment', () => {
  for (const description of ['Build: then verify', 'Review # guidance']) {
    const source = skill(description);
    assert.throws(() => validateSkillFrontmatter(source, 'bmad-retrospective'));
    const fixed = repairSkillFrontmatter(source, 'bmad-retrospective');
    assert.doesNotThrow(() => validateSkillFrontmatter(fixed, 'bmad-retrospective'));
    assert.ok(fixed.includes(JSON.stringify(description)));
  }
});

test('rejects unexpected fields and mismatched skill names rather than silently dropping metadata', () => {
  assert.throws(() => repairSkillFrontmatter(skill('Hello', 'another-skill'), 'bmad-retrospective'), /invalid SKILL.md name/);
  assert.throws(() => repairSkillFrontmatter('---\nname: bmad-retrospective\nsummary: Missing description\n---\n', 'bmad-retrospective'), /unsupported/);
  assert.throws(() => validateSkillFrontmatter(skill('"bad \\q escape"'), 'bmad-retrospective'), /invalid double-quoted/);
});
