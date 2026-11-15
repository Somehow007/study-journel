-- name: ListTasksByGoal :many
SELECT id, goal_id, title, due_date, week_start, done_at, reflection, entry_id, sort, created_at, updated_at
FROM goal_task
WHERE goal_id = sqlc.arg(goal_id)
ORDER BY sort, created_at, id;

-- name: ListTasksForUserPeriod :many
SELECT t.id, t.goal_id, t.title, t.due_date, t.week_start, t.done_at, t.reflection, t.entry_id, t.sort, t.created_at, t.updated_at
FROM goal_task t
JOIN goal g ON g.id = t.goal_id
WHERE g.user_id = sqlc.arg(user_id) AND g.period = sqlc.arg(period)
ORDER BY t.goal_id, t.sort, t.created_at, t.id;

-- name: ListAllTasksForUser :many
SELECT t.id, t.goal_id, t.title, t.due_date, t.week_start, t.done_at, t.reflection, t.entry_id, t.sort, t.created_at, t.updated_at
FROM goal_task t
JOIN goal g ON g.id = t.goal_id
WHERE g.user_id = sqlc.arg(user_id)
ORDER BY t.goal_id, t.sort, t.created_at, t.id;

-- name: GetTask :one
SELECT t.id, t.goal_id, t.title, t.due_date, t.week_start, t.done_at, t.reflection, t.entry_id, t.sort, t.created_at, t.updated_at
FROM goal_task t
JOIN goal g ON g.id = t.goal_id
WHERE t.id = sqlc.arg(id) AND g.user_id = sqlc.arg(user_id);

-- name: CreateTask :exec
INSERT INTO goal_task (id, goal_id, title, due_date, week_start, done_at, reflection, entry_id, sort, created_at, updated_at)
VALUES (sqlc.arg(id), sqlc.arg(goal_id), sqlc.arg(title), sqlc.narg(due_date), sqlc.narg(week_start),
        sqlc.narg(done_at), sqlc.arg(reflection), sqlc.narg(entry_id), sqlc.arg(sort),
        sqlc.arg(created_at), sqlc.arg(updated_at));

-- name: UpdateTask :exec
UPDATE goal_task SET
  title       = sqlc.arg(title),
  due_date    = sqlc.narg(due_date),
  week_start  = sqlc.narg(week_start),
  done_at     = sqlc.narg(done_at),
  reflection  = sqlc.arg(reflection),
  entry_id    = sqlc.narg(entry_id),
  sort        = sqlc.arg(sort),
  updated_at  = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id);

-- name: DeleteTask :exec
DELETE FROM goal_task
WHERE id = sqlc.arg(id);

-- name: NextTaskSort :one
SELECT COALESCE(MAX(sort), -1) + 1 AS next_sort
FROM goal_task
WHERE goal_id = sqlc.arg(goal_id);
