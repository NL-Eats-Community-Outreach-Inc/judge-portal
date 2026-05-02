# JudgePortal

A comprehensive multi-tenant real-time judging platform for hackathons and competitive events. Built with modern web technologies, JudgePortal enables organizations to manage events with a 4-stage lifecycle, judges to score teams across multiple events, participants to form teams via join codes, and super admins to oversee the entire platform.

## 🎯 Features

### For Super Admins
- **Organization Management** - Create, edit, and delete organizations with slugs, descriptions, and branding
- **Platform-Wide User Management** - View all users across the platform, change roles, and delete accounts
- **Admin Invitation** - Invite admins directly to specific organizations
- **Orphaned Admin Recovery** - Reassign admins who lost their organization to a new one
- **Role Change Safety** - Confirmation dialogs with role-specific warnings for all transitions
- **Score Preservation** - Intelligent cleanup preserves scoring data when changing user roles

### For Admins
- **Organization-Scoped Operations** - All data (events, teams, users) isolated to admin's organization
- **Invite Link System** - Send batch invitations via email with OTP verification for judges, participants, and admins
- **Smart Judge Invitation** - Existing judges are auto-added to the organization without re-sending emails
- **4-Stage Event Lifecycle** - Manage events through setup → open → active → completed stages
- **Multi-Event Management** - Create and manage multiple simultaneous events per organization
- **Judge Assignment System** - Assign specific judges to events with score preservation warnings
- **Configurable Team Size** - Set maximum team size per event
- **Team Award Types** - Configure teams as Technical, Business, or Both competition categories
- **Weighted Criteria System** - Create scoring criteria with customizable weights (0-100%) and categories
- **Real-time Results Dashboard** - Live score updates with three scoring modes (Total/Average/Weighted)
- **Award Type Filtering** - Filter results dashboard by team award types
- **Advanced CSV Export** - Export complete results with all scoring modes and individual judge data
- **Drag-and-Drop Team Ordering** - Easily reorder team presentation sequence
- **Data Integrity Safeguards** - Prevent destructive operations during active judging sessions
- **Markdown Support** - Rich formatting for criteria descriptions with markdown syntax

### For Judges
- **Multi-Event Dashboard** - View all assigned active events across organizations
- **URL-Based Event Routing** - Persistent event selection via URL (survives page refresh)
- **Judge Assignment System** - Must be assigned to active events by admins to participate
- **Multi-Organization Membership** - Belong to multiple organizations simultaneously
- **Organization Management** - Join new organizations via settings page
- **Responsive Mobile Design** - Full mobile and tablet support with touch-friendly interfaces
- **Sidebar Navigation** - Easy team selection with completion status indicators per event
- **Real-time Auto-save** - Scores save immediately, comments save with intelligent debouncing (500ms)
- **Smart Criteria Filtering** - Only see relevant criteria based on team award types (Technical/Business/Both)
- **Score Validation** - Ensures complete and valid submissions with visual feedback
- **Progress Tracking** - Visual indicators show scoring completion status per team

