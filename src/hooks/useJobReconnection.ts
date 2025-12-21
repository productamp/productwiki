import { useEffect, useState, useRef, useCallback } from 'react'
import { getJobStatus, type WikiEvent } from '@/lib/api'

/**
 * Hook for reconnecting to simple streaming jobs (docs, prompts)
 * These jobs emit string chunks that are concatenated
 */
export function useSimpleJobReconnection({
  jobId,
  generator,
  onContent,
  cacheKey,
  enabled,
}: {
  jobId: string
  generator: () => AsyncGenerator<string>
  onContent: (content: string) => void
  cacheKey?: string
  enabled: boolean
}) {
  const [reconnecting, setReconnecting] = useState(false)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    if (!enabled || hasCheckedRef.current) return
    hasCheckedRef.current = true

    const checkAndReconnect = async () => {
      try {
        const status = await getJobStatus(jobId)
        if (status.status === 'running') {
          setReconnecting(true)

          try {
            let fullContent = ''
            for await (const chunk of generator()) {
              fullContent += chunk
              onContent(fullContent)
            }
            if (cacheKey) {
              localStorage.setItem(cacheKey, fullContent)
            }
          } finally {
            setReconnecting(false)
          }
        }
      } catch {
        // Job status check failed, ignore
      }
    }

    checkAndReconnect()
  }, [jobId, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset check when jobId changes
  useEffect(() => {
    hasCheckedRef.current = false
  }, [jobId])

  return { reconnecting }
}

/**
 * Hook for reconnecting to wiki-style jobs (wiki, product-docs)
 * These jobs emit structured WikiEvent objects
 */
export function useWikiJobReconnection({
  jobId,
  generator,
  processEvent,
  enabled,
}: {
  jobId: string
  generator: () => AsyncGenerator<WikiEvent>
  processEvent: (event: WikiEvent, pageIdRef: { value: string }, contentRef: { value: string }) => void
  enabled: boolean
}) {
  const [reconnecting, setReconnecting] = useState(false)
  const [status, setStatus] = useState('')
  const hasCheckedRef = useRef(false)

  const reconnect = useCallback(async () => {
    try {
      const jobStatus = await getJobStatus(jobId)
      if (jobStatus.status === 'running') {
        setReconnecting(true)
        setStatus('Reconnecting to generation...')

        const currentPageIdRef = { value: '' }
        const currentContentRef = { value: '' }

        try {
          for await (const event of generator()) {
            processEvent(event, currentPageIdRef, currentContentRef)
          }
        } finally {
          setReconnecting(false)
          setStatus('')
        }
      }
    } catch {
      // Job status check failed, ignore
    }
  }, [jobId, generator, processEvent])

  useEffect(() => {
    if (!enabled || hasCheckedRef.current) return
    hasCheckedRef.current = true
    reconnect()
  }, [enabled, reconnect])

  // Reset check when jobId changes
  useEffect(() => {
    hasCheckedRef.current = false
  }, [jobId])

  return { reconnecting, status, reconnect }
}
