-- Create auction_log table to track all auction transactions
CREATE TABLE IF NOT EXISTS public.auction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sold', 'unsold', 'manual')),
    sale_price INTEGER,
    base_price INTEGER NOT NULL,
    bid_count INTEGER DEFAULT 0,
    category VARCHAR(10),
    gender VARCHAR(10),
    logged_at TIMESTAMPTZ DEFAULT now(),
    logged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_manual BOOLEAN DEFAULT FALSE,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deletion_reason TEXT
);

-- Create audit_log table for tracking deletions and reversals
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('delete_log', 'reverse_sale', 'manual_sale', 'ban_team', 'unban_team')),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('auction_log', 'sale', 'ban')),
    entity_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT,
    previous_state JSONB
);

-- Create indexes for efficient queries
CREATE INDEX idx_auction_log_logged_at ON public.auction_log (logged_at DESC);
CREATE INDEX idx_auction_log_player_id ON public.auction_log (player_id);
CREATE INDEX idx_auction_log_team_id ON public.auction_log (team_id);
CREATE INDEX idx_auction_log_deleted ON public.auction_log (deleted);
CREATE INDEX idx_audit_log_performed_at ON public.audit_log (performed_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log (entity_type, entity_id);

-- Enable Row Level Security
ALTER TABLE public.auction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for auction_log (admin-only access)
CREATE POLICY "Admins can view all auction logs"
    ON public.auction_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.email = ANY (
                SELECT email FROM public.admins
            )
        )
    );

CREATE POLICY "Admins can create auction logs"
    ON public.auction_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.email = ANY (
                SELECT email FROM public.admins
            )
        )
    );

CREATE POLICY "Admins can update auction logs"
    ON public.auction_log FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.email = ANY (
                SELECT email FROM public.admins
            )
        )
    );

-- RLS policies for audit_log (admin-only access)
CREATE POLICY "Admins can view audit logs"
    ON public.audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.email = ANY (
                SELECT email FROM public.admins
            )
        )
    );

CREATE POLICY "Admins can create audit logs"
    ON public.audit_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.email = ANY (
                SELECT email FROM public.admins
            )
        )
    );

-- Comments
COMMENT ON TABLE public.auction_log IS 'Records all auction transactions (sold, unsold, manual sales)';
COMMENT ON COLUMN public.auction_log.status IS 'Status of the auction: sold, unsold, or manual';
COMMENT ON COLUMN public.auction_log.is_manual IS 'TRUE if this was a manual sale recorded by admin';
COMMENT ON COLUMN public.auction_log.deleted IS 'TRUE if this log entry has been deleted/reversed';
COMMENT ON TABLE public.audit_log IS 'Audit trail for all reversible actions (deletions, reversals, manual operations)';
COMMENT ON COLUMN public.audit_log.previous_state IS 'JSON snapshot of the entity state before the action';
