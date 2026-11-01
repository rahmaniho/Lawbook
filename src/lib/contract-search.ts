import { normalizeForSearch } from './fa';
import type { ContractTemplate, ContractTopic } from './contracts';

/** All terms must match, including operative clauses and topic descriptions. */
export function filterContracts(contracts: ContractTemplate[], topics: ContractTopic[], topic: string, query: string, context: Record<string, string> = {}) {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  return contracts.filter((c) => {
    if (topic !== 'all' && c.topic !== topic) return false;
    const category = topics.find((t) => t.id === c.topic);
    const text = normalizeForSearch([
      context[c.id], c.title, c.summary, c.parties.join(' '), c.notes,
      category?.title, category?.description,
      ...c.clauses.map((clause) => `${clause.title} ${clause.text}`),
    ].join(' '));
    return terms.every((term) => text.includes(term));
  });
}
