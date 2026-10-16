import { notFound } from 'next/navigation';
import { ContractDraftEditor } from '@/components/contract-draft-editor';
import { CONTRACTS, getContract } from '@/lib/contracts';

export const dynamicParams = false;
export function generateStaticParams() {
  return CONTRACTS.map((contract) => ({ contractId: contract.id }));
}

export default async function DraftEditorPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  if (!getContract(contractId)) notFound();
  return <ContractDraftEditor contractId={contractId} />;
}