### For Participants
- **Event Browsing** - View all open and active events across all organizations
- **Event Registration** - Register for events during open or active stages
- **Team Creation** - Create teams with auto-generated 6-character join codes
- **Team Joining** - Join existing teams using join codes (like Kahoot)
- **Team Management** - Edit team info, view members, and leave teams during open events
- **Creator Controls** - Team creators can delete teams, remove members, and regenerate join codes
- **Stage-Aware UI** - Teams locked during active judging (no join/leave/edit/create); read-only view only
- **Cross-Organization Access** - Browse and register for events from any organization

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) with App Router
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL) with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: Supabase Auth with role-based access control (Password, Passwordless OTP, Invite Links)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) with [Lucide Icons](https://lucide.dev/)
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/) with PostCSS processing
- **Additional Libraries**:
  - [@dnd-kit](https://dndkit.com/) for drag and drop functionality
  - [Sonner](https://sonner.emilkowal.ski/) for toast notifications
  - [react-markdown](https://github.com/remarkjs/react-markdown) for markdown rendering
  - [next-themes](https://github.com/pacocoursey/next-themes) for theme switching
- **Real-time Updates**: Supabase Realtime subscriptions
- **Type Safety**: TypeScript with strict mode
- **Testing**: [Playwright](https://playwright.dev/) for E2E testing
- **Development**: React 19, Turbopack development server

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** ([Download here](https://nodejs.org/))
- **Supabase account** ([Sign up free](https://supabase.com))

### Setup Instructions

1. **Clone and Install**
   ```bash
   git clone https://github.com/yourusername/judgeportal.git
   cd judgeportal
   npm install
   ```

2. **Set Up Supabase Project**
   - Go to [app.supabase.com](https://app.supabase.com)
   - Click "New Project" and wait ~2 minutes for setup
   - **Configure Authentication Settings**:
     - Go to Authentication → Configuration → Sign In / Providers
     - Turn OFF "Confirm email" (required for development)
   - **Configure Redirect URLs (Important for Password Reset)**:
     - Go to Authentication → Configuration → URL Configuration
     - In the "Redirect URLs" section, add the following URLs:
       - `http://localhost:3000/auth/update-password` (for local development)
       - `https://your-production-domain.com/auth/update-password` (for production)
     - Click "Save Changes"
   - Go to Settings → API and copy your credentials

3. **Configure Environment Variables**

   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=eyJh...your-service-key
   DATABASE_URL=your-database-url
   SUPABASE_ACCESS_TOKEN=sbp_...your-access-token  # Optional: for email template setup
   ```

   > **Note**: Get `SUPABASE_ACCESS_TOKEN` from https://supabase.com/dashboard/account/tokens (required for `npm run setup:email-template`)

4. **Set up the Database**

   ```bash
   npm run db:setup
   npm run db:update invite-link                # Apply invite link feature migration
   npm run db:update multi-tenant-participants   # Apply multi-tenant feature migration
   ```

   This will:
   - ✅ Create all database tables and relationships
   - ✅ Set up Row Level Security policies
   - ✅ Add database functions and triggers
   - ✅ Create proper indexes for performance
   - ✅ Set up organizations and multi-tenant data model

5. **Configure Email Templates (Optional)**
   ```bash
   npm run setup:email-template  # Requires SUPABASE_ACCESS_TOKEN
   ```

6. **Configure LearnWorlds Mentor Auto-Tagging (MD-03)**
   - Tag mentor form submissions with `role_mentor`
   - Map Expertise answers to tags: `AgriTech` -> `mentor_agritech`, `Sustainability` -> `mentor_sustainability`, `AI` -> `mentor_ai`
   - Mentor webhook payloads should include these values in `payload.tags`
   - Canonical tag constants live in `lib/learnworlds/mentor-tags.ts`

7. **Start Development Server**
   ```bash
   npm run dev
   ```

8. **Open the Application**

   Open [http://localhost:3000](http://localhost:3000) in your browser

### Create Your First Admin

1. **Sign up** at `/auth/sign-up`
2. **Promote to super admin** (for platform management):
   - Go to Supabase Dashboard
   - Table Editor → `users` table
   - Find your user, edit, change `role` to `super_admin`
3. **Log back in** — you'll see the Super Admin Dashboard
4. **Create an organization** and invite an admin to it
5. Alternatively, **promote to admin** directly:
   - Change `role` to `admin` and set `organization_id` to a valid organization UUID

### Test Accounts

- **Admin**: `admin@example.com` / `admin123`
- **Judge 1**: `judge1@example.com` / `judge123`
- **Judge 2**: `judge2@example.com` / `judge123`

### Troubleshooting

**"Missing environment variables"**
- Check `.env.local` exists (not `.env`)
- Ensure all 4 variables are set correctly

**"Tables don't exist"**
- Run `npm run db:setup` again
- If automated setup fails, copy `supabase/migrations/consolidated_setup.sql` to Supabase Dashboard > SQL Editor and run manually

**"Permission denied"**
- Make sure you promoted your user to the correct role in the `users` table
- Admins must have a valid `organization_id` set

## 📱 Usage

### First Time Setup

1. Create an account by signing up
2. Promote the user to `super_admin` in Supabase dashboard (one-time setup)
3. Create an organization in the Super Admin Dashboard
4. Invite an admin to the organization
5. As admin: create an event and progress it through setup → open → active
6. Add teams with award types and scoring criteria with weights
7. Invite judges to register, then assign them to the event
8. Judges can start scoring assigned teams

### Super Admin Workflow

1. **Login** as super admin
2. **Manage Organizations** - Create, edit, and delete organizations
3. **Invite Admins** - Send invitations to admins for specific organizations
4. **Manage Users** - View all platform users, change roles, reassign organizations
5. **Monitor Platform** - View organization stats (admin count, event count)

### Admin Workflow

1. **Login** as admin (scoped to your organization)
2. **Invite Users** - Send batch invitations to judges, participants, or admins via email
3. **Manage Events** - Create events and progress through 4 stages (setup → open → active → completed)
4. **Configure Teams** - Add teams with award types (Technical/Business/Both), presentation order, and max team size
5. **Assign Judges** - Assign organization judges to events for access control
6. **Set Weighted Criteria** - Define scoring criteria with weights, categories, and markdown descriptions
7. **Monitor Results** - View real-time scores with three scoring modes and award type filtering
8. **Export Data** - Download CSV with total, average, and weighted scores

### Judge Workflow

1. **Register/Login** - Sign up with password or passwordless OTP, or accept invite link
2. **Select Organizations** - Join organizations during signup or via settings
3. **View Event Dashboard** - See all assigned active events across organizations
4. **Enter Event** - Click an event card to enter the scoring interface
5. **Select Teams** - Use sidebar to navigate between teams within an event
6. **Submit Scores** - Enter scores for relevant criteria based on team award type (auto-saved)
7. **Add Comments** - Optional feedback with markdown support (saves after 500ms pause)
8. **Switch Events** - Return to dashboard to switch between assigned events
9. **Manage Account** - Access settings to change password or manage organization memberships

### Participant Workflow

1. **Register/Login** - Sign up with password or accept invite link
2. **Browse Events** - View all open and active events across all organizations
3. **Register for Event** - Join an event during open or active stages
4. **Create or Join Team** - Create a new team or join an existing one using a 6-character join code (open events only)
5. **Manage Team** - Edit team info, view members, regenerate join codes (open events only)
6. **View During Judging** - See team info in read-only mode when event is active (teams are locked)

## 🗂️ Project Structure

```
judgeportal/
├── app/                          # Next.js app directory
│   ├── super-admin/              # Super admin dashboard & org management
│   ├── admin/                    # Admin panel (org-scoped)
│   ├── judge/                    # Judge interface
│   │   ├── event/[eventId]/      # Event-specific scoring
│   │   │   └── team/[teamId]/    # Team scoring interface
│   │   └── settings/             # Judge settings & org management
│   ├── participant/              # Participant dashboard
│   │   ├── event/[eventId]/      # Event detail & team management
│   │   └── settings/             # Participant settings
│   ├── invite/                   # Invite link acceptance pages
│   ├── auth/                     # Authentication pages
│   └── api/                      # API endpoints
│       ├── super-admin/          #   Super admin APIs (orgs, users, roles)
│       ├── admin/                #   Admin APIs (events, teams, criteria, users, results)
│       ├── judge/                #   Judge APIs (events, teams, scores, organizations)
│       ├── participant/          #   Participant APIs (events, teams, registration)
│       ├── invite/               #   Invitation APIs (validate, verify)
│       ├── organizations/        #   Public organization listing
│       ├── settings/             #   Settings APIs (password)
│       └── auth/                 #   Auth callbacks
├── components/                   # Reusable UI components
│   ├── ui/                       #   Shadcn UI components
│   ├── auth/                     #   OTP input, passwordless login components
│   ├── settings/                 #   Password management components
│   └── tutorial/                 #   Tutorial components
├── lib/                          # Core utilities
│   ├── auth/                     #   Auth, invitation, org, & participant helpers
│   ├── db/                       #   Database schema and utilities
│   ├── hooks/                    #   Custom React hooks
│   ├── supabase/                 #   Supabase client configuration
│   └── utils/                    #   General utilities (join codes, etc.)
├── scripts/                      # Database & email setup scripts
├── tests/                        # E2E tests (Playwright)
└── supabase/                     # Database migrations
    └── migrations/features/      #   Feature-specific migrations
```

## 🔐 Security

- **Multi-Tenant Isolation** - Organization-scoped data access for all admin operations
- **Row Level Security (RLS)** - Database-level access control
- **Role-based Authentication** - Super Admin, Admin, Judge, and Participant roles with strict separation
- **Super Admin Isolation** - Super admins cannot access admin routes and vice versa
- **Multiple Auth Methods** - Password, Passwordless OTP, and Invite Links
- **Crypto-secure Tokens** - 128-bit entropy for invitation tokens
- **Judge Assignment System** - Judges can only access and score assigned events
- **Secure API Routes** - Protected endpoints with role-based middleware
- **Organization Boundaries** - Admins cannot access data outside their organization
- **Score Preservation** - Judge scores are preserved when removing judges from organizations
- **Event Stage Gating** - Team mutations locked during active judging

## 📊 Database Schema

The system uses thirteen main tables:

- **organizations** - Multi-tenant organizations with name, slug, and branding
- **events** - Event management with 4-stage lifecycle (setup/open/active/completed) and org scoping
- **users** - User accounts with role assignments (super_admin/admin/judge/participant) and org association
- **teams** - Team information with award types, join codes, and org-scoped events
- **criteria** - Weighted scoring criteria with categories per event
- **event_judges** - Judge assignment system for event access control
- **scores** - Individual judge scores and comments with event context
- **invitations** - Invitation tokens with role support (admin/judge/participant) and org scoping
- **submissions** - Stores participant/team challenge submission text and links for an event.
- **submission_ai_scores** - Stores AI-generated relevance scores for submissions
- **event_participants** - Participant-event registration tracking
- **team_members** - Team membership with creator flag and join timestamps
- **organization_members** - Judge-organization many-to-many membership

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start development server with Turbopack
npm run db:studio        # Open Drizzle Studio for database management

# Database Setup (Consolidated Approach)
npm run db:setup         # Complete database setup (schema + migrations)
npm run db:setup:seed    # Complete setup with realistic test data
npm run db:update        # Apply all feature migrations
npm run db:update invite-link                # Apply invite link migration
npm run db:update multi-tenant-participants  # Apply multi-tenant migration

# Database Management (Advanced)
npm run db:push          # Push schema changes to database
npm run db:generate      # Generate migrations (rarely needed with consolidated approach)

# Email Configuration
npm run setup:email-template   # Configure Supabase email templates for OTP

# Production
npm run build            # Build for production
npm run start            # Start production server

# Code Quality & Formatting
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run format:check     # Check if code is properly formatted
```

### Prettier Formatting

The project uses Prettier for consistent code formatting. Here are the most common formatting commands:

```bash
# Format all files in the project (recommended)
npm run format

# Check formatting without making changes
npm run format:check

# Format a single file
npx prettier --write path/to/file.tsx

# Check formatting for a single file (without changing it)
npx prettier --check path/to/file.tsx

# Format multiple specific files
npx prettier --write file1.tsx file2.tsx

# Format all files in a specific directory
npx prettier --write "app/admin/**/*.tsx"
```

## 🔧 GitHub Actions & CI/CD

### Automated Code Quality & Formatting

The project includes GitHub Actions workflows for automated code quality and formatting checks:

- **Lint & Format Workflow** - Runs on all pushes and pull requests
- **Workflow Location** - `.github/workflows/lint-and-format.yml`
- **Checks Performed**:
  - ESLint code quality analysis
  - Prettier code formatting validation
- **Purpose** - Ensure code quality and consistent formatting before merging

### Setting Up Branch Protection (Recommended)

To enforce code quality standards, set up branch protection rules:

1. **Go to Repository Settings**
   - Navigate to your GitHub repository
   - Click "Settings" → "Branches"

2. **Add Branch Protection Rule**
   - Click "Add rule"
   - Branch name pattern: `main`
   - ✅ Check "Require status checks to pass before merging"
   - ✅ Check "Require branches to be up to date before merging"
   - Select "lint" from the status checks list

3. **Save Changes**
   - This prevents merging PRs with lint or formatting errors
   - Ensures main branch always has clean, consistent code
   - Works alongside Vercel deployment automation

### Workflow Details

The Lint & Format workflow:
- Triggers on **all pushes** to **any branch**
- Triggers on **all pull requests**
- Uses Node.js 20 with npm ci for consistent installs
- **ESLint Check** - Fails if any code quality issues are found
- **Prettier Check** - Fails if code is not properly formatted
- Provides clear feedback in PR checks and status badges

This setup ensures both code quality and consistent formatting while maintaining fast development velocity.

## 🏆 Key Features Implemented

- ✅ **Multi-Tenant Platform** - Organization-based data isolation with super admin management
- ✅ **4-Stage Event Lifecycle** - Setup → Open → Active → Completed with stage-specific permissions
- ✅ **Participant Team Management** - Team creation, join codes, membership, and creator controls
- ✅ **Multi-Event Judge Support** - Judges assigned to multiple active events with URL-based routing
- ✅ **Multi-Organization Judges** - Judges can belong to multiple organizations simultaneously
- ✅ **Invite Link System** - Batch invitations with OTP verification for admins, judges, and participants
- ✅ **Multi-Auth Support** - Password, Passwordless OTP, and Invite Link authentication
- ✅ **Multi-Role System** - Super Admin, Admin, Judge, and Participant roles with role-based dashboards
- ✅ **Password Management** - Account settings with password change/set functionality
- ✅ **Judge Assignment Security** - Comprehensive judge-event assignment with score preservation
- ✅ **Weighted Scoring** - Flexible criteria weights with category-based filtering
- ✅ **Mobile Responsive** - Full mobile and tablet support with touch interfaces
- ✅ **Award Type System** - Technical, Business, and Both team categories
- ✅ **Three Scoring Modes** - Total, Average, and Weighted score calculations
- ✅ **Markdown Support** - Rich text formatting for criteria descriptions
- ✅ **Data Integrity** - Protection against destructive operations during events
- ✅ **Real-time Updates** - Live scoring with auto-save and progress tracking
- ✅ **Advanced Analytics** - Comprehensive results dashboard with filtering
- ✅ **CSV Export** - Multiple export formats with complete scoring data
- ✅ **Score Preservation** - Safe role changes and org removals that preserve historical scores

---

Built with ❤️ for hackathon organizers and judges by NL Eats Community Outreach Inc.
