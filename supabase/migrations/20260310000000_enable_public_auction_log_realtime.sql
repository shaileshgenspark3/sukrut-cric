-- Keep live outcome surfaces fast by making auction_log changes visible to
-- realtime subscribers and allowing public reads of non-deleted outcome rows.

DO $$
BEGIN
  IF to_regclass('public.auction_log') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_log;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.dashboard_presence') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_presence;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DROP POLICY IF EXISTS "Public can view active auction logs" ON public.auction_log;
CREATE POLICY "Public can view active auction logs"
  ON public.auction_log
  FOR SELECT
  USING (deleted = false);
