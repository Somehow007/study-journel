-- name: ListGoalsByPeriod :many
SELECT id, user_id, period, subject_id, title, type, target_value, unit, color,
       note, sort, status, carried_from, created_at, updated_at
FROM goal
WHERE user_id = sqlc.arg(user_id) AND period = sqlc.arg(period) AND status != 'ARCHIVED'
ORDER BY sort, created_at, id;

-- name: ListAllGoals :many
SELECT id, user_id, period, subject_id, title, type, target_value, unit, color,
       note, sort, status, carried_from, created_at, updated_at
FROM goal
WHERE user_id = sqlc.arg(user_id)
ORDER BY period, sort, created_at, id;

-- name: GetGoal :one
SELECT id, user_id, period, subject_id, title, type, target_value, unit, color,
       note, sort, status, carried_from, created_at, updated_at
FROM goal
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: CreateGoal :exec
INSERT INTO goal (id, user_id, period, subject_id, title, type, target_value, unit,
                  color, note, sort, status, carried_from, created_at, updated_at)
VALUES (sqlc.arg(id), sqlc.arg(user_id), sqlc.arg(period), sqlc.narg(subject_id),
        sqlc.arg(title), sqlc.arg(type), sqlc.narg(target_value), sqlc.narg(unit),
        sqlc.narg(color), sqlc.arg(note), sqlc.arg(sort), sqlc.arg(status),
        sqlc.narg(carried_from), sqlc.arg(created_at), sqlc.arg(updated_at));

-- name: UpdateGoal :exec
UPDATE goal SET
  subject_id   = sqlc.narg(subject_id),
  title        = sqlc.arg(title),
  target_value = sqlc.narg(target_value),
  unit         = sqlc.narg(unit),
  color        = sqlc.narg(color),
  note         = sqlc.arg(note),
  sort         = sqlc.arg(sort),
  status       = sqlc.arg(status),
  updated_at   = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: DeleteGoal :exec
DELETE FROM goal
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: TouchGoal :exec
UPDATE goal SET updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: NextGoalSort :one
SELECT COALESCE(MAX(sort), -1) + 1 AS next_sort
FROM goal
WHERE user_id = sqlc.arg(user_id) AND period = sqlc.arg(period);
