-- accounting projections table for scenario planning
CREATE TABLE IF NOT EXISTS accounting.projections (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_name text NOT NULL,
    metric_type text NOT NULL, -- e.g., revenue, expense, cash_in, cash_out
    account_code text,
    period_start date NOT NULL,
    period_end date NOT NULL,
    amount numeric(18,2) NOT NULL,
    notes text,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_projections_period
    ON accounting.projections (period_start, period_end, metric_type);

CREATE INDEX IF NOT EXISTS idx_projections_scenario
    ON accounting.projections (scenario_name);
