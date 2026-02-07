'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';

export interface OrgWithStats {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  adminCount: number;
  eventCount: number;
}

interface SuperAdminContextValue {
  organizations: OrgWithStats[];
  isLoading: boolean;
  selectedOrg: OrgWithStats | null;
  selectOrg: (orgId: string | null) => void;
  refreshOrgs: () => Promise<void>;
}

const SuperAdminContext = createContext<SuperAdminContextValue | null>(null);

export function SuperAdminProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<OrgWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const fetchOrgs = useCallback(async () => {
    try {
      const response = await fetch('/api/super-admin/organizations');
      const data = await response.json();

      if (response.ok) {
        setOrganizations(data.organizations);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const selectedOrg = selectedOrgId
    ? organizations.find((o) => o.id === selectedOrgId) || null
    : null;

  const selectOrg = useCallback((orgId: string | null) => {
    setSelectedOrgId(orgId);
  }, []);

  const refreshOrgs = useCallback(async () => {
    await fetchOrgs();
  }, [fetchOrgs]);

  return (
    <SuperAdminContext.Provider
      value={{ organizations, isLoading, selectedOrg, selectOrg, refreshOrgs }}
    >
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  const context = useContext(SuperAdminContext);
  if (!context) {
    throw new Error('useSuperAdmin must be used within a SuperAdminProvider');
  }
  return context;
}
