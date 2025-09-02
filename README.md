# JudgePortal

A comprehensive real-time judging system for hackathons and competitive events. Built with modern web technologies, JudgePortal enables judges to score teams based on customizable weighted criteria while providing admins with powerful management and analytics capabilities.

## 🎯 Features

### For Judges
- **Judge Assignment System** - Judges must be assigned to events by admins to participate
- **Automatic Active Event Display** - Judges see only the assigned active event automatically
- **Responsive Mobile Design** - Full mobile and tablet support with touch-friendly interfaces
- **Sidebar Navigation** - Easy team selection with completion status indicators
- **Real-time Auto-save** - Scores save immediately, comments save with intelligent debouncing (500ms)
- **Smart Criteria Filtering** - Only see relevant criteria based on team award types (Technical/Business/Both)
- **Score Validation** - Ensures complete and valid submissions with visual feedback
- **Progress Tracking** - Visual indicators show scoring completion status per team

### For Admins
- **Multi-Event Management** - Create and manage multiple events with complete data separation
- **Judge Assignment System** - Assign specific judges to events for enhanced security
- **Single Active Event Enforcement** - Prevents confusion by allowing only one active event at a time
- **User Role Management** - Promote judges to admins, delete judge accounts
- **Team Award Types** - Configure teams as Technical, Business, or Both competition categories
- **Weighted Criteria System** - Create scoring criteria with customizable weights (0-100%) and categories
- **Real-time Results Dashboard** - Live score updates with three scoring modes (Total/Average/Weighted)
- **Award Type Filtering** - Filter results dashboard by team award types
- **Advanced CSV Export** - Export complete results with all scoring modes and individual judge data
- **Drag-and-Drop Team Ordering** - Easily reorder team presentation sequence
- **Data Integrity Safeguards** - Prevent destructive operations during active judging sessions
- **Markdown Support** - Rich formatting for criteria descriptions with markdown syntax

