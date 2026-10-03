import { Link } from 'react-router'
import { FileQuestion } from 'lucide-react'
import { AppBar } from '../components/layout/AppBar'
import { EmptyState } from '../components/ui/EmptyState'

export default function NotFoundPage() {
  return (
    <div className="pb-nav">
      <AppBar back title="صفحه یافت نشد" />
      <EmptyState
        icon={<FileQuestion className="h-7 w-7" />}
        title="این صفحه وجود ندارد"
        description="ممکن است پیوند اشتباه باشد."
        action={
          <Link to="/" className="font-medium text-brand">
            بازگشت به خانه
          </Link>
        }
      />
    </div>
  )
}
