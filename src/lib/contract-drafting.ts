import type { ContractTemplate } from './contracts';

export interface DraftField { id: string; label: string; hint: string }
export interface ClauseSuggestion {
  clauseIndex: number;
  text: string;
  reason: string;
  articleIds: string[];
}
export interface SuggestionCatalog {
  sources: Record<string, string>;
  suggestions: Record<string, ClauseSuggestion[]>;
}

export function suggestionsForClause(catalog: SuggestionCatalog, contractId: string, index: number): ClauseSuggestion[] {
  return (catalog.suggestions[contractId] ?? []).filter((suggestion) => suggestion.clauseIndex === index);
}

export function suggestionReferences(catalog: SuggestionCatalog, suggestion: ClauseSuggestion) {
  return suggestion.articleIds.map((id) => {
    const match = id.match(/^(.*)-(\d+)$/);
    const lawId = match?.[1] ?? '';
    return { id, lawTitle: catalog.sources[lawId] ?? lawId, number: match?.[2] ?? '' };
  });
}

/** Bracketed prompts are deliberately not replaced with guesses from the user's form. */
export function hasUnresolvedPrompt(text: string): boolean {
  // A partially deleted marker is still an unresolved drafting prompt.
  return text.includes('⟦') || text.includes('⟧');
}
export interface DraftConfig {
  topicFields: Record<string, DraftField[]>;
  contractFields: Record<string, DraftField[]>;
  formalWorkbooks: Record<string, string>;
}
export interface AddedClause { id: string; title: string; text: string }
export interface DraftInput {
  basics: Record<string, string>;
  details: Record<string, string>;
  clauses: Record<string, string>;
  additions: AddedClause[];
}

export const BASIC_FIELDS = [
  { id: 'partyOne', label: 'نام/عنوان طرف اول', required: true },
  { id: 'partyOneId', label: 'شناسه و سمت طرف اول', required: false },
  { id: 'partyOneAddress', label: 'نشانی ابلاغ طرف اول', required: false },
  { id: 'partyTwo', label: 'نام/عنوان طرف دوم', required: true },
  { id: 'partyTwoId', label: 'شناسه و سمت طرف دوم', required: false },
  { id: 'partyTwoAddress', label: 'نشانی ابلاغ طرف دوم', required: false },
  { id: 'subject', label: 'موضوع مشخص توافق', required: true },
  { id: 'placeAndDate', label: 'محل و تاریخ تنظیم', required: false },
  { id: 'attachments', label: 'فهرست پیوست‌ها', required: false },
] as const;

export function emptyDraft(): DraftInput {
  return { basics: {}, details: {}, clauses: {}, additions: [] };
}

export function draftFields(config: DraftConfig, contract: ContractTemplate): DraftField[] {
  return [...(config.topicFields[contract.topic] ?? []), ...(config.contractFields[contract.id] ?? [])];
}

const filled = (value: string | undefined) => (value ?? '').trim();

/** Only user-entered wording reaches the printable document; educational prompts never become terms. */
export function prepareDraft(config: DraftConfig, contract: ContractTemplate, input: DraftInput) {
  const basics = BASIC_FIELDS.map(({ id, label }) => ({ id, label, text: filled(input.basics[id]) }))
    .filter((item) => item.text);
  const facts = draftFields(config, contract).map(({ id, label }) => ({ id, label, text: filled(input.details[id]) }))
    .filter((item) => item.text);
  const clauses = contract.clauses.map((clause, index) => ({
    id: String(index), title: clause.title, text: filled(input.clauses[String(index)]),
  })).filter((clause) => clause.text);
  const additions = input.additions.map((clause) => ({
    id: clause.id, title: filled(clause.title), text: filled(clause.text),
  })).filter((clause) => clause.title && clause.text);
  const incompleteAdditions = input.additions.filter((clause) => Boolean(filled(clause.title)) !== Boolean(filled(clause.text))).length;
  const missingClauses = contract.clauses.filter((_, index) => !filled(input.clauses[String(index)])).map((clause) => clause.title);
  const issues = [
    ...BASIC_FIELDS.filter((field) => field.required && !filled(input.basics[field.id])).map((field) => `${field.label} را وارد کنید.`),
    ...(!clauses.length && !additions.length ? ['دست‌کم یک بند توافقی را با متن خودتان بنویسید.'] : []),
    ...(incompleteAdditions ? ['عنوان و متن بندهای افزوده‌شده را کامل کنید یا آنها را حذف کنید.'] : []),
    ...([...clauses, ...additions].some((clause) => hasUnresolvedPrompt(clause.text))
      ? ['جای‌خالی‌های ⟦...⟧ در بندها را با اطلاعات واقعی جایگزین کنید.'] : []),
  ];
  return {
    basics, facts, clauses, additions, missingClauses, issues,
    formalNotice: config.formalWorkbooks[contract.id] ?? '',
    printable: issues.length === 0,
  };
}
