'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Gavel } from 'lucide-react';

export type UserRole = 'judge' | 'participant';

interface RoleSelectorProps {
  selectedRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  className?: string;
}

export function RoleSelector({ selectedRole, onRoleChange, className }: RoleSelectorProps) {
  const roles = [
    {
      value: 'judge' as const,
      label: 'Judge',
      description: 'Evaluate team presentations',
      icon: Gavel,
    },
    {
      value: 'participant' as const,
      label: 'Participant',
      description: 'Join or create a team for the event',
      icon: Users,
    },
  ];

  return (
    <div className={cn('grid gap-3', className)}>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        I want to join as a
      </label>
      <div className="grid gap-3">
        {roles.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.value;

          return (
            <Card
              key={role.value}
              className={cn(
                'cursor-pointer transition-all border-2 hover:bg-accent/50',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/30'
              )}
              onClick={() => onRoleChange(role.value)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={cn(
                    'rounded-lg p-2 transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium leading-none">{role.label}</h3>
                    {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
