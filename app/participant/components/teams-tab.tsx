'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Plus,
  Users,
  ExternalLink,
  Code2,
  Search,
  UserMinus,
  Edit,
  // Trash2, // Removed - using Leave for all scenarios
  RefreshCw,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { useParticipantEvent } from '../contexts/participant-event-context';
import { toast } from 'sonner';
import type { Team, TeamMember } from '@/lib/db/schema';

interface TeamWithMembers extends Team {
  members: TeamMember[];
  memberCount: number;
  userIsMember: boolean;
}

type TeamFormData = {
  name: string;
  description: string;
  demoUrl: string;
  repoUrl: string;
  awardType: 'technical' | 'business' | 'both';
};

// Helper function to display award type with proper casing
const getDisplayAwardType = (awardType: string) => {
  switch (awardType) {
    case 'both':
      return 'General';
    case 'technical':
      return 'Technical';
    case 'business':
      return 'Business';
    default:
      return awardType;
  }
};

export function TeamsTab() {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [userTeam, setUserTeam] = useState<TeamWithMembers | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { selectedEvent } = useParticipantEvent();

  // Form states
  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
    demoUrl: '',
    repoUrl: '',
    awardType: 'both' as 'technical' | 'business' | 'both',
  });

  const fetchTeams = useCallback(async () => {
    if (!selectedEvent) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/participant/events/${selectedEvent.id}/teams`);
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams);
        setUserTeam(data.userTeam);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedEvent) {
      fetchTeams();
    } else {
      setTeams([]);
      setUserTeam(null);
    }
  }, [selectedEvent, fetchTeams]);

  const handleCreateTeam = async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch('/api/participant/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...teamForm,
          eventId: selectedEvent.id,
        }),
      });

      if (response.ok) {
        toast.success('Team created successfully!');
        setIsCreateDialogOpen(false);
        setTeamForm({
          name: '',
          description: '',
          demoUrl: '',
          repoUrl: '',
          awardType: 'both',
        });
        fetchTeams();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create team');
      }
    } catch {
      toast.error('Failed to create team');
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    try {
      const response = await fetch(`/api/participant/teams/${teamId}/join`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Successfully joined the team!');
        fetchTeams();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to join team');
      }
    } catch {
      toast.error('Failed to join team');
    }
  };

  const handleLeaveTeam = async () => {
    if (!userTeam) return;

    try {
      const response = await fetch(`/api/participant/teams/${userTeam.id}/leave`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Left the team successfully');
        fetchTeams();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to leave team');
      }
    } catch {
      toast.error('Failed to leave team');
    }
  };

  const handleUpdateTeam = async () => {
    if (!userTeam) return;

    try {
      const response = await fetch(`/api/participant/teams/${userTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamForm),
      });

      if (response.ok) {
        toast.success('Team updated successfully!');
        setIsEditDialogOpen(false);
        fetchTeams();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update team');
      }
    } catch {
      toast.error('Failed to update team');
    }
  };

  // Delete functionality removed - Leave team automatically handles deletion when last member
  // const handleDeleteTeam = async () => {
  //   if (!userTeam) return;

  //   try {
  //     const response = await fetch(`/api/participant/teams/${userTeam.id}`, {
  //       method: 'DELETE',
  //     });

  //     if (response.ok) {
  //       toast.success('Team deleted successfully');
  //       fetchTeams();
  //     } else {
  //       const error = await response.json();
  //       toast.error(error.message || 'Failed to delete team');
  //     }
  //   } catch {
  //     toast.error('Failed to delete team');
  //   }
  // };

  const openEditDialog = () => {
    if (userTeam) {
      setTeamForm({
        name: userTeam.name,
        description: userTeam.description || '',
        demoUrl: userTeam.demoUrl || '',
        repoUrl: userTeam.repoUrl || '',
        awardType: userTeam.awardType,
      });
      setIsEditDialogOpen(true);
    }
  };

  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isRegistrationOpen =
    Boolean(selectedEvent?.registrationOpen) &&
    (!selectedEvent?.registrationCloseAt ||
      new Date(selectedEvent.registrationCloseAt) > new Date());

  if (!selectedEvent) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p>No event selected</p>
            <p className="text-sm">Select an event to view and manage teams</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Teams</h2>
          <p className="text-muted-foreground">
            Teams for {selectedEvent.name} • Max {selectedEvent.maxTeamSize} members per team
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await fetchTeams();
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          {!userTeam && isRegistrationOpen && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team
                </Button>
              </DialogTrigger>
              <CreateTeamDialog
                teamForm={teamForm}
                setTeamForm={setTeamForm}
                onSubmit={handleCreateTeam}
              />
            </Dialog>
          )}
        </div>
      </div>

      {!isRegistrationOpen && (
        <Card className="border-muted bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Registration Closed</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Team registration is currently closed for this event.
            </p>
          </CardContent>
        </Card>
      )}

      {userTeam && (
        <Card className="bg-gradient-to-r from-green-50/50 to-emerald-50/30 dark:from-green-800/20 dark:to-emerald-900/10 border-green-200 dark:border-green-800 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-green-900 dark:text-green-100 flex items-center gap-2">
                    Your Team
                    {/* <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-100">Member</Badge> */}
                  </CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    {userTeam.name}
                  </CardDescription>
                  {userTeam.description && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      {userTeam.description}
                    </p>
                  )}
                </div>
              </div>
              {isRegistrationOpen && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={openEditDialog}
                    className="bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 shadow-sm"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLeaveTeam}
                    className="bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 shadow-sm"
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Leave
                  </Button>
                  {/* Delete button removed - Leave team automatically deletes when last member */}
                  {/* {userTeam.memberCount === 1 && (
                    <Button variant="destructive" size="sm" onClick={handleDeleteTeam}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )} */}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Award Type
                </span>
                <Badge
                  variant="outline"
                  className="ml-2 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
                >
                  {getDisplayAwardType(userTeam.awardType)}
                </Badge>
              </div>
              <div>
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Members
                </span>
                <div className="font-medium text-green-700 dark:text-green-300">
                  {userTeam.memberCount} / {selectedEvent.maxTeamSize}
                </div>
              </div>
              <div className="flex gap-2">
                {userTeam.demoUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    className="bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 shadow-sm"
                  >
                    <a href={userTeam.demoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Demo
                    </a>
                  </Button>
                )}
                {userTeam.repoUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    className="bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 shadow-sm"
                  >
                    <a href={userTeam.repoUrl} target="_blank" rel="noopener noreferrer">
                      <Code2 className="h-4 w-4 mr-1" />
                      Repo
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground">{filteredTeams.length} teams found</div>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTeams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Teams Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'No teams match your search.' : 'No teams have been created yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                userTeam={userTeam}
                maxTeamSize={selectedEvent.maxTeamSize}
                isRegistrationOpen={isRegistrationOpen}
                onJoin={() => handleJoinTeam(team.id)}
              />
            ))}
          </div>
        )}
      </div>

      {userTeam && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <EditTeamDialog
            teamForm={teamForm}
            setTeamForm={setTeamForm}
            onSubmit={handleUpdateTeam}
          />
        </Dialog>
      )}
    </div>
  );
}

