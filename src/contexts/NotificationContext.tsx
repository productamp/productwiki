import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { getServerLogs, clearServerLogs } from '@/lib/api'

export type NotificationType = 'error' | 'warning' | 'info' | 'success'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  summary: string
  timestamp: Date
  read: boolean
}

export interface Toast {
  id: string
  type: NotificationType
  message: string
  autoDismiss?: boolean
}

interface NotificationContextType {
  notifications: Notification[]
  toasts: Toast[]
  unreadCount: number
  addNotification: (type: NotificationType, message: string, summary?: string) => void
  addToast: (type: NotificationType, message: string, autoDismiss?: boolean) => void
  dismissToast: (id: string) => void
  markAllRead: () => void
  clearNotifications: () => void
  clearNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

/**
 * Parse server log to extract notification level
 */
function parseServerLog(log: string): { type: NotificationType; message: string; summary: string } {
  const message = log

  // Rate limit messages are warnings (expected behavior during key rotation)
  if (log.includes('Rate limit hit') || log.includes('cooldown')) {
    const keyMatch = log.match(/on "([^"]+)"/)
    const keyName = keyMatch ? keyMatch[1] : 'API key'
    return {
      type: 'warning',
      message,
      summary: `Rate limit - switching from ${keyName}`,
    }
  }

  // All keys in cooldown is more serious
  if (log.includes('All') && log.includes('keys in cooldown')) {
    return {
      type: 'warning',
      message,
      summary: 'All API keys in cooldown - waiting',
    }
  }

  // 429 errors
  if (log.includes('429') || log.includes('Too Many Requests')) {
    return {
      type: 'error',
      message,
      summary: 'Rate limit exceeded',
    }
  }

  // Auth errors
  if (log.includes('401') || log.includes('Unauthorized') || log.includes('Invalid') && log.includes('key')) {
    return {
      type: 'error',
      message,
      summary: 'Authentication failed',
    }
  }

  // Server errors
  if (log.includes('500') || log.includes('Internal Server Error')) {
    return {
      type: 'error',
      message,
      summary: 'Server error',
    }
  }

  // Connection errors
  if (log.includes('ECONNREFUSED') || log.includes('ENOTFOUND') || log.includes('Network')) {
    return {
      type: 'error',
      message,
      summary: 'Connection failed',
    }
  }

  // Timeout
  if (log.includes('timeout') || log.includes('ETIMEDOUT')) {
    return {
      type: 'error',
      message,
      summary: 'Request timed out',
    }
  }

  // Gemini API errors
  if (log.includes('GoogleGenerativeAI') || log.includes('Gemini')) {
    if (log.includes('not enabled') || log.includes('not supported')) {
      return {
        type: 'warning',
        message,
        summary: 'Model feature not supported',
      }
    }
    return {
      type: 'error',
      message,
      summary: 'Gemini API error',
    }
  }

  // LLM errors
  if (log.includes('LLM error')) {
    return {
      type: 'error',
      message,
      summary: 'LLM generation failed',
    }
  }

  // Embedding errors
  if (log.includes('embedding') || log.includes('Embedding')) {
    return {
      type: 'error',
      message,
      summary: 'Embedding failed',
    }
  }

  // Default to error for unrecognized logs
  return {
    type: 'error',
    message,
    summary: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
  }
}

/**
 * Extract timestamp from log entry
 */
function extractTimestamp(log: string): Date {
  const match = log.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/)
  if (match) {
    return new Date(match[1])
  }
  return new Date()
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [lastLogCount, setLastLogCount] = useState(0)

  const unreadCount = notifications.filter((n) => !n.read).length

  const addNotification = useCallback((type: NotificationType, message: string, summary?: string) => {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      message,
      summary: summary || message.slice(0, 50),
      timestamp: new Date(),
      read: false,
    }
    setNotifications((prev) => [notification, ...prev].slice(0, 100))
  }, [])

  const addToast = useCallback((type: NotificationType, message: string, autoDismiss = true) => {
    const toast: Toast = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      message,
      autoDismiss,
    }
    setToasts((prev) => [...prev, toast])

    // Auto-dismiss after delay
    if (autoDismiss) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, type === 'error' ? 8000 : 4000)
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearNotifications = useCallback(async () => {
    setNotifications([])
    await clearServerLogs()
    setLastLogCount(0)
  }, [])

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  // Poll server logs and convert to notifications
  useEffect(() => {
    const pollLogs = async () => {
      try {
        const logs = await getServerLogs()

        // Only process new logs
        if (logs.length > lastLogCount) {
          const newLogs = logs.slice(0, logs.length - lastLogCount)

          for (const log of newLogs.reverse()) {
            const { type, message, summary } = parseServerLog(log)
            const timestamp = extractTimestamp(log)

            // Check if this notification already exists (by message content)
            const exists = notifications.some(
              (n) => n.message === message && Math.abs(n.timestamp.getTime() - timestamp.getTime()) < 1000
            )

            if (!exists) {
              const notification: Notification = {
                id: `${timestamp.getTime()}-${Math.random().toString(36).slice(2)}`,
                type,
                message,
                summary,
                timestamp,
                read: false,
              }
              setNotifications((prev) => [notification, ...prev].slice(0, 100))

              // Only show toast for errors (not warnings like rate limit rotation)
              if (type === 'error') {
                addToast(type, summary, true)
              }
            }
          }

          setLastLogCount(logs.length)
        } else if (logs.length < lastLogCount) {
          // Logs were cleared
          setLastLogCount(logs.length)
        }
      } catch {
        // Ignore polling errors
      }
    }

    pollLogs()
    const interval = setInterval(pollLogs, 3000)
    return () => clearInterval(interval)
  }, [lastLogCount, notifications, addToast])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toasts,
        unreadCount,
        addNotification,
        addToast,
        dismissToast,
        markAllRead,
        clearNotifications,
        clearNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
