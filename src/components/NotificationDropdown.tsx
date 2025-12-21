import { useState } from 'react'
import { Bell, AlertCircle, AlertTriangle, Info, CheckCircle, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotifications, NotificationType } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'

const typeConfig: Record<
  NotificationType,
  { icon: typeof AlertCircle; color: string; bg: string }
> = {
  error: {
    icon: AlertCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-500/10',
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-500/10',
  },
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`

  return date.toLocaleDateString()
}

export function NotificationDropdown() {
  const { notifications, unreadCount, markAllRead, clearNotifications, clearNotification } =
    useNotifications()
  const [isOpen, setIsOpen] = useState(false)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && unreadCount > 0) {
      // Mark as read after a brief delay so user sees the unread state
      setTimeout(markAllRead, 500)
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-medium text-sm">Notifications</span>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => clearNotifications()}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type]
                const Icon = config.icon

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'px-3 py-2 hover:bg-muted/50 transition-colors relative group',
                      !notification.read && 'bg-muted/30'
                    )}
                  >
                    <div className="flex gap-2">
                      <div className={cn('mt-0.5 p-1 rounded', config.bg)}>
                        <Icon className={cn('h-3 w-3', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium', config.color)}>
                          {notification.summary}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {formatTimeAgo(notification.timestamp)}
                        </p>
                        {notification.message !== notification.summary && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Details
                            </summary>
                            <pre className="mt-1 text-xs font-mono p-2 bg-muted rounded text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                              {notification.message}
                            </pre>
                          </details>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          clearNotification(notification.id)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {!notification.read && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
