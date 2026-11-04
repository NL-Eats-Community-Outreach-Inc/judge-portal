BEGIN;

-- 1. Create the role-assignment table.
CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role public.user_role NOT NULL,
    granted_by uuid,
    granted_source text NOT NULL,
    created_at timestamptz NOT NULL
        DEFAULT timezone('utc'::text, now()),

    CONSTRAINT user_roles_pkey
        PRIMARY KEY (user_id, role),

    CONSTRAINT user_roles_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_roles_granted_by_fkey
        FOREIGN KEY (granted_by)
        REFERENCES public.users(id)
        ON DELETE SET NULL
);

-- 2. Index user_id for retrieving all roles assigned to a user.
CREATE INDEX idx_user_roles_user
    ON public.user_roles USING btree (user_id);

-- 3. Backfill every existing user's current role.
--    Additional roles can be assigned later by the application/admin.
INSERT INTO public.user_roles (
    user_id,
    role,
    granted_by,
    granted_source
)
SELECT
    id,
    role,
    NULL,
    'migration'
FROM public.users;

-- 4. RLS helper functions.
--    SECURITY DEFINER lets these functions check users.role without being
--    blocked by the users table's own RLS policies. A fixed search_path
--    prevents object-shadowing attacks.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = auth.uid()
          AND u.role = 'admin'::public.user_role
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_active_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'::public.user_role
    );
$function$;

-- Do not expose helper execution to anon/PUBLIC.
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_super_admin() TO authenticated;

-- 5. Enable Row Level Security.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. Users can read their own available roles.
--    Active admins and super admins can read all role assignments.
CREATE POLICY "Users can read own roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_active_admin()
        OR public.is_active_super_admin()
    );

-- 7. Active admins can grant/revoke ordinary roles.
--    Only active super admins can grant, modify, or revoke super_admin.
CREATE POLICY "Admins can insert ordinary roles"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            public.is_active_admin()
            AND role <> 'super_admin'::public.user_role
        )
        OR public.is_active_super_admin()
    );

CREATE POLICY "Admins can update ordinary roles"
    ON public.user_roles
    FOR UPDATE
    TO authenticated
    USING (
        (
            public.is_active_admin()
            AND role <> 'super_admin'::public.user_role
        )
        OR public.is_active_super_admin()
    )
    WITH CHECK (
        (
            public.is_active_admin()
            AND role <> 'super_admin'::public.user_role
        )
        OR public.is_active_super_admin()
    );

CREATE POLICY "Admins can delete ordinary roles"
    ON public.user_roles
    FOR DELETE
    TO authenticated
    USING (
        (
            public.is_active_admin()
            AND role <> 'super_admin'::public.user_role
        )
        OR public.is_active_super_admin()
    );

COMMIT;
