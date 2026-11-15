-- name: ListCheckinsByGoal :many
SELECT id, goal_id, date, quantity, note, entry_id, created_at, updated_at
FROM goal_checkin
WHERE goal_id = sqlc.arg(goal_id)
ORDER BY date;

-- name: ListCheckinsForUserPeriod :many
SELECT c.id, c.goal_id, c.date, c.quantity, c.note, c.entry_id, c.created_at, c.updated_at
FROM goal_checkin c
JOIN goal g ON g.id = c.goal_id
WHERE g.user_id = sqlc.arg(user_id) AND g.period = sqlc.arg(period)
ORDER BY c.goal_id, c.date;

-- name: ListAllCheckinsForUser :many
SELECT c.id, c.goal_id, c.date, c.quantity, c.note, c.entry_id, c.created_at, c.updated_at
FROM goal_checkin c
JOIN goal g ON g.id = c.goal_id
WHERE g.user_id = sqlc.arg(user_id)
ORDER BY c.goal_id, c.date;

-- name: GetCheckin :one
SELECT c.id, c.goal_id, c.date, c.quantity, c.note, c.entry_id, c.created_at, c.updated_at
FROM goal_checkin c
JOIN goal g ON g.id = c.goal_id
WHERE c.goal_id = sqlc.arg(goal_id) AND c.date = sqlc.arg(date) AND g.user_id = sqlc.arg(user_id);

-- name: CreateCheckin :exec
INSERT INTO goal_checkin (id, goal_id, date, quantity, note, entry_id, created_at, updated_at)
VALUES (sqlc.arg(id), sqlc.arg(goal_id), sqlc.arg(date), sqlc.arg(quantity), sqlc.arg(note),
        sqlc.narg(entry_id), sqlc.arg(created_at), sqlc.arg(updated_at));

-- name: UpdateCheckin :exec
UPDATE goal_checkin SET
  quantity  = sqlc.arg(quantity),
  note      = sqlc.arg(note),
  entry_id  = sqlc.narg(entry_id),
  updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id);

-- name: DeleteCheckin :exec
DELETE FROM goal_checkin
WHERE id = sqlc.arg(id);

-- name: ListCheckinsByDate :many
SELECT c.id, c.goal_id, c.date, c.quantity, c.note, c.entry_id, c.created_at, c.updated_at
FROM goal_checkin c
JOIN goal g ON g.id = c.goal_id
WHERE g.user_id = sqlc.arg(user_id) AND c.date = sqlc.arg(checkin_date)
  AND g.status = 'ACTIVE' AND g.period = sqlc.arg(goal_period)
ORDER BY c.created_at, c.id;
