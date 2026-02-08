'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Membership {
  orgId: string;
  orgName: string;
  orgDescription: string | null;
  joinedAt: string;
}

interface PublicOrg {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export function OrgManagementSettings() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [allOrgs, setAllOrgs] = useState<PublicOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningOrgs, setJoiningOrgs] = useState(new Set<string>());

  const fetchData = useCallback(async () => {
    try {
      const [membershipsRes, orgsRes] = await Promise.all([
        fetch('/api/judge/organizations'),
        fetch('/api/organizations/public'),
      ]);

      if (membershipsRes.ok) {
        const membershipsData = await membershipsRes.json();
        setMemberships(membershipsData.memberships);
      }

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setAllOrgs(orgsData.organizations);
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
      toast.error('Failed to load organization data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoinOrg = async (orgId: string) => {
    setJoiningOrgs((prev) => new Set(prev).add(orgId));

    try {
      const response = await fetch('/api/judge/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationIds: [orgId] }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join organization');
      }

      toast.success('Joined organization successfully');
      await fetchData();
    } catch (error) {
      console.error('Error joining organization:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to join organization');
    } finally {
      setJoiningOrgs((prev) => {
        const next = new Set(prev);
        next.delete(orgId);
        return next;
      });
    }
  };

  const memberOrgIds = new Set(memberships.map((m) => m.orgId));
  const availableOrgs = allOrgs.filter((org) => !memberOrgIds.has(org.id));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizations</CardTitle>
        <CardDescription>View your organizations and join new ones</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* My Organizations */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">My Organizations</h4>
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You are not a member of any organization yet.
            </p>
          ) : (
            <div className="space-y-2">
              {memberships.map((membership) => (
                <div
                  key={membership.orgId}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {membership.orgName}
                    </p>
                    {membership.orgDescription && (
                      <p className="text-xs text-muted-foreground truncate">
                        {membership.orgDescription}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Joined
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Join More Organizations */}
        {availableOrgs.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Join More Organizations</h4>
            <div className="space-y-2">
              {availableOrgs.map((org) => (
                <div key={org.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
                    {org.description && (
                      <p className="text-xs text-muted-foreground truncate">{org.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJoinOrg(org.id)}
                    disabled={joiningOrgs.has(org.id)}
                    className="shrink-0"
                  >
                    {joiningOrgs.has(org.id) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Join
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
