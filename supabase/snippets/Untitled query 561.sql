BEGIN;

-- create test event A and test INSERTION 
WITH new_event AS (
  INSERT INTO public.events (
    id,
    name,
    status,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    'Trigger Test Event',
    'setup',
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO public.competitions (event_id)
SELECT id FROM new_event
RETURNING id, event_id, participant_signup_url; -- copy the id (paste it in competition id in update test)

-- create test event B
INSERT INTO public.events (
  id,
  name,
  status,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'Update Trigger Test Event B',
  'setup',
  NOW(),
  NOW()
)
RETURNING id;

-- Test on UPDATE on event_id (manually change from event A to event B)
UPDATE public.competitions
SET event_id = '6879835f-9385-4da6-b194-86fa060d3de3' -- paste Event B uuid
WHERE id = '457cdbe3-e44d-4691-bdbb-447d4a843041' -- paste competition id
RETURNING id, event_id, participant_signup_url;


ROLLBACK;
