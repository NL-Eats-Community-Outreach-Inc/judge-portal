'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type DatabaseEvent = 'INSERT' | 'UPDATE' | 'DELETE'
export type TableName = 'events' | 'users' | 'teams' | 'criteria' | 'scores'

export interface RealtimeSubscription {
  table: TableName
  event?: DatabaseEvent | '*'
  schema?: string
  filter?: string
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

export interface RealtimeHookOptions {
  subscriptions: RealtimeSubscription[]
  enabled?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

export interface RealtimeState {
  isConnected: boolean
  isConnecting: boolean
  error: Error | null
  subscriptionsCount: number
}

/**
 * Core Supabase Realtime hook with subscription management
 * 
 * Features:
 * - Multiple table subscriptions
 * - Connection state management
 * - Auto-reconnection on failures
 * - Cleanup on unmount
 * - Error handling and recovery
 * 
 * @param options - Configuration for realtime subscriptions
 * @returns Connection state and control functions
 */
export function useRealtime(options: RealtimeHookOptions) {
  const { subscriptions, enabled = true, onConnect, onDisconnect, onError } = options
  
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    subscriptionsCount: 0
  })
  
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const maxReconnectAttempts = 5
  const reconnectDelayMs = 1000
  
  // Use refs to store latest callback functions to avoid infinite re-renders
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const onErrorRef = useRef(onError)
  
  // Update refs when callbacks change
  onConnectRef.current = onConnect
  onDisconnectRef.current = onDisconnect
  onErrorRef.current = onError

  // Memoize subscriptions to avoid infinite loops when array changes
  const subscriptionsHash = JSON.stringify(subscriptions.map(s => ({ 
    table: s.table, 
    event: s.event, 
    filter: s.filter 
  })))

  // Clean up function
  const cleanup = useCallback(() => {
    isConnectingRef.current = false
    if (channelRef.current) {
      supabaseRef.current.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  // Connect to realtime with subscriptions
  const connect = useCallback(async () => {
    if (!enabled || isConnectingRef.current) return
    
    isConnectingRef.current = true
    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Create a unique channel name
      const channelName = `realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const channel = supabaseRef.current.channel(channelName)

      // Add all subscriptions to the channel
      subscriptions.forEach(({ table, event = '*', schema = 'public', filter, callback }) => {
        const config: Record<string, unknown> = {
          event,
          schema,
          table,
        }
        
        if (filter) {
          config.filter = filter
        }

        channel.on(
          'postgres_changes' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          config,
          callback
        )
      })

      // Handle channel events
      channel
        .on('system', {}, (payload) => {
          console.log('Realtime system event:', payload)
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isConnectingRef.current = false
            setState(prev => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
              subscriptionsCount: subscriptions.length,
              error: null
            }))
            reconnectAttemptsRef.current = 0
            onConnectRef.current?.()
          } else if (status === 'CLOSED') {
            isConnectingRef.current = false
            setState(prev => ({
              ...prev,
              isConnected: false,
              isConnecting: false
            }))
            onDisconnectRef.current?.()
          } else if (status === 'CHANNEL_ERROR') {
            isConnectingRef.current = false
            const error = new Error('Realtime channel error')
            setState(prev => ({
              ...prev,
              isConnected: false,
              isConnecting: false,
              error
            }))
            onErrorRef.current?.(error)
            
            // Attempt reconnection if under limit
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++
              reconnectTimeoutRef.current = setTimeout(() => {
                console.log(`Attempting realtime reconnection (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
                connect()
              }, reconnectDelayMs * reconnectAttemptsRef.current)
            }
          }
        })

      channelRef.current = channel
    } catch (error) {
      isConnectingRef.current = false
      const err = error instanceof Error ? error : new Error('Unknown realtime error')
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: err
      }))
      onErrorRef.current?.(err)
    }
  }, [enabled, subscriptionsHash])

  // Disconnect from realtime
  const disconnect = useCallback(() => {
    isConnectingRef.current = false
    cleanup()
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      subscriptionsCount: 0
    }))
  }, [cleanup])

  // Reconnect manually
  const reconnect = useCallback(() => {
    disconnect()
    setTimeout(() => connect(), 100)
  }, [disconnect, connect])

  // Set up initial connection
  useEffect(() => {
    if (enabled && subscriptions.length > 0) {
      connect()
    }

    return cleanup
  }, [enabled, subscriptionsHash, connect, cleanup, subscriptions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    cleanup
  }
}

// Convenience hook for single table subscriptions
export function useRealtimeTable(
  table: TableName,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  options: {
    event?: DatabaseEvent | '*'
    filter?: string
    enabled?: boolean
  } = {}
) {
  const { event = '*', filter, enabled = true } = options
  
  return useRealtime({
    subscriptions: [{ table, event, filter, callback }],
    enabled
  })
}

// Hook for event-specific subscriptions (filters by eventId)
export function useRealtimeEvent(
  eventId: string | null,
  subscriptions: Omit<RealtimeSubscription, 'filter'>[],
  options: {
    enabled?: boolean
    onConnect?: () => void
    onDisconnect?: () => void
    onError?: (error: Error) => void
  } = {}
) {
  const eventSubscriptions = subscriptions.map(sub => ({
    ...sub,
    filter: eventId ? `event_id=eq.${eventId}` : undefined
  }))

  return useRealtime({
    ...options,
    subscriptions: eventSubscriptions,
    enabled: options.enabled && !!eventId
  })
}