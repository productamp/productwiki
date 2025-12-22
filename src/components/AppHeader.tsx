import { Link } from 'react-router-dom'
import { Hexagon } from 'lucide-react'
import { SettingsButton } from '@/components/Settings'
import { NotificationDropdown } from '@/components/NotificationDropdown'
import { ReactNode } from 'react'

interface AppHeaderProps {
  title?: string
  titleHref?: string
  subtitle?: string
  actions?: ReactNode
}

export function AppHeader({ title, titleHref, subtitle, actions }: AppHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Hexagon className="h-5 w-5" />
          <span className="font-semibold">ProductQ</span>
        </Link>
        {title && (
          <>
            <span className="text-muted-foreground">/</span>
            {titleHref ? (
              <Link to={titleHref} className="font-medium text-sm hover:opacity-80 transition-opacity">
                {title}
              </Link>
            ) : (
              <span className="font-medium text-sm">{title}</span>
            )}
          </>
        )}
        {subtitle && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground text-sm">{subtitle}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <NotificationDropdown />
        <SettingsButton />
      </div>
    </div>
  )
}
