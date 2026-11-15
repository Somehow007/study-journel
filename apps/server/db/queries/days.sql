-- name: GetDay :one
SELECT user_id, date, state_id, diary, created_at, updated_at
FROM day
WHERE user_id = sqlc.arg(user_id) AND date = sqlc.arg(date);

-- name: CreateDay :exec
INSERT INTO day (user_id, date, state_id, diary, created_at, updated_at)
VALUES (sqlc.arg(user_id), sqlc.arg(date), sqlc.narg(state_id), sqlc.arg(diary),
        sqlc.arg(created_at), sqlc.arg(updated_at));

-- name: UpdateDay :exec
UPDATE day SET
  state_id   = sqlc.narg(state_id),
  diary      = sqlc.arg(diary),
  updated_at = sqlc.arg(updated_at)
WHERE user_id = sqlc.arg(user_id) AND date = sqlc.arg(date);

-- name: DeleteDay :exec
DELETE FROM day
WHERE user_id = sqlc.arg(user_id) AND date = sqlc.arg(date);

-- name: ListDayRowsInRange :many
SELECT user_id, date, state_id, diary, created_at, updated_at
FROM day
WHERE user_id = sqlc.arg(user_id) AND date >= sqlc.arg(from_date) AND date <= sqlc.arg(to_date)
ORDER BY date;

-- name: ListAllDayRows :many
SELECT user_id, date, state_id, diary, created_at, updated_at
FROM day
WHERE user_id = sqlc.arg(user_id)
ORDER BY date;

-- name: SearchDaysByDiary :many
SELECT user_id, date, state_id, diary, created_at, updated_at
FROM day
WHERE user_id = sqlc.arg(user_id) AND instr(diary, sqlc.arg(keyword)) > 0
ORDER BY updated_at DESC
LIMIT 200;

-- name: ListRecordedDayDates :many
SELECT user_id, date, state_id, diary, created_at, updated_at
FROM day
WHERE user_id = sqlc.arg(user_id) AND date <= sqlc.arg(today)
ORDER BY date;

-- name: ListEntryDates :many
SELECT date
FROM entry
WHERE user_id = sqlc.arg(user_id) AND date <= sqlc.arg(today)
ORDER BY date;