function TeamCard({
  team,
  userTeam,
  maxTeamSize,
  isRegistrationOpen,
  onJoin,
}: {
  team: TeamWithMembers;
  userTeam: TeamWithMembers | null;
  maxTeamSize: number;
  isRegistrationOpen: boolean;
  onJoin: () => void;
}) {
  const canJoin =
    !userTeam && isRegistrationOpen && team.memberCount < maxTeamSize && !team.userIsMember;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              {team.name}
              <Badge variant="outline">{getDisplayAwardType(team.awardType)}</Badge>
              {team.userIsMember && <Badge>Your Team</Badge>}
            </CardTitle>
            {team.description && <CardDescription>{team.description}</CardDescription>}
          </div>
          <div className="text-right space-y-1">
            <div className="text-sm text-muted-foreground">
              {team.memberCount} / {maxTeamSize} members
            </div>
            {team.memberCount >= maxTeamSize && <Badge variant="secondary">Full</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {team.demoUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={team.demoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Demo
                </a>
              </Button>
            )}
            {team.repoUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={team.repoUrl} target="_blank" rel="noopener noreferrer">
                  <Code2 className="h-4 w-4 mr-1" />
                  Repo
                </a>
              </Button>
            )}
          </div>

          {canJoin && <Button onClick={onJoin}>Join Team</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTeamDialog({
  teamForm,
  setTeamForm,
  onSubmit,
}: {
  teamForm: TeamFormData;
  setTeamForm: (form: TeamFormData) => void;
  onSubmit: () => void;
}) {
  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Create New Team</DialogTitle>
        <DialogDescription>
          Create a new team for this event. You&apos;ll be automatically added as a member.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Team Name</Label>
          <Input
            id="name"
            value={teamForm.name}
            onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
            placeholder="Enter team name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={teamForm.description}
            onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
            placeholder="Describe your team"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awardType">Award Type</Label>
          <Select
            value={teamForm.awardType}
            onValueChange={(value) =>
              setTeamForm({ ...teamForm, awardType: value as 'technical' | 'business' | 'both' })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="both">General</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="demoUrl">Demo URL (Optional)</Label>
          <Input
            id="demoUrl"
            value={teamForm.demoUrl}
            onChange={(e) => setTeamForm({ ...teamForm, demoUrl: e.target.value })}
            placeholder="https://your-demo.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="repoUrl">Repository URL (Optional)</Label>
          <Input
            id="repoUrl"
            value={teamForm.repoUrl}
            onChange={(e) => setTeamForm({ ...teamForm, repoUrl: e.target.value })}
            placeholder="https://github.com/username/repo"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSubmit} disabled={!teamForm.name.trim()}>
          Create Team
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditTeamDialog({
  teamForm,
  setTeamForm,
  onSubmit,
}: {
  teamForm: TeamFormData;
  setTeamForm: (form: TeamFormData) => void;
  onSubmit: () => void;
}) {
  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Edit Team</DialogTitle>
        <DialogDescription>Update your team&apos;s information.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="edit-name">Team Name</Label>
          <Input
            id="edit-name"
            value={teamForm.name}
            onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
            placeholder="Enter team name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-description">Description (Optional)</Label>
          <Textarea
            id="edit-description"
            value={teamForm.description}
            onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
            placeholder="Describe your team"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-awardType">Award Type</Label>
          <Select
            value={teamForm.awardType}
            onValueChange={(value) =>
              setTeamForm({ ...teamForm, awardType: value as 'technical' | 'business' | 'both' })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="technical">Technical Award</SelectItem>
              <SelectItem value="business">Business Award</SelectItem>
              <SelectItem value="both">General Award</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-demoUrl">Demo URL (Optional)</Label>
          <Input
            id="edit-demoUrl"
            value={teamForm.demoUrl}
            onChange={(e) => setTeamForm({ ...teamForm, demoUrl: e.target.value })}
            placeholder="https://your-demo.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-repoUrl">Repository URL (Optional)</Label>
          <Input
            id="edit-repoUrl"
            value={teamForm.repoUrl}
            onChange={(e) => setTeamForm({ ...teamForm, repoUrl: e.target.value })}
            placeholder="https://github.com/username/repo"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSubmit} disabled={!teamForm.name.trim()}>
          Update Team
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
