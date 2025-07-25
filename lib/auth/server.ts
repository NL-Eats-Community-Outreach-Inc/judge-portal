// Re-export server-side auth utilities for consistent imports
export { authServer, userManager, routeGuards, type UserRole, type UserWithRole } from './index'

// Additional utility function for session-based auth
export const getUserFromSession = async () => {
  const { authServer } = await import('./index')
  return await authServer.getUser()
}