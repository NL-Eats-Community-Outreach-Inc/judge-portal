'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface Competition {
  id: string;
  name: string;
  description: string | null;
  status: 'setup' | 'open' | 'active' | 'completed';
  organizationId: string | null;
  maxTeamSize: number | null;
  prize: string | null;
  tags: string[] | null;
  submissionDeadline: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminCompetitionContextType {
  competitions: Competition[];
  selectedCompetition: Competition | null;
  organizationName: string | null;
  isLoading: boolean;
  selectCompetition: (competition: Competition | null) => void;
  refreshCompetitions: () => Promise<void>;
}

const AdminCompetitionContext = createContext<AdminCompetitionContextType | undefined>(undefined);

export function AdminCompetitionProvider({ children }: { children: ReactNode }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCompetitions = async () => {
    try {
      const response = await fetch('/api/admin/competition');
      const data = await response.json();

      if (response.ok) {
        setCompetitions(data.competitions || []);
        setOrganizationName(data.organizationName ?? null);

        if (data.competitions?.length > 0) {
          const currentCompetitionStillExists = selectedCompetition
            ? data.competitions.find((c: Competition) => c.id === selectedCompetition.id)
            : null;

          if (currentCompetitionStillExists) {
            setSelectedCompetition(currentCompetitionStillExists);
          } else {
            const activeCompetition = data.competitions.find(
              (c: Competition) => c.status === 'active'
            );
            setSelectedCompetition(activeCompetition || data.competitions[0]);
          }
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load competitions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCompetitions = async () => {
    await fetchCompetitions();
  };

  const selectCompetition = (competition: Competition | null) => {
    setSelectedCompetition(competition);
  };

  useEffect(() => {
    fetchCompetitions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value: AdminCompetitionContextType = {
    competitions,
    selectedCompetition,
    organizationName,
    isLoading,
    selectCompetition,
    refreshCompetitions,
  };

  return (
    <AdminCompetitionContext.Provider value={value}>{children}</AdminCompetitionContext.Provider>
  );
}

export function useAdminCompetition() {
  const context = useContext(AdminCompetitionContext);
  if (context === undefined) {
    throw new Error('useAdminCompetition must be used within an AdminCompetitionProvider');
  }
  return context;
}
