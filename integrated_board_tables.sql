-- Integrated Board System Tables
-- These tables support the unified board/messaging/task system

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
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

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
CREATE POLICY "Users can view their assignments" ON post_assignments
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Post creators can view all assignments" ON post_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM posts p 
            WHERE p.id = post_assignments.post_id 
            AND p.created_by = auth.uid()
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
