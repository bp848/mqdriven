
-- Helper to consistently resolve the board admin user (full-access account)
CREATE OR REPLACE FUNCTION board_admin_user()
RETURNS UUID AS $$
    SELECT '23a855d4-ccfc-443d-b898-5704aab94231'::UUID;
$$ LANGUAGE sql IMMUTABLE;

-- Posts table - unified posts, messages, and tasks
CREATE TABLE IF NOT EXISTS posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT,
    content TEXT NOT NULL,
    visibility TEXT DEFAULT 'all' CHECK (visibility IN ('all', 'public', 'private', 'assigned')),
    is_task BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMPTZ,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Post assignments table - for assigning tasks/posts to specific users
CREATE TABLE IF NOT EXISTS post_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);
-- Ensure created_by exists on existing deployments
ALTER TABLE post_assignments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Post comments table
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post notifications table (optional - for tracking sent notifications)
CREATE TABLE IF NOT EXISTS post_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('new_post', 'new_comment', 'task_assigned', 'task_completed')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id, notification_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_created_by ON posts(created_by);
CREATE INDEX IF NOT EXISTS idx_posts_is_task ON posts(is_task);
CREATE INDEX IF NOT EXISTS idx_posts_due_date ON posts(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_assignments_post_id ON post_assignments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_assignments_user_id ON post_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_assignments_created_by ON post_assignments(created_by);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_notifications_user_id ON post_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_post_notifications_sent_at ON post_notifications(sent_at);

-- Row Level Security (RLS) policies
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_notifications ENABLE ROW LEVEL SECURITY;

-- Posts RLS policies
CREATE POLICY "Users can view posts they have access to" ON posts
    FOR SELECT USING (
        visibility IN ('all', 'public') OR
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM post_assignments pa 
            WHERE pa.post_id = posts.id 
            AND pa.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create posts" ON posts
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (created_by = auth.uid());

-- Post assignments RLS policies
DROP POLICY IF EXISTS "Users can view their assignments" ON post_assignments;
DROP POLICY IF EXISTS "Post creators can view all assignments" ON post_assignments;

-- Break the recursive dependency between posts <-> post_assignments policies by
-- keeping post_assignments self-contained. Creators can still view assignees
-- because we store who created the assignment.
CREATE POLICY "Assignments visible to assignee or creator" ON post_assignments
    FOR SELECT USING (
        auth.uid() IS NOT NULL
        AND (
            user_id = auth.uid()
            OR created_by = auth.uid()
            OR auth.uid() = board_admin_user()
        )
    );

CREATE POLICY "Assignments can be inserted by creator" ON post_assignments
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR auth.uid() = board_admin_user()
        )
    );

CREATE POLICY "Assignments can be removed by creator" ON post_assignments
    FOR DELETE USING (
        auth.uid() IS NOT NULL
        AND (
            created_by = auth.uid()
            OR auth.uid() = board_admin_user()
        )
    );

-- Post comments RLS policies
CREATE POLICY "Users can view comments on accessible posts" ON post_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM posts p 
            WHERE p.id = post_comments.post_id 
            AND (
                p.visibility IN ('all', 'public') OR
                p.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM post_assignments pa 
                    WHERE pa.post_id = p.id 
                    AND pa.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Users can create comments on accessible posts" ON post_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM posts p 
            WHERE p.id = post_comments.post_id 
            AND (
                p.visibility IN ('all', 'public') OR
                p.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM post_assignments pa 
                    WHERE pa.post_id = p.id 
                    AND pa.user_id = auth.uid()
                )
            )
        )
    );

-- Post notifications RLS policies
CREATE POLICY "Users can view their own notifications" ON post_notifications
    FOR SELECT USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER set_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Populate created_by for existing assignments when the column is newly added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns 
        WHERE table_name = 'post_assignments'
        AND column_name = 'created_by'
    ) THEN
        UPDATE post_assignments pa
        SET created_by = p.created_by
        FROM posts p
        WHERE pa.post_id = p.id
          AND pa.created_by IS NULL;
    END IF;
END$$;
