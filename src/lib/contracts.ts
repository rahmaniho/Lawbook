import data from '@data/contracts/contracts.json';
import education from '@data/contracts/education.json';
import workedExamples from '@data/contracts/case-studies.json';

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
export interface DraftingStep { title: string; detail: string; }
export interface DraftingComparison { title: string; weak: string; better: string; why: string; }
export interface ContractGuide {
  scenario: string;
  sample: string;
  lesson: string;
  checklist: string[];
}
export interface WorkedExample {
  id: string;
  contractId: string;
  title: string;
  situation: string;
  facts: string[];
  clauses: { heading: string; wording: string; rationale: string }[];
  payments?: { totalRials: number; items: { label: string; amountRials: number }[] };
  review: string[];
  references: { lawId: string; title: string }[];
  disclaimer?: string;
}

const d = data as { topics: ContractTopic[]; contracts: ContractTemplate[] };
const e = education as {
  steps: DraftingStep[];
  comparisons: DraftingComparison[];
  guides: Record<string, ContractGuide>;
};

export const CONTRACT_TOPICS: ContractTopic[] = d.topics;
export const CONTRACTS: ContractTemplate[] = d.contracts;
export const DRAFTING_STEPS = e.steps;
export const DRAFTING_COMPARISONS = e.comparisons;
export const CONTRACT_GUIDES = e.guides;
export const WORKED_EXAMPLES: WorkedExample[] = workedExamples.examples;

export function workedExamplesForContract(id: string) { return WORKED_EXAMPLES.filter((example) => example.contractId === id); }
export function getTopic(id: string) { return CONTRACT_TOPICS.find((t) => t.id === id); }
export function getContract(id: string) { return CONTRACTS.find((c) => c.id === id); }
export function getContractGuide(id: string) { return CONTRACT_GUIDES[id]; }
export function contractsByTopic(topicId: string) { return CONTRACTS.filter((c) => c.topic === topicId); }
