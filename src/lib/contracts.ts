import data from '@data/contracts/contracts.json';

export interface ContractClause { title: string; text: string; }
export interface ContractTemplate {
  id: string;
  topic: string;
  title: string;
  summary: string;
  parties: string[];
  clauses: ContractClause[];
  notes?: string;
}
export interface ContractTopic { id: string; title: string; description: string; color: string; }

const d = data as { topics: ContractTopic[]; contracts: ContractTemplate[] };

export const CONTRACT_TOPICS: ContractTopic[] = d.topics;
export const CONTRACTS: ContractTemplate[] = d.contracts;

export function getTopic(id: string) { return CONTRACT_TOPICS.find((t) => t.id === id); }
export function getContract(id: string) { return CONTRACTS.find((c) => c.id === id); }
export function contractsByTopic(topicId: string) { return CONTRACTS.filter((c) => c.topic === topicId); }
