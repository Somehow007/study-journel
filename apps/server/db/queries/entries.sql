-- name: ListEntriesByDate :many
SELECT e.id, e.user_id, e.date, e.subject_id, e.title, e.note, e.duration_min,
       e.source, e.sort, e.created_at, e.updated_at,
       s.name AS subject_name, s.color AS subject_color
FROM entry e
JOIN subject s ON s.id = e.subject_id
WHERE e.user_id = sqlc.arg(user_id) AND e.date = sqlc.arg(date)
ORDER BY e.sort, e.created_at, e.id;

-- name: ListEntriesInRange :many
SELECT e.id, e.user_id, e.date, e.subject_id, e.title, e.note, e.duration_min,
       e.source, e.sort, e.created_at, e.updated_at,
       s.name AS subject_name, s.color AS subject_color
FROM entry e
JOIN subject s ON s.id = e.subject_id
WHERE e.user_id = sqlc.arg(user_id) AND e.date >= sqlc.arg(from_date) AND e.date <= sqlc.arg(to_date)
ORDER BY e.date, e.sort, e.created_at, e.id;

-- name: ListAllEntries :many
SELECT e.id, e.user_id, e.date, e.subject_id, e.title, e.note, e.duration_min,
       e.source, e.sort, e.created_at, e.updated_at,
       s.name AS subject_name, s.color AS subject_color
FROM entry e
JOIN subject s ON s.id = e.subject_id
WHERE e.user_id = sqlc.arg(user_id)
ORDER BY e.date, e.sort, e.created_at, e.id;

-- name: GetEntry :one
SELECT e.id, e.user_id, e.date, e.subject_id, e.title, e.note, e.duration_min,
       e.source, e.sort, e.created_at, e.updated_at,
       s.name AS subject_name, s.color AS subject_color
FROM entry e
JOIN subject s ON s.id = e.subject_id
WHERE e.id = sqlc.arg(id) AND e.user_id = sqlc.arg(user_id);

-- name: CreateEntry :exec
INSERT INTO entry (id, user_id, date, subject_id, title, note, duration_min, source, sort, created_at, updated_at)
VALUES (sqlc.arg(id), sqlc.arg(user_id), sqlc.arg(date), sqlc.arg(subject_id), sqlc.arg(title),
        sqlc.arg(note), sqlc.arg(duration_min), sqlc.arg(source), sqlc.arg(sort),
        sqlc.arg(created_at), sqlc.arg(updated_at));

-- name: UpdateEntry :exec
UPDATE entry SET
  date         = sqlc.arg(date),
  subject_id   = sqlc.arg(subject_id),
  title        = sqlc.arg(title),
  note         = sqlc.arg(note),
  duration_min = sqlc.arg(duration_min),
  source       = sqlc.arg(source),
  sort         = sqlc.arg(sort),
  updated_at   = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: DeleteEntry :exec
DELETE FROM entry
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: DeleteEntriesByDate :exec
DELETE FROM entry
WHERE user_id = sqlc.arg(user_id) AND date = sqlc.arg(date);

-- name: SetEntrySort :exec
UPDATE entry SET sort = sqlc.arg(sort), updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: SearchEntries :many
SELECT e.id, e.user_id, e.date, e.subject_id, e.title, e.note, e.duration_min,
       e.source, e.sort, e.created_at, e.updated_at,
       s.name AS subject_name, s.color AS subject_color
FROM entry e
JOIN subject s ON s.id = e.subject_id
WHERE e.user_id = sqlc.arg(user_id)
  AND (instr(e.title, sqlc.arg(keyword)) > 0
    OR instr(e.note, sqlc.arg(keyword)) > 0
    OR instr(s.name, sqlc.arg(keyword)) > 0)
ORDER BY e.updated_at DESC
LIMIT 200;
