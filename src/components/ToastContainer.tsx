import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotifications, NotificationType } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'

const typeConfig: Record<
  NotificationType,
  { icon: typeof AlertCircle; bgColor: string; textColor: string; borderColor: string }
> = {
  error: {
    icon: AlertCircle,
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/30',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/30',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/30',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-600',
    borderColor: 'border-green-500/30',
  },
}

export function ToastContainer() {
  const { toasts, dismissToast } = useNotifications()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const config = typeConfig[toast.type]
        const Icon = config.icon

        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-right-full duration-300',
              config.bgColor,
              config.borderColor
            )}
          >
            <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.textColor)} />
            <p className={cn('text-sm font-medium flex-1', config.textColor)}>{toast.message}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 -mt-1 -mr-2 hover:bg-transparent"
              onClick={() => dismissToast(toast.id)}
            >
              <X className={cn('h-4 w-4', config.textColor)} />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
