SELECT
  idempotency_key,
  vocabulary_id,
  rating,
  result_new_status,
  result_review_count,
  result_again_count,
  new_interval_hours,
  next_review_at
FROM public.review_logs
WHERE idempotency_key = 'e6271866-950a-4b93-a94d-145ed14585ec';