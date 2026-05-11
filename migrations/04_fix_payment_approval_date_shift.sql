CREATE OR REPLACE FUNCTION shift_dates_on_payment_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.payment_status = 'pending' AND NEW.payment_status = 'approved' THEN
    NEW.payment_approved_at := COALESCE(NEW.payment_approved_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
