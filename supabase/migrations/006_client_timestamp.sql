-- Store the client-side timestamp separately from server-side created_at.
-- created_at always uses DB now() for accurate server time;
-- client_timestamp captures when the pixel fired in the visitor's browser.
ALTER TABLE public.page_view_events
  ADD COLUMN IF NOT EXISTS client_timestamp TIMESTAMPTZ;
