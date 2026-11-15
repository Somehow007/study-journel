-- name: ListStates :many
SELECT id, user_id, builtin_key, label, color, polarity, sort, archived_at, created_at, updated_at
FROM state
WHERE user_id = sqlc.arg(user_id)
ORDER BY sort, created_at, id;

-- name: ListActiveStates :many
SELECT id, user_id, builtin_key, label, color, polarity, sort, archived_at, created_at, updated_at
FROM state
WHERE user_id = sqlc.arg(user_id) AND archived_at IS NULL
ORDER BY sort, created_at, id;

-- name: GetState :one
SELECT id, user_id, builtin_key, label, color, polarity, sort, archived_at, created_at, updated_at
FROM state
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: GetStateByBuiltinKey :one
SELECT id, user_id, builtin_key, label, color, polarity, sort, archived_at, created_at, updated_at
FROM state
WHERE user_id = sqlc.arg(user_id) AND builtin_key = sqlc.arg(builtin_key);

-- name: CreateState :exec
INSERT INTO state (id, user_id, builtin_key, label, color, polarity, sort, archived_at, created_at, updated_at)
VALUES (sqlc.arg(id), sqlc.arg(user_id), sqlc.narg(builtin_key), sqlc.arg(label), sqlc.arg(color),
        sqlc.arg(polarity), sqlc.arg(sort), NULL, sqlc.arg(created_at), sqlc.arg(updated_at));

-- name: UpdateState :exec
UPDATE state SET
  label       = sqlc.arg(label),
  color       = sqlc.arg(color),
  polarity    = sqlc.arg(polarity),
  sort        = sqlc.arg(sort),
  updated_at  = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: SetStateArchived :exec
UPDATE state SET archived_at = sqlc.narg(archived_at), updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: NextStateSort :one
SELECT COALESCE(MAX(sort), -1) + 1 AS next_sort
FROM state
WHERE user_id = sqlc.arg(user_id);
