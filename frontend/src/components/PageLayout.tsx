import { cn } from "@/lib/utils"
import Breadcrumb, { BreadcrumbItem } from "./Breadcrumb"

interface PageLayoutProps {
  children: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  maxWidth?: string
}

export default function PageLayout({ children, breadcrumbs, maxWidth = "max-w-4xl" }: PageLayoutProps) {
  return (
    <div className={cn("mx-auto px-4 py-8", maxWidth)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} />
      )}
      {children}
    </div>
  )
}
