/**
 * API-facing shapes shared by routes and components, derived from the Drizzle
 * schema so a column change shows up everywhere at once. Components import
 * these instead of declaring their own `interface Event` / `Team` / …
 */
import type {
  events,
  teams,
  criteria,
  scores,
  users,
  invitations,
  teamMembers,
} from '@/lib/db/schema';

export type EventStatus = 'setup' | 'open' | 'active' | 'completed';
export type AwardType = 'technical' | 'business' | 'both';
export type CriteriaCategory = 'technical' | 'business';
export type ScoreMode = 'total' | 'average' | 'weighted';

/** `events` row as the API returns it. */
export type Event = typeof events.$inferSelect;

/** Event as the judge dashboard receives it (`organizationName` joined in). */
export type JudgeEvent = Pick<Event, 'id' | 'name' | 'description' | 'status'> & {
  organizationName?: string | null;
};

export type Team = typeof teams.$inferSelect;

/** Team as the judge sidebar and scoring page receive it. */
export type JudgeTeam = Pick<Team, 'id' | 'name' | 'description' | 'presentationOrder'>;

/** `team_members` row joined with the member's email, as `/api/admin/teams` returns it. */
export type TeamMemberSummary = Pick<
  typeof teamMembers.$inferSelect,
  'teamId' | 'participantId' | 'isCreator' | 'joinedAt'
> & { email: string };

/** Team with its members (join code included), as `/api/admin/teams` returns it. */
export type TeamWithMembers = Team & { members: TeamMemberSummary[] };

/** Member as `/api/participant/teams/[teamId]/members` returns it. */
export type ParticipantTeamMember = Pick<
  typeof teamMembers.$inferSelect,
  'id' | 'participantId' | 'isCreator' | 'joinedAt'
> & { email: string };

export type Criterion = typeof criteria.$inferSelect;

/** The subset of a criterion the results dashboard and exports need. */
export type CriterionSummary = Pick<
  Criterion,
  'id' | 'name' | 'category' | 'displayOrder' | 'weight' | 'maxScore'
>;

export type Score = typeof scores.$inferSelect;

/** One judge's score for one criterion on the scoring page (`id` absent until saved). */
export type ScoreEntry = {
  id?: string;
  criterionId: string;
  score: number | null;
  comment: string;
};

/** A score row joined with its team, criterion and judge, as `/api/admin/results` returns it. */
export type ResultScore = Pick<Score, 'id' | 'score' | 'comment' | 'createdAt' | 'updatedAt'> & {
  team: Pick<Team, 'id' | 'name' | 'presentationOrder' | 'awardType'>;
  criterion: Pick<Criterion, 'id' | 'name' | 'displayOrder' | 'minScore' | 'maxScore' | 'category'>;
  judge: { id: string; email: string };
};

/** Per-team aggregate from `/api/admin/results`. */
export type TeamTotal = {
  teamId: string;
  teamName: string;
  presentationOrder: number;
  awardType: AwardType;
  totalScore: number;
  averageScore: number;
  weightedScore: number;
  totalScores: number;
  judgeCount: number;
};

/** A `TeamTotal` in ranking order: `rank` is its position, `tied` when a neighbour has the same score in the ranked mode. */
export type RankedTeamTotal = TeamTotal & { rank: number; tied: boolean };

/** Per-team, per-criterion average from `/api/admin/results`. */
export type CriteriaAverage = {
  teamId: string;
  teamName: string;
  criterionId: string;
  criterionName: string;
  averageScore: number;
  judgeCount: number;
};

/** Per-team completion state for one judge, from `/api/judge/completion`. */
export type ScoreCompletion = { teamId: string; completed: boolean; partial: boolean };

export type User = typeof users.$inferSelect;

/** User as the admin Users tab lists it. */
export type OrgUser = Pick<User, 'id' | 'email' | 'createdAt' | 'updatedAt'> & {
  role: 'admin' | 'judge' | 'participant';
};

/** Invitation as the admin list shows it (link added by the API). */
export type InvitationListItem = Pick<
  typeof invitations.$inferSelect,
  'id' | 'email' | 'role' | 'status' | 'expiresAt' | 'createdAt'
> & { acceptedAt?: string | null; inviteLink: string };