## 🛠️ Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org/) with App Router
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL) with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: Supabase Auth with role-based access control
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) with [Lucide Icons](https://lucide.dev/)
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/) with PostCSS processing
- **Additional Libraries**: 
  - [@dnd-kit](https://dndkit.com/) for drag and drop functionality
  - [Sonner](https://sonner.emilkowal.ski/) for toast notifications
  - [react-markdown](https://github.com/remarkjs/react-markdown) for markdown rendering
  - [next-themes](https://github.com/pacocoursey/next-themes) for theme switching
- **Real-time Updates**: Supabase Realtime subscriptions
- **Type Safety**: TypeScript with strict mode
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
   - Go to Settings → API and copy your credentials

3. **Configure Environment Variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=eyJh...your-service-key
   DATABASE_URL=your-database-url
   ```

4. **Set up the Database**

   ```bash
   npm run db:setup
   ```
   
   This will:
   - ✅ Create all database tables and relationships
   - ✅ Set up Row Level Security policies  
   - ✅ Add database functions and triggers
   - ✅ Create proper indexes for performance

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Open the Application**
   
   Open [http://localhost:3000](http://localhost:3000) in your browser

### Create Your First Admin

1. **Sign up** at `/auth/sign-up`
2. **Promote to admin**:
   - Go to Supabase Dashboard
   - Table Editor → `users` table
   - Find your user, edit, change `role` to `admin`
3. **Log back in** - you'll now see the Admin Panel!

### Test Accounts

- **Admin**: `admin@example.com` / `admin123`
- **Judge 1**: `judge1@example.com` / `judge123`  
- **Judge 2**: `judge2@example.com` / `judge123`
- **Judge 3**: `judge3@example.com` / `judge123`

### Troubleshooting

**"Missing environment variables"**
- Check `.env.local` exists (not `.env`)
- Ensure all 4 variables are set correctly

**"Tables don't exist"**  
- Run `npm run db:setup` again
- If automated setup fails, copy `supabase/migrations/consolidated_setup.sql` to Supabase Dashboard > SQL Editor and run manually

**"Permission denied"**
- Make sure you promoted your user to admin role in the `users` table

## 📱 Usage

### First Time Setup

1. Create an admin account by signing up
2. Manually promote the user to admin role in Supabase dashboard (one-time setup)
3. Create an event and set it as "active"
4. Add teams with award types and scoring criteria with weights
5. Invite judges to register, then assign them to the event
6. Judges can start scoring assigned teams

### Judge Workflow

1. **Login** with email/password
2. **Assignment Check** - Must be assigned to active event by admin to participate
3. **View Active Event** - Automatically see assigned active event details
4. **Select Teams** - Use mobile-responsive sidebar to navigate between teams
5. **Submit Scores** - Enter scores for relevant criteria based on team award type (auto-saved)
6. **Add Comments** - Optional feedback with markdown support (saves after 500ms pause)
7. **Track Progress** - Visual indicators show completion status across all devices

### Admin Workflow

1. **Login** as admin
2. **Manage Events** - Create, edit, and activate events with single active enforcement
3. **Assign Judges** - Assign specific judges to events for security
4. **Configure Teams** - Add teams with award types (Technical/Business/Both) and presentation order
5. **Set Weighted Criteria** - Define scoring criteria with weights, categories, and markdown descriptions
6. **Manage Users** - Promote judges to admins, delete judge accounts
7. **Monitor Results** - View real-time scores with three scoring modes and award type filtering
8. **Export Data** - Download CSV with total, average, and weighted scores

## 🗂️ Project Structure

```
judgeportal/
├── app/                   # Next.js app directory
│   ├── admin/             # Admin panel routes
│   ├── judge/             # Judge interface routes
│   ├── api/               # API endpoints
│   └── auth/              # Authentication pages
├── components/            # Reusable UI components
├── lib/                   # Core utilities
│   ├── auth/              # Authentication helpers
│   ├── db/                # Database schema and utilities
│   └── supabase/          # Supabase client configuration
└── supabase/              # Database migrations
```

## 🔐 Security

- **Row Level Security (RLS)** - Database-level access control
- **Role-based Authentication** - Separate judge and admin permissions
- **Judge Assignment System** - Judges can only access assigned events
- **Secure API Routes** - Protected endpoints with middleware
- **Data Isolation** - Complete separation between events

## 📊 Database Schema

The system uses six main tables:

- **events** - Event management with status tracking (setup/active/completed)
- **users** - User accounts with role assignments (admin/judge)
- **teams** - Team information with award types (technical/business/both)
- **criteria** - Weighted scoring criteria with categories per event
- **event_judges** - Judge assignment system for event access control
- **scores** - Individual judge scores and comments with event context

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start development server with Turbopack
npm run db:studio        # Open Drizzle Studio for database management

# Database Setup (Consolidated Approach)
npm run db:setup         # Complete database setup (schema + migrations)
npm run db:setup:seed    # Complete setup with realistic test data
npm run db:seed          # Add test data to existing database

# Database Management (Advanced)
npm run db:push          # Push schema changes to database
npm run db:generate      # Generate migrations (rarely needed with consolidated approach)

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

## 🏆 Key Features Implemented

- ✅ **Judge Assignment Security** - Comprehensive judge-event assignment system
- ✅ **Weighted Scoring** - Flexible criteria weights with category-based filtering
- ✅ **Mobile Responsive** - Full mobile and tablet support with touch interfaces
- ✅ **Award Type System** - Technical, Business, and Both team categories
- ✅ **Three Scoring Modes** - Total, Average, and Weighted score calculations
- ✅ **Markdown Support** - Rich text formatting for criteria descriptions
- ✅ **Data Integrity** - Protection against destructive operations during events
- ✅ **Real-time Updates** - Live scoring with auto-save and progress tracking
- ✅ **Advanced Analytics** - Comprehensive results dashboard with filtering
- ✅ **CSV Export** - Multiple export formats with complete scoring data

---

Built with ❤️ for hackathon organizers and judges by NL Eats Community Outreach Inc.
