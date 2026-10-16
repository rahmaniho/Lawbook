import { CONTRACTS } from '@/lib/contracts';
import ContractViewer from '@/components/contract-viewer';

export function generateStaticParams() {
  return CONTRACTS.map((c) => ({ contractId: c.id }));
}

export const dynamicParams = false;

export default function Page() {
  return <ContractViewer />;
}

export const dynamic = 'force-static';
