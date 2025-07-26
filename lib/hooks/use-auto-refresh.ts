'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useDebounce } from './use-debounce'

export interface RefreshFunction {
  (): Promise<void> | void
}

export interface AutoRefreshOptions {
  refreshFn: RefreshFunction
  enabled?: boolean
  debounceMs?: number
  throttleMs?: number
  maxRetries?: number
  retryDelayMs?: number
  onRefreshStart?: () => void
  onRefreshSuccess?: () => void
  onRefreshError?: (error: Error) => void
}

export interface AutoRefreshState {
  isRefreshing: boolean
  lastRefreshTime: Date | null
  refreshCount: number
  errorCount: number
  lastError: Error | null
}

/**
 * Smart auto-refresh hook with debouncing, throttling, and coordination
 * 
 * Features:
 * - Debounced triggers to prevent excessive refreshes
 * - Throttling to limit refresh frequency
 * - Retry logic with exponential backoff
 * - Loading state management
 * - Error handling and reporting
 * - Manual refresh capability
 * 
 * @param options - Configuration for auto-refresh behavior
 * @returns Refresh state and control functions
 */
export function useAutoRefresh(options: AutoRefreshOptions) {
  const {
    refreshFn,
    enabled = true,
    debounceMs = 500,
    throttleMs = 1000,
    maxRetries = 3,
    retryDelayMs = 1000,
    onRefreshStart,
    onRefreshSuccess,
    onRefreshError
  } = options

  const [state, setState] = useState<AutoRefreshState>({
    isRefreshing: false,
    lastRefreshTime: null,
    refreshCount: 0,
    errorCount: 0,
    lastError: null
  })

  const refreshCountRef = useRef(0)
  const lastRefreshTimeRef = useRef<Date | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef(false)
  
  // Use refs to store latest callback functions to avoid infinite re-renders
  const refreshFnRef = useRef(refreshFn)
  const onRefreshStartRef = useRef(onRefreshStart)
  const onRefreshSuccessRef = useRef(onRefreshSuccess)
  const onRefreshErrorRef = useRef(onRefreshError)
  
  // Update refs when callbacks change
  refreshFnRef.current = refreshFn
  onRefreshStartRef.current = onRefreshStart
  onRefreshSuccessRef.current = onRefreshSuccess
  onRefreshErrorRef.current = onRefreshError

  // Debounced trigger counter to batch multiple rapid refresh requests
  const [triggerCount, setTriggerCount] = useState(0)
  const debouncedTriggerCount = useDebounce(triggerCount, debounceMs)

  // Core refresh function with error handling and retries
  const executeRefresh = useCallback(async (retryCount = 0): Promise<void> => {
    if (!enabled || isRefreshingRef.current) return

    // Check throttle - prevent refreshes if too recent
    if (lastRefreshTimeRef.current && throttleMs > 0) {
      const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current.getTime()
      if (timeSinceLastRefresh < throttleMs) {
        return
      }
    }

    isRefreshingRef.current = true
    setState(prev => ({
      ...prev,
      isRefreshing: true,
      lastError: null
    }))

    onRefreshStartRef.current?.()

    try {
      await refreshFnRef.current()
      
      // Success - update state
      const now = new Date()
      lastRefreshTimeRef.current = now
      refreshCountRef.current++
      
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        lastRefreshTime: now,
        refreshCount: refreshCountRef.current,
        lastError: null
      }))

      onRefreshSuccessRef.current?.()
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Refresh failed')
      
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        errorCount: prev.errorCount + 1,
        lastError: err
      }))

      onRefreshErrorRef.current?.(err)

      // Retry logic with exponential backoff
      if (retryCount < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, retryCount)
        
        retryTimeoutRef.current = setTimeout(() => {
          executeRefresh(retryCount + 1)
        }, delay)
      }
    } finally {
      isRefreshingRef.current = false
    }
  }, [enabled, throttleMs, maxRetries, retryDelayMs])

  // Manual refresh function (bypasses debouncing and throttling)
  const refresh = useCallback(async () => {
    // Clear any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    
    // Force refresh regardless of throttle
    lastRefreshTimeRef.current = null
    await executeRefresh(0)
  }, [executeRefresh])

  // Trigger refresh (with debouncing)
  const trigger = useCallback(() => {
    if (!enabled) return
    setTriggerCount(prev => prev + 1)
  }, [enabled])

  // Immediate trigger (bypasses debouncing but respects throttling)
  const triggerImmediate = useCallback(() => {
    if (!enabled) return
    executeRefresh(0)
  }, [enabled, executeRefresh])

  // Reset error state
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastError: null,
      errorCount: 0
    }))
  }, [])

  // Reset all state
  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current)
      throttleTimeoutRef.current = null
    }
    
    setState({
      isRefreshing: false,
      lastRefreshTime: null,
      refreshCount: 0,
      errorCount: 0,
      lastError: null
    })
    
    refreshCountRef.current = 0
    lastRefreshTimeRef.current = null
    isRefreshingRef.current = false
  }, [])

  // Execute refresh when debounced trigger count changes
  useEffect(() => {
    if (debouncedTriggerCount > 0) {
      executeRefresh(0)
    }
  }, [debouncedTriggerCount, executeRefresh])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
    }
  }, [])

  return {
    ...state,
    trigger,
    triggerImmediate,
    refresh,
    clearError,
    reset,
    canRefresh: enabled && !state.isRefreshing
  }
}

// Convenience hook for simple auto-refresh scenarios
export function useSimpleAutoRefresh(
  refreshFn: RefreshFunction,
  enabled = true,
  debounceMs = 500
) {
  return useAutoRefresh({
    refreshFn,
    enabled,
    debounceMs,
    throttleMs: 1000,
    maxRetries: 2
  })
}

// Hook that combines realtime events with auto-refresh
export function useRealtimeRefresh(
  refreshFn: RefreshFunction,
  options: Omit<AutoRefreshOptions, 'refreshFn'> = {}
) {
  const autoRefresh = useAutoRefresh({
    ...options,
    refreshFn
  })

  // Create a callback for realtime events that triggers refresh
  const handleRealtimeChange = useCallback(() => {
    autoRefresh.trigger()
  }, [autoRefresh])

  return {
    ...autoRefresh,
    handleRealtimeChange
  }
}