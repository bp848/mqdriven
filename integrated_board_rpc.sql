-- Integrated Board System RPC Functions
-- These functions support the unified board/messaging/task system

-- Helper to reference the company president who should have full board access
CREATE OR REPLACE FUNCTION board_admin_user()
RETURNS UUID AS $$
    SELECT '23a855d4-ccfc-443d-b898-5704aab94231'::UUID;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_user_posts(
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    visibility TEXT,
    is_task BOOLEAN,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_by UUID,
    completed BOOLEAN,
    assignee_count INTEGER,
    comment_count INTEGER,
    is_assigned BOOLEAN
) AS $$
DECLARE
    v_admin_user UUID := board_admin_user();
    v_user_id UUID := COALESCE(p_user_id, auth.uid(), v_admin_user);
BEGIN
    IF v_user_id IS NULL THEN
        -- When no user id is available we only return publicly visible posts
        RETURN QUERY
        SELECT 
            p.id,
            p.title,
            p.content,
            p.visibility,
            p.is_task,
            p.due_date,
            p.created_at,
            p.updated_at,
            p.created_by,
            COALESCE(p.completed, false) as completed,
            COALESCE((SELECT COUNT(*) FROM post_assignments pa WHERE pa.post_id = p.id), 0)::INT as assignee_count,
            COALESCE((SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id), 0)::INT as comment_count,
            false as is_assigned
        FROM posts p
        WHERE p.visibility IN ('all', 'public')
        ORDER BY p.created_at DESC;
        RETURN;
    END IF;

    IF v_user_id = v_admin_user THEN
        RETURN QUERY
        SELECT 
            p.id,
            p.title,
            p.content,
            p.visibility,
            p.is_task,
            p.due_date,
            p.created_at,
            p.updated_at,
            p.created_by,
            COALESCE(p.completed, false) as completed,
            COALESCE((SELECT COUNT(*) FROM post_assignments pa WHERE pa.post_id = p.id), 0)::INT as assignee_count,
            COALESCE((SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id), 0)::INT as comment_count,
            EXISTS(SELECT 1 FROM post_assignments pa WHERE pa.post_id = p.id AND pa.user_id = v_user_id) as is_assigned
        FROM posts p
        ORDER BY p.created_at DESC;
        RETURN;
    END IF;
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.content,
        p.visibility,
        p.is_task,
        p.due_date,
        p.created_at,
        p.updated_at,
        p.created_by,
        COALESCE(p.completed, false) as completed,
        COALESCE((SELECT COUNT(*) FROM post_assignments pa WHERE pa.post_id = p.id), 0)::INT as assignee_count,
        COALESCE((SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id), 0)::INT as comment_count,
        EXISTS(SELECT 1 FROM post_assignments pa WHERE pa.post_id = p.id AND pa.user_id = v_user_id) as is_assigned
    FROM posts p
    WHERE 
        p.visibility IN ('all', 'public')
        OR (p.visibility = 'private' AND p.created_by = v_user_id)
        OR EXISTS(
            SELECT 1 FROM post_assignments pa 
            WHERE pa.post_id = p.id 
            AND (pa.user_id = v_user_id OR p.visibility = 'assigned')
        )
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a new post
CREATE OR REPLACE FUNCTION create_post(
    p_title TEXT,
    p_content TEXT,
    p_visibility TEXT DEFAULT 'all',
    p_is_task BOOLEAN DEFAULT FALSE,
    p_due_date TIMESTAMPTZ DEFAULT NULL,
    p_assignees UUID[] DEFAULT ARRAY[]::UUID[],
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_post_id UUID;
    v_admin_user UUID := board_admin_user();
    v_user_id UUID := COALESCE(p_created_by, auth.uid(), v_admin_user);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required to create a post';
    END IF;
    -- Sanitize visibility input
    IF p_visibility IS NULL OR p_visibility NOT IN ('all', 'public', 'private', 'assigned') THEN
        RAISE EXCEPTION 'Invalid visibility value: %', p_visibility;
    END IF;
    -- Insert the post
    INSERT INTO posts (title, content, visibility, is_task, due_date, created_by)
    VALUES (p_title, p_content, p_visibility, p_is_task, p_due_date, v_user_id)
    RETURNING id INTO v_post_id;
    
    -- Add assignees if provided
    IF p_assignees IS NOT NULL AND array_length(p_assignees, 1) > 0 THEN
        INSERT INTO post_assignments (post_id, user_id, created_by)
        SELECT v_post_id, unnest(p_assignees), v_user_id;
    END IF;
    
    RETURN v_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add comment to post
CREATE OR REPLACE FUNCTION add_comment(
    p_post_id UUID,
    p_content TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_comment_id UUID;
    v_admin_user UUID := board_admin_user();
    v_user_id UUID := COALESCE(p_user_id, auth.uid(), v_admin_user);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required to add a comment';
    END IF;
    INSERT INTO post_comments (post_id, content, user_id)
    VALUES (p_post_id, p_content, v_user_id)
    RETURNING id INTO v_comment_id;
    
    RETURN v_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a task
CREATE OR REPLACE FUNCTION complete_task(
    p_post_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_admin_user UUID := board_admin_user();
    v_user_id UUID := COALESCE(p_user_id, auth.uid(), v_admin_user);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required to complete a task';
    END IF;
    -- Check if user is assigned to this task
    IF v_user_id <> v_admin_user AND NOT EXISTS(
        SELECT 1 FROM post_assignments pa 
        WHERE pa.post_id = p_post_id 
        AND pa.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'User is not assigned to this task';
    END IF;
    
    -- Mark task as completed
    UPDATE posts 
    SET completed = true, updated_at = NOW()
    WHERE id = p_post_id AND is_task = true;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
