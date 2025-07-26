'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback, useMemo } from 'react'
import { type RealtimeSubscription, type TableName } from '@/lib/hooks/use-realtime'
import { useAutoRefresh, type RefreshFunction } from '@/lib/hooks/use-auto-refresh'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface RealtimeContextValue {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  connectionError: Error | null
  
  // Subscription management
  subscribe: (subscription: RealtimeSubscription) => () => void
  unsubscribe: (table: TableName) => void
  
  // Auto-refresh coordination
  registerRefreshFunction: (key: string, refreshFn: RefreshFunction) => void
  unregisterRefreshFunction: (key: string) => void
  triggerRefresh: (key?: string) => void
  
  // Network state
  isOnline: boolean
  
  // Statistics
  activeSubscriptions: string[]
  totalRefreshes: number
}

interface RealtimeProviderProps {
  children: ReactNode
  enableToasts?: boolean
  enableNetworkDetection?: boolean
  debugMode?: boolean
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined)

export function RealtimeProvider({ 
  children, 
  enableToasts = true, 
  enableNetworkDetection = true,
  debugMode = false 
}: RealtimeProviderProps) {
  
  // Network state - start with true to avoid hydration mismatch, will be updated on client
  const [isOnline, setIsOnline] = useState(true)
  const [isClient, setIsClient] = useState(false)
  
  // Subscription management
  const [activeSubscriptions, setActiveSubscriptions] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const subscriptionsRef = useRef<Map<string, RealtimeSubscription>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())
  
  // Refresh function registry
  const refreshFunctionsRef = useRef<Map<string, RefreshFunction>>(new Map())
  const [totalRefreshes, setTotalRefreshes] = useState(0)
  
  // Stable refresh function that doesn't change on every render
  const executeGlobalRefresh = useCallback(async () => {
    // Execute all registered refresh functions
    const refreshPromises = Array.from(refreshFunctionsRef.current.values()).map(fn => {
      try {
        return Promise.resolve(fn())
      } catch (error) {
        console.error('Refresh function error:', error)
        return Promise.resolve()
      }
    })
    
    await Promise.allSettled(refreshPromises)
    setTotalRefreshes(prev => prev + 1)
  }, [])

  // Error handler that's stable
  const handleGlobalRefreshError = useCallback((error: Error) => {
    if (enableToasts) {
      toast.error('Sync Error', {
        description: 'Failed to sync data. Please refresh manually.'
      })
    }
    if (debugMode) {
      console.error('Global refresh error:', error)
    }
  }, [enableToasts, debugMode])

  // Global auto-refresh for coordinating multiple refresh functions
  const globalAutoRefresh = useAutoRefresh({
    refreshFn: executeGlobalRefresh,
    enabled: true,
    debounceMs: 1000, // Increased to prevent rapid triggers
    throttleMs: 2000,  // Increased to prevent rapid refreshes
    onRefreshError: handleGlobalRefreshError
  })

  // Extract stable trigger functions with refs to prevent dependency issues
  const triggerGlobalRefreshRef = useRef(globalAutoRefresh.trigger)
  const triggerGlobalRefreshImmediateRef = useRef(globalAutoRefresh.triggerImmediate)
  
  // Update refs when functions change
  triggerGlobalRefreshRef.current = globalAutoRefresh.trigger
  triggerGlobalRefreshImmediateRef.current = globalAutoRefresh.triggerImmediate
  
  // Create stable function references
  const triggerGlobalRefresh = useCallback(() => {
    triggerGlobalRefreshRef.current()
  }, [])
  
  const triggerGlobalRefreshImmediate = useCallback(() => {
    triggerGlobalRefreshImmediateRef.current()
  }, [])


  // Track unique table subscriptions to prevent redundant channel recreation
  const uniqueTables = useMemo(() => {
    return Array.from(new Set(Array.from(subscriptionsRef.current.values()).map(sub => sub.table)))
  }, [activeSubscriptions])

  // Debounce unique tables to avoid frequent channel recreation  
  const debouncedUniqueTables = useDebounce(uniqueTables, 2000) // Increased to prevent rapid channel recreation

  // Toast deduplication - prevent spam
  const lastToastRef = useRef<{ type: string; time: number } | null>(null)
  const TOAST_COOLDOWN = 5000 // 5 seconds between same toast types to prevent spam

  // Stable showToast function to prevent effect dependencies from changing
  const showToastRef = useRef<(type: 'connected' | 'disconnected' | 'error', message: string, description: string) => void>(() => {})
  
  showToastRef.current = useCallback((type: 'connected' | 'disconnected' | 'error', message: string, description: string) => {
    if (!enableToasts) return
    
    const now = Date.now()
    const lastToast = lastToastRef.current
    
    // Prevent showing same toast type within cooldown period
    if (lastToast && lastToast.type === type && (now - lastToast.time) < TOAST_COOLDOWN) {
      return
    }
    
    lastToastRef.current = { type, time: now }
    
    switch (type) {
      case 'connected':
        toast.success(message, { description, duration: 2000 })
        break
      case 'disconnected':
        toast.error(message, { description, duration: 4000 })
        break  
      case 'error':
        toast.error(message, { description, duration: 5000 })
        break
    }
  }, [enableToasts])
  
  const showToast = useCallback((type: 'connected' | 'disconnected' | 'error', message: string, description: string) => {
    showToastRef.current?.(type, message, description)
  }, [])

  // Track previous unique tables to avoid unnecessary recreation
  const prevUniqueTablesRef = useRef<string[]>([])
  
  // Manual realtime channel management
  useEffect(() => {
    const supabase = supabaseRef.current
    
    if (!isOnline || subscriptionsRef.current.size === 0) {
      // Clean up if offline or no subscriptions
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        setIsConnected(false)
        setIsConnecting(false)
      }
      return
    }

    // Don't recreate if no unique tables (safety check)
    if (debouncedUniqueTables.length === 0) {
      return
    }

    // Check if unique tables actually changed to avoid unnecessary recreation
    const currentTablesStr = debouncedUniqueTables.sort().join(',')
    const prevTablesStr = prevUniqueTablesRef.current.sort().join(',')
    
    if (currentTablesStr === prevTablesStr && channelRef.current) {
      // No change in tables and channel exists, skip recreation
      return
    }
    
    prevUniqueTablesRef.current = [...debouncedUniqueTables]

    const setupChannel = async () => {
      try {
        // Clean up existing channel first
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current)
          channelRef.current = null
          // Brief delay to ensure cleanup completes
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        setIsConnecting(true)
        setIsConnected(false)
        
        const channel = supabase.channel(`realtime-sync-${Date.now()}`)

        // Set up all subscriptions
        subscriptionsRef.current.forEach((subscription) => {
          const config: Record<string, unknown> = {
            event: subscription.event || '*',
            schema: 'public',
            table: subscription.table
          }
          if (subscription.filter) {
            config.filter = subscription.filter
          }
          channel.on(
            'postgres_changes' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            config,
            (payload) => {
              if (debugMode) {
                console.log('Realtime change detected:', {
                  table: payload.table,
                  eventType: payload.eventType,
                  new: payload.new,
                  old: payload.old
                })
              }
              subscription.callback(payload)
              // Trigger global refresh
              triggerGlobalRefresh()
            }
          )
        })

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true)
            setIsConnecting(false)
            showToast('connected', 'Connected', 'Real-time sync is active')
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsConnected(false)
            setIsConnecting(false)
            if (status === 'CHANNEL_ERROR') {
              showToast('error', 'Connection Error', 'Real-time sync encountered an error')
            } else {
              showToast('disconnected', 'Disconnected', 'Real-time sync is offline')
            }
          }
        })

        channelRef.current = channel
      } catch (error) {
        console.error('Failed to setup realtime channel:', error)
        setIsConnecting(false)
        setIsConnected(false)
        showToast('error', 'Connection Error', 'Failed to establish real-time connection')
      }
    }

    setupChannel()

    return () => {
      const channel = channelRef.current
      if (channel) {
        supabase.removeChannel(channel)
        channelRef.current = null
      }
    }
  }, [isOnline, debouncedUniqueTables, showToast, debugMode, triggerGlobalRefresh])

  // Initialize client state and network state on client side to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true)
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }
  }, [])

  // Network detection
  useEffect(() => {
    if (!enableNetworkDetection || !isClient) return

    const handleOnline = () => {
      setIsOnline(true)
      if (enableToasts) {
        toast.success('Back Online', {
          description: 'Reconnecting to real-time sync...',
          duration: 2000
        })
      }
      // Trigger refresh when coming back online
      setTimeout(() => triggerGlobalRefreshImmediate(), 1000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      if (enableToasts) {
        toast.error('Offline', {
          description: 'Real-time sync is paused'
        })
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [enableNetworkDetection, enableToasts, triggerGlobalRefreshImmediate, isClient])

  // Subscribe to table changes with improved deduplication
  const subscribe = useCallback((subscription: RealtimeSubscription): (() => void) => {
    const key = `${subscription.table}_${subscription.event || '*'}_${subscription.filter || 'all'}`
    
    // Check if subscription already exists
    if (subscriptionsRef.current.has(key)) {
      if (debugMode) {
        console.log('Subscription already exists, skipping:', key)
      }
      // Return the existing unsubscribe function
      return () => {
        if (subscriptionsRef.current.has(key)) {
          subscriptionsRef.current.delete(key)
          setActiveSubscriptions(prev => prev.filter(k => k !== key))
          if (debugMode) {
            console.log('Unsubscribed from:', key)
          }
        }
      }
    }
    
    subscriptionsRef.current.set(key, subscription)
    setActiveSubscriptions(prev => {
      // Avoid duplicate entries in array
      if (prev.includes(key)) {
        return prev
      }
      return [...prev, key]
    })
    
    if (debugMode) {
      console.log('Subscribed to:', key)
    }

    // Return unsubscribe function
    return () => {
      if (subscriptionsRef.current.has(key)) {
        subscriptionsRef.current.delete(key)
        setActiveSubscriptions(prev => prev.filter(k => k !== key))
        if (debugMode) {
          console.log('Unsubscribed from:', key)
        }
      }
    }
  }, [debugMode])

  // Unsubscribe from table
  const unsubscribe = useCallback((table: TableName) => {
    const keysToRemove = Array.from(subscriptionsRef.current.keys()).filter(key => 
      key.startsWith(`${table}_`)
    )
    
    keysToRemove.forEach(key => {
      subscriptionsRef.current.delete(key)
    })
    
    setActiveSubscriptions(prev => prev.filter(k => !keysToRemove.includes(k)))
    
    if (debugMode) {
      console.log('Unsubscribed from table:', table, 'Keys removed:', keysToRemove)
    }
  }, [debugMode])

  // Register refresh function
  const registerRefreshFunction = useCallback((key: string, refreshFn: RefreshFunction) => {
    refreshFunctionsRef.current.set(key, refreshFn)
    if (debugMode) {
      console.log('Registered refresh function:', key)
    }
  }, [debugMode])

  // Unregister refresh function
  const unregisterRefreshFunction = useCallback((key: string) => {
    refreshFunctionsRef.current.delete(key)
    if (debugMode) {
      console.log('Unregistered refresh function:', key)
    }
  }, [debugMode])

  // Trigger refresh (optionally for specific key)
  const triggerRefresh = useCallback((key?: string) => {
    if (key && refreshFunctionsRef.current.has(key)) {
      // Trigger specific refresh function
      const refreshFn = refreshFunctionsRef.current.get(key)!
      try {
        Promise.resolve(refreshFn()).catch(error => {
          console.error(`Refresh error for ${key}:`, error)
        })
      } catch (error) {
        console.error(`Sync refresh error for ${key}:`, error)
      }
    } else {
      // Trigger global refresh
      triggerGlobalRefresh()
    }
  }, [triggerGlobalRefresh])

  const contextValue: RealtimeContextValue = useMemo(() => ({
    // Connection state
    isConnected: isConnected && isOnline,
    isConnecting: isConnecting,
    connectionError: null,
    
    // Subscription management
    subscribe,
    unsubscribe,
    
    // Auto-refresh coordination
    registerRefreshFunction,
    unregisterRefreshFunction,
    triggerRefresh,
    
    // Network state
    isOnline,
    
    // Statistics
    activeSubscriptions,
    totalRefreshes
  }), [
    isConnected,
    isOnline,
    isConnecting,
    subscribe,
    unsubscribe,
    registerRefreshFunction,
    unregisterRefreshFunction,
    triggerRefresh,
    totalRefreshes
  ])

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error('useRealtimeContext must be used within a RealtimeProvider')
  }
  return context
}

// Convenience hook for components that want to subscribe to a table with auto-refresh
export function useRealtimeSync(
  table: TableName,
  refreshFn: RefreshFunction,
  options: {
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
    filter?: string
    enabled?: boolean
    refreshKey?: string
  } = {}
) {
  const { event = '*', filter, enabled = true, refreshKey } = options
  const realtime = useRealtimeContext()
  const refreshKeyRef = useRef(refreshKey || `${table}_${Math.random().toString(36).substring(2, 11)}`)

  // Use ref to store the latest refresh function to avoid dependency issues
  const refreshFnRef = useRef(refreshFn)
  refreshFnRef.current = refreshFn

  useEffect(() => {
    if (!enabled) return

    const refreshKey = refreshKeyRef.current

    // Register refresh function using the ref
    realtime.registerRefreshFunction(refreshKey, () => refreshFnRef.current())

    // Subscribe to table changes
    const unsubscribe = realtime.subscribe({
      table,
      event,
      filter,
      callback: () => {
        // The RealtimeProvider will coordinate the refresh
      }
    })

    return () => {
      unsubscribe()
      realtime.unregisterRefreshFunction(refreshKey)
    }
  }, [enabled, table, event, filter, realtime])


  return {
    triggerRefresh: () => realtime.triggerRefresh(refreshKeyRef.current),
    isConnected: realtime.isConnected,
    isOnline: realtime.isOnline
  }
}