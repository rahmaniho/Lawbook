import data from '@data/contracts/contracts.json';
import education from '@data/contracts/education.json';

export interface ContractClause { title: string; text: string; }
export interface ContractTemplate {
  id: string;
  topic: string;
  title: string;
  summary: string;
  parties: string[];
  clauses: ContractClause[];
  notes?: string;
  example?: { label: string; clauses: ContractClause[] };
}
export interface ContractTopic { id: string; title: string; description: string; color: string; }
export interface ContractLesson {
  id: string;
  title: string;
  sections: { title: string; text: string }[];
  checklist: string[];
  exercise: string;
}
export interface ContractGuide { topic: string; title: string; text: string; checklist: string[]; }

export const CONTRACT_TOPICS: ContractTopic[] = data.topics;
export const CONTRACTS: ContractTemplate[] = data.contracts;
export const CONTRACT_LESSONS: ContractLesson[] = education.lessons;
export const CONTRACT_GUIDES: ContractGuide[] = education.guides;
export const CONTRACT_DISCLAIMER = education.disclaimer;

export function getTopic(id: string) { return CONTRACT_TOPICS.find((t) => t.id === id); }
export function getContract(id: string) { return CONTRACTS.find((c) => c.id === id); }
export function getContractGuide(topic: string) { return CONTRACT_GUIDES.find((g) => g.topic === topic); }
export function contractsByTopic(topicId: string) { return CONTRACTS.filter((c) => c.topic === topicId); }
