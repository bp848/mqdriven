CREATE TABLE public.customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    source_email_id TEXT,
    source_type TEXT NOT NULL DEFAULT 'email', -- 'email', 'manual', 'visit_memo'
    feedback_summary TEXT NOT NULL,
    original_text TEXT,
    status TEXT DEFAULT 'new', -- 'new', 'acknowledged', 'archived'
    feedback_date DATE NOT NULL DEFAULT CURRENT_DATE
);

COMMENT ON TABLE public.customer_feedback IS 'Stores customer feedback collected from various sources like emails or manual entry.';
COMMENT ON COLUMN public.customer_feedback.user_id IS 'The user who collected or is associated with this feedback.';
COMMENT ON COLUMN public.customer_feedback.customer_id IS 'The customer who gave the feedback.';
COMMENT ON COLUMN public.customer_feedback.application_id IS 'Link to the daily report (application) this feedback was included in.';
COMMENT ON COLUMN public.customer_feedback.source_email_id IS 'The unique ID of the source Gmail message.';
COMMENT ON COLUMN public.customer_feedback.source_type IS 'The origin of the feedback.';
COMMENT ON COLUMN public.customer_feedback.feedback_summary IS 'A concise summary of the feedback, possibly AI-generated.';
COMMENT ON COLUMN public.customer_feedback.original_text IS 'The full text of the feedback if available.';
COMMENT ON COLUMN public.customer_feedback.status IS 'The status of the feedback for workflow purposes.';
COMMENT ON COLUMN public.customer_feedback.feedback_date IS 'The date the feedback was received.';

-- Add indexes for performance
CREATE INDEX idx_customer_feedback_user_id ON public.customer_feedback(user_id);
CREATE INDEX idx_customer_feedback_customer_id ON public.customer_feedback(customer_id);
CREATE INDEX idx_customer_feedback_feedback_date ON public.customer_feedback(feedback_date);

-- Enable Row Level Security
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
CREATE POLICY "Users can view their own feedback"
ON public.customer_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert feedback for themselves"
ON public.customer_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON public.customer_feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
ON public.customer_feedback FOR DELETE
USING (auth.uid() = user_id);

-- Admins can do anything
CREATE POLICY "Admins have full access"
ON public.customer_feedback
FOR ALL USING (
  (get_my_claim('role'::text)) = '"admin"'::jsonb
);

