import { useEffect, useRef } from 'react'
import { useNotificationStore, type Notification } from '../stores/notification'

export function useNotificationSocket() {
  const addNotification = useNotificationStore((s) => s.addNotification)
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount)
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let mounted = true

    function connect() {
      const token = localStorage.getItem('access_token')
      if (!token) return

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${proto}://${window.location.host}/ws/notifications?token=${token}`

      try {
        wsRef.current = new WebSocket(url)

        wsRef.current.onopen = () => {
          retriesRef.current = 0
          fetchUnreadCount()
        }

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'notification' && data.payload) {
              addNotification(data.payload as Notification)
            }
          } catch {
            // ignore malformed messages
          }
        }

        wsRef.current.onclose = () => {
          if (!mounted) return
          const delay = Math.min(1000 * 2 ** retriesRef.current, 30000)
          retriesRef.current += 1
          timerRef.current = setTimeout(connect, delay)
        }

        wsRef.current.onerror = () => {
          wsRef.current?.close()
        }
      } catch {
        if (mounted) {
          timerRef.current = setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      mounted = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [addNotification, fetchUnreadCount])
}
