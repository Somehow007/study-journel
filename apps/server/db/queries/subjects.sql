-- name: ListSubjects :many
SELECT id, user_id, name, color, sort, archived_at, created_at, updated_at
FROM subject
WHERE user_id = sqlc.arg(user_id)
ORDER BY sort, created_at, id;

-- name: ListActiveSubjects :many
SELECT id, user_id, name, color, sort, archived_at, created_at, updated_at
FROM subject
WHERE user_id = sqlc.arg(user_id) AND archived_at IS NULL
ORDER BY sort, created_at, id;

-- name: GetSubject :one
SELECT id, user_id, name, color, sort, archived_at, created_at, updated_at
FROM subject
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: GetSubjectByName :one
SELECT id, user_id, name, color, sort, archived_at, created_at, updated_at
FROM subject
WHERE user_id = sqlc.arg(user_id) AND name = sqlc.arg(name);

-- name: CreateSubject :exec
INSERT INTO subject (id, user_id, name, color, sort, archived_at, created_at, updated_at)
VALUES (sqlc.arg(id), sqlc.arg(user_id), sqlc.arg(name), sqlc.arg(color),
        sqlc.arg(sort), NULL, sqlc.arg(created_at), sqlc.arg(updated_at));

-- name: UpdateSubject :exec
UPDATE subject SET
  name       = sqlc.arg(name),
  color      = sqlc.arg(color),
  sort       = sqlc.arg(sort),
  updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: SetSubjectArchived :exec
UPDATE subject SET archived_at = sqlc.narg(archived_at), updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: NextSubjectSort :one
SELECT COALESCE(MAX(sort), -1) + 1 AS next_sort
FROM subject
WHERE user_id = sqlc.arg(user_id);
