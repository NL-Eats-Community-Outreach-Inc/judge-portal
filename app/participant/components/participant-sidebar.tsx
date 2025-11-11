'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface ParticipantSidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function ParticipantSidebar({
  isMobile = false,
  isOpen = false,
  onClose,
}: ParticipantSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const sidebarContent = (
    <aside
      className={cn(
        'bg-muted/30 border-r border-border flex flex-col h-full',
        !isMobile && 'w-64 lg:w-80'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Navigation</h2>
        <p className="text-sm text-muted-foreground mt-1">Participant Portal</p>
      </div>

      {/* Navigation links */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <Card
          className={cn(
            'p-4 cursor-pointer transition-all duration-200 border hover:bg-muted/50',
            pathname === '/participant' && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          )}
          onClick={() => handleNavigation('/participant')}
        >
          <div className="flex items-center gap-3">
            <Home className="h-5 w-5 text-primary" />
            <span className="font-medium text-sm">Dashboard</span>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          More features coming soon
        </p>
      </div>
    </aside>
  );

  // For mobile, wrap in Sheet component
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Participant Navigation</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  // For desktop, return sidebar directly
  return sidebarContent;
}
