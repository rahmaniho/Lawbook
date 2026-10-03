import { Landmark, Scale, Gavel, Users, Briefcase, HardHat, Building2, FileText, Receipt, Layers, type LucideProps } from 'lucide-react'
import type { CategoryId } from '../../lib/types'

const ICONS: Record<CategoryId, React.ComponentType<LucideProps>> = {
  public: Landmark,
  civil: Scale,
  criminal: Gavel,
  family: Users,
  commercial: Briefcase,
  labor: HardHat,
  administrative: Building2,
  'civil-procedure': FileText,
  tax: Receipt,
  other: Layers,
}

export function CategoryIcon({ id, ...props }: { id: CategoryId } & LucideProps) {
  const Icon = ICONS[id] ?? Layers
  return <Icon {...props} />
}
