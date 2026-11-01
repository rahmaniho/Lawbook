import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterContracts } from '../src/lib/contract-search.ts';

const data = JSON.parse(fs.readFileSync(new URL('../data/contracts/contracts.json', import.meta.url), 'utf8'));
const education = JSON.parse(fs.readFileSync(new URL('../data/contracts/education.json', import.meta.url), 'utf8'));
const original = ['civil-sale-movable','civil-lease','civil-loan','civil-settlement','civil-agency','civil-guarantee','labor-fixed-term','labor-indefinite','labor-apprentice','labor-contractor','comm-company','comm-agency','comm-distribution','comm-transport','comm-insurance','re-sale','re-lease-residential','re-presale','re-partnership-build','fam-marriage','fam-divorce-agreement','fam-custody','fam-nafaqa','svc-consulting','svc-professional','svc-maintenance','tech-software-dev','tech-nda','tech-sla','tech-hosting'];

test('100 new samples preserve all 30 original URLs and add 10 categories', () => {
  assert.equal(data.contracts.length, 130);
  assert.equal(data.topics.length, 17);
  for (const id of original) assert.ok(data.contracts.some((c) => c.id === id), id);
  assert.equal(data.contracts.filter((c) => !original.includes(c.id)).length, 100);
  assert.equal(new Set(data.contracts.map((c) => c.id)).size, 130);
  assert.equal(new Set(data.contracts.map((c) => c.title)).size, 130);
  assert.equal(new Set(data.topics.map((t) => t.id)).size, 17);
});

test('every template has sequential Persian ماده, complete text, and an explicitly fictional filled example', () => {
  for (const c of data.contracts) {
    assert.match(c.id, /^[a-z0-9-]+$/);
    assert.ok(data.topics.some((t) => t.id === c.topic), c.id);
    assert.ok(c.parties.length);
    assert.ok(c.clauses.length >= 12, c.id);
    assert.match(c.example.label, /فرضی/);
    assert.equal(c.clauses.length, c.example.clauses.length);
    c.clauses.forEach((clause, index) => {
      const number = String(index + 1).replace(/[0-9]/g, (n) => '۰۱۲۳۴۵۶۷۸۹'[Number(n)]);
      assert.ok(clause.title.startsWith(`ماده ${number} - `), c.id);
      assert.ok(clause.text.length >= 60, `${c.id}: ${clause.title}`);
      assert.equal(c.example.clauses[index].title, clause.title);
      assert.doesNotMatch(c.example.clauses[index].text, /\[[^\]]+\]|\.{3,}|[\u0400-\u04ff]/u, c.id);
    });
  }
});

test('each category has multiple samples and a tailored drafting checklist', () => {
  for (const topic of data.topics) {
    assert.ok(data.contracts.filter((c) => c.topic === topic.id).length >= 3, topic.id);
    const guide = education.topicGuides.find((g) => g.topic === topic.id);
    assert.ok(guide && guide.text.length > 90, topic.id);
    assert.ok(guide.checklist.length >= 4, topic.id);
  }
});

test('lessons include instruction, risky/better clauses, common mistake, checklist and exercise', () => {
  assert.equal(education.lessons.length, 12);
  assert.equal(new Set(education.lessons.map((l) => l.id)).size, 12);
  for (const lesson of education.lessons) {
    assert.ok(lesson.sections.length >= 4);
    assert.ok(lesson.sections[0].text.length >= 200);
    assert.ok(lesson.checklist.length >= 3);
    assert.ok(lesson.exercise.length > 60);
  }
});

test('contract search handles Persian/Arabic forms, operative clauses, topics, and empty results', () => {
  assert.equal(filterContracts(data.contracts, data.topics, 'all', '').length, 130);
  assert.equal(filterContracts(data.contracts, data.topics, 'all', 'واژهآزمایشیویژه', {'tech-hosting':'واژهآزمایشیویژه'})[0].id, 'tech-hosting');
  assert.ok(filterContracts(data.contracts, data.topics, 'all', 'كاميون').length === 0);
  assert.ok(filterContracts(data.contracts, data.topics, 'all', 'آبياري').some((c) => c.id === 'agri-irrigation'));
  assert.ok(filterContracts(data.contracts, data.topics, 'all', 'پشتیبان بازیابی').some((c) => c.id === 'tech-hosting'));
  assert.ok(filterContracts(data.contracts, data.topics, 'vehicles', '').every((c) => c.topic === 'vehicles'));
  assert.equal(filterContracts(data.contracts, data.topics, 'vehicles', 'گلخانه').length, 0);
  assert.equal(filterContracts(data.contracts, data.topics, 'all', 'عبارتناموجودقطعی').length, 0);
});

test('special relationships do not inherit misleading generic financial/term examples', () => {
  const byId = (id) => data.contracts.find((c) => c.id === id);
  assert.match(byId('civil-guarantee').clauses[4].text, /طلبکار/);
  assert.match(byId('civil-guarantee').clauses[5].text, /انتقال دین/);
  assert.match(byId('civil-loan').example.clauses[3].text, /بدون سود/);
  assert.match(byId('labor-indefinite').example.clauses[2].text, /نامعین/);
  assert.doesNotMatch(byId('labor-indefinite').example.clauses[2].text, /۱۴۰۶\/۰۲\/۱۵/);
  assert.match(byId('tech-nda').example.clauses[3].text, /اجرت مستقلی تعیین نشده/);
});
