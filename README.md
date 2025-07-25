# JudgePortal

A comprehensive real-time judging system for hackathons and competitive events. Built with modern web technologies, JudgePortal enables judges to score teams based on customizable criteria while providing admins with powerful management and analytics capabilities.

## 🎯 Features

### For Judges
- **Automatic Event Detection** - Judges automatically see only the currently active event
- **Sidebar Navigation** - Easy team selection with completion status indicators
- **Real-time Auto-save** - Scores save immediately, comments save with intelligent debouncing
- **Score Validation** - Ensures complete and valid submissions with visual feedback
- **Progress Tracking** - Visual indicators show scoring completion status per team

### For Admins
- **Multi-Event Management** - Create and manage multiple events with complete data separation
- **Single Active Event Enforcement** - Prevents confusion by allowing only one active event at a time
- **User Role Management** - Promote judges to admins, manage permissions
- **Dynamic Criteria Configuration** - Create custom scoring criteria with configurable ranges
- **Real-time Results Dashboard** - Live score updates with team rankings and statistics
- **CSV Export** - Export complete results with individual scores and rankings
- **Drag-and-Drop Team Ordering** - Easily reorder team presentation sequence

## 🛠️ Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org/) with App Router
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL) with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: Supabase Auth with role-based access control
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) with [Lucide Icons](https://lucide.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with gradient theme
- **Real-time Updates**: Supabase Realtime subscriptions
- **Type Safety**: TypeScript with strict mode

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/judgeportal.git
   cd judgeportal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**
   ```bash
   # Push the schema to your Supabase database
   npm run db:push
   
   # (Optional) Seed with test data
   npm run db:seed
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 Usage

### First Time Setup

1. Create your first admin account by signing up
2. Manually promote the user to admin role in Supabase dashboard (one-time setup)
3. Create your first event and set it as "active"
4. Add teams and scoring criteria
5. Invite judges to register and start scoring

### Judge Workflow

1. **Login** with email/password
2. **View Active Event** - Automatically see the current active event details
3. **Select Teams** - Use the sidebar to navigate between teams
4. **Submit Scores** - Enter scores for each criterion (auto-saved)
5. **Add Comments** - Optional feedback (saves after 500ms pause)
6. **Track Progress** - Visual indicators show completion status

### Admin Workflow

1. **Login** as admin
2. **Manage Events** - Create, edit, and activate events
3. **Configure Teams** - Add teams with project details and presentation order
4. **Set Criteria** - Define scoring criteria with min/max ranges
5. **Manage Users** - Promote judges to admins as needed
6. **Monitor Results** - View real-time scores and rankings
7. **Export Data** - Download CSV with complete scoring data

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
- **Secure API Routes** - Protected endpoints with middleware
- **Data Isolation** - Complete separation between events

## 📊 Database Schema

The system uses five main tables:

- **events** - Event management with status tracking
- **users** - User accounts with role assignments
- **teams** - Team information and project details  
- **criteria** - Dynamic scoring criteria per event
- **scores** - Individual judge scores and comments

## 🛠️ Development Commands

```bash
# Development
npm run dev          # Start development server with Turbopack

# Database
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio for database management
npm run db:generate  # Generate migrations
npm run db:seed      # Seed database with test data

# Production
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

---

Built with ❤️ for hackathon organizers and judges at NL Eats.
