-- ================================================================
-- FEATURE: Learner Portal
-- Description: Courses, modules, lessons, and learner progress
-- Dependencies: users table and auth schema
-- Idempotent: safe to re-run
-- ================================================================

-- 1. Ensure learner roles exist in both enums.
ALTER TYPE public.user_role
  ADD VALUE IF NOT EXISTS 'learner';

ALTER TYPE public.invitation_role
  ADD VALUE IF NOT EXISTS 'learner';

-- 2. Courses.
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL
    DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL
    DEFAULT timezone('utc'::text, now()),
  slug text NOT NULL UNIQUE
);

-- 3. Modules.
CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL
    REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  "order" integer NOT NULL,
  created_at timestamptz NOT NULL
    DEFAULT timezone('utc'::text, now()),
  slug text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_modules_course
  ON public.modules(course_id);

-- 4. Lessons.
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL
    REFERENCES public.modules(id) ON DELETE CASCADE,
  "sanityDocumentId" uuid NOT NULL,
  title text NOT NULL,
  description text,
  "order" integer NOT NULL,
  created_at timestamptz NOT NULL
    DEFAULT timezone('utc'::text, now()),
  slug text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lessons_module
  ON public.lessons(module_id);

-- 5. Learner progress.
CREATE TABLE IF NOT EXISTS public.learner_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL
    REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
    DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL
    DEFAULT timezone('utc'::text, now()),
  CONSTRAINT learner_progress_user_lesson_unique
    UNIQUE (user_id, lesson_id)
);

-- 6. Enable Row Level Security on all learner tables.
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_progress ENABLE ROW LEVEL SECURITY;