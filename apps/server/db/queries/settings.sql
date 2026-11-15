-- name: GetSetting :one
SELECT user_id, exam_name, exam_date, phase_start, daily_goal_min, week_starts_on,
       focus_min, break_min, theme, updated_at
FROM setting
WHERE user_id = sqlc.arg(user_id);

-- name: CreateSetting :exec
INSERT INTO setting (user_id, exam_name, exam_date, phase_start, daily_goal_min,
                     week_starts_on, focus_min, break_min, theme, updated_at)
VALUES (sqlc.arg(user_id), sqlc.arg(exam_name), sqlc.narg(exam_date), sqlc.narg(phase_start),
        sqlc.arg(daily_goal_min), sqlc.arg(week_starts_on), sqlc.arg(focus_min),
        sqlc.arg(break_min), sqlc.arg(theme), sqlc.arg(updated_at));

-- name: UpdateSetting :exec
UPDATE setting SET
  exam_name       = sqlc.arg(exam_name),
  exam_date       = sqlc.narg(exam_date),
  phase_start     = sqlc.narg(phase_start),
  daily_goal_min  = sqlc.arg(daily_goal_min),
  week_starts_on  = sqlc.arg(week_starts_on),
  focus_min       = sqlc.arg(focus_min),
  break_min       = sqlc.arg(break_min),
  theme           = sqlc.arg(theme),
  updated_at      = sqlc.arg(updated_at)
WHERE user_id = sqlc.arg(user_id);

-- name: EnsureSetting :exec
INSERT OR IGNORE INTO setting (user_id, updated_at)
VALUES (sqlc.arg(user_id), sqlc.arg(updated_at));

-- name: CountBuiltinStates :one
SELECT COUNT(*) AS builtin_states
FROM state
WHERE user_id = sqlc.arg(user_id) AND builtin_key IS NOT NULL;

-- name: CountSubjects :one
SELECT COUNT(*) AS subjects
FROM subject
WHERE user_id = sqlc.arg(user_id);
