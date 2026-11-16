package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"journal/internal/auth"
	"journal/internal/domain"
)

func setupUser(t *testing.T) (http.Handler, string) {
	t.Helper()
	deps, h := newTestEnv(t)
	if _, err := auth.CreateUser(context.Background(), deps.DB, "bob", "pw-123456"); err != nil {
		t.Fatalf("create user: %v", err)
	}
	rec := doJSON(t, h, "POST", "/api/v1/auth/login", `{"username":"bob","password":"pw-123456"}`, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login: %d %s", rec.Code, rec.Body.String())
	}
	return h, sessionCookie(rec)
}

func data(t *testing.T, recBody string) map[string]any {
	t.Helper()
	var env envelope
	if err := json.Unmarshal([]byte(recBody), &env); err != nil {
		t.Fatalf("bad envelope: %v", err)
	}
	if env.Code != "0" {
		t.Fatalf("code=%q msg=%q body=%s", env.Code, env.Message, recBody)
	}
	m, _ := env.Data.(map[string]any)
	return m
}

func TestJournalRequiresAuth(t *testing.T) {
	_, h := newTestEnv(t)
	for _, p := range []string{"/api/v1/settings", "/api/v1/subjects", "/api/v1/states",
		"/api/v1/days/2026-11-15", "/api/v1/goals", "/api/v1/search?q=x", "/api/v1/export"} {
		rec := doJSON(t, h, "GET", p, "", "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s: got %d want 401", p, rec.Code)
		}
	}
}

func TestBootstrapSeeds(t *testing.T) {
	h, cookie := setupUser(t)
	rec := doJSON(t, h, "GET", "/api/v1/states", "", cookie)
	var env envelope
	json.Unmarshal(rec.Body.Bytes(), &env)
	states, _ := env.Data.([]any)
	if len(states) != 6 {
		t.Fatalf("states = %d, want 6", len(states))
	}
	rec = doJSON(t, h, "GET", "/api/v1/subjects", "", cookie)
	json.Unmarshal(rec.Body.Bytes(), &env)
	subs, _ := env.Data.([]any)
	if len(subs) != 4 {
		t.Fatalf("subjects = %d, want 4", len(subs))
	}
	// second call is idempotent — still 6/4
	rec = doJSON(t, h, "GET", "/api/v1/states", "", cookie)
	json.Unmarshal(rec.Body.Bytes(), &env)
	if s2, _ := env.Data.([]any); len(s2) != 6 {
		t.Fatalf("states after reseed = %d", len(s2))
	}
}

func TestSettingsRoundTrip(t *testing.T) {
	h, cookie := setupUser(t)
	rec := doJSON(t, h, "GET", "/api/v1/settings", "", cookie)
	d := data(t, rec.Body.String())
	if d["dailyGoalMin"].(float64) != 360 {
		t.Fatalf("default dailyGoalMin = %v", d["dailyGoalMin"])
	}
	rec = doJSON(t, h, "PATCH", "/api/v1/settings",
		`{"examName":"考研","examDate":"2026-12-20","dailyGoalMin":300,"weekStartsOn":7}`, cookie)
	d = data(t, rec.Body.String())
	if d["examDate"] != "2026-12-20" || d["dailyGoalMin"].(float64) != 300 || d["weekStartsOn"].(float64) != 7 {
		t.Fatalf("patched = %v", d)
	}
	// invalid date rejected
	rec = doJSON(t, h, "PATCH", "/api/v1/settings", `{"examDate":"12/20"}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad date status = %d", rec.Code)
	}
	// out-of-range rejected
	rec = doJSON(t, h, "PATCH", "/api/v1/settings", `{"dailyGoalMin":0}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad goal status = %d", rec.Code)
	}
}

func TestDayAndEntries(t *testing.T) {
	h, cookie := setupUser(t)
	today := domain.Today()
	// find a builtin state id
	rec := doJSON(t, h, "GET", "/api/v1/states", "", cookie)
	var env envelope
	json.Unmarshal(rec.Body.Bytes(), &env)
	stateList, _ := env.Data.([]any)
	inspired := stateList[0].(map[string]any)["id"].(string)

	rec = doJSON(t, h, "PATCH", "/api/v1/days/"+today,
		`{"stateId":"`+inspired+`","diary":"今天很充实"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch day: %d %s", rec.Code, rec.Body.String())
	}
	d := data(t, rec.Body.String())
	if d["stateId"] != inspired || d["diary"] != "今天很充实" {
		t.Fatalf("day = %v", d)
	}
	// patch diary only — state preserved (patch semantics)
	rec = doJSON(t, h, "PATCH", "/api/v1/days/"+today, `{"diary":"改日记"}`, cookie)
	d = data(t, rec.Body.String())
	if d["stateId"] != inspired || d["diary"] != "改日记" {
		t.Fatalf("patch semantics broken: %v", d)
	}
	// clear state via null
	rec = doJSON(t, h, "PATCH", "/api/v1/days/"+today, `{"stateId":null}`, cookie)
	d = data(t, rec.Body.String())
	if d["stateId"] != nil {
		t.Fatalf("stateId not cleared: %v", d["stateId"])
	}
	// invalid state rejected
	rec = doJSON(t, h, "PATCH", "/api/v1/days/"+today, `{"stateId":"nope"}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad state status = %d", rec.Code)
	}
	// entries: subject by name (get-or-create) + by id
	rec = doJSON(t, h, "POST", "/api/v1/entries",
		`{"date":"`+today+`","subject":"数学一","durationMin":90,"note":"刷了两套真题\n错题整理"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("create entry: %d %s", rec.Code, rec.Body.String())
	}
	ed := data(t, rec.Body.String())
	if ed["title"] != "刷了两套真题" || ed["durationMin"].(float64) != 90 {
		t.Fatalf("entry = %v", ed)
	}
	eid := ed["id"].(string)
	// day detail aggregates
	rec = doJSON(t, h, "GET", "/api/v1/days/"+today, "", cookie)
	dd := data(t, rec.Body.String())
	if dd["totalMin"].(float64) != 90 {
		t.Fatalf("totalMin = %v", dd["totalMin"])
	}
	entries, _ := dd["entries"].([]any)
	if len(entries) != 1 {
		t.Fatalf("entries = %v", entries)
	}
	// patch entry
	rec = doJSON(t, h, "PATCH", "/api/v1/entries/"+eid, `{"durationMin":120,"note":"补充"}`, cookie)
	ed = data(t, rec.Body.String())
	if ed["durationMin"].(float64) != 120 || ed["title"] != "刷了两套真题" {
		t.Fatalf("patched entry = %v", ed)
	}
	// delete entry → day total back to 0
	rec = doJSON(t, h, "DELETE", "/api/v1/entries/"+eid, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete entry: %d", rec.Code)
	}
	rec = doJSON(t, h, "GET", "/api/v1/days/"+today, "", cookie)
	dd = data(t, rec.Body.String())
	if dd["totalMin"].(float64) != 0 {
		t.Fatalf("totalMin after delete = %v", dd["totalMin"])
	}
}

func TestGoalProgressAndCheckin(t *testing.T) {
	h, cookie := setupUser(t)
	period := domain.PeriodOf(domain.Today())
	// create COUNT goal
	rec := doJSON(t, h, "POST", "/api/v1/goals",
		`{"period":"`+period+`","title":"背单词","type":"COUNT","targetValue":300,"unit":"词"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("create goal: %d %s", rec.Code, rec.Body.String())
	}
	gd := data(t, rec.Body.String())
	gid := gd["id"].(string)
	if gd["percent"].(float64) != 0 || gd["totalValue"].(float64) != 300 {
		t.Fatalf("goal = %v", gd)
	}
	// checkin today
	today := domain.Today()
	rec = doJSON(t, h, "PUT", "/api/v1/goals/"+gid+"/checkins/"+today,
		`{"quantity":50,"note":"一组"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("checkin: %d %s", rec.Code, rec.Body.String())
	}
	// upsert same date → still one checkin, quantity replaced
	rec = doJSON(t, h, "PUT", "/api/v1/goals/"+gid+"/checkins/"+today,
		`{"quantity":80}`, cookie)
	cd := data(t, rec.Body.String())
	if cd["quantity"].(float64) != 80 {
		t.Fatalf("checkin = %v", cd)
	}
	// goals list shows progress 80/300 → 27%
	rec = doJSON(t, h, "GET", "/api/v1/goals?period="+period, "", cookie)
	gm := data(t, rec.Body.String())
	goals, _ := gm["goals"].([]any)
	if len(goals) != 1 {
		t.Fatalf("goals = %v", goals)
	}
	g0 := goals[0].(map[string]any)
	if g0["actualValue"].(float64) != 80 || g0["percent"].(float64) != 27 {
		t.Fatalf("progress = %v", g0)
	}
	// dayMarks has today with total=1 done=1
	dm := gm["dayMarks"].(map[string]any)
	if dm[today].(map[string]any)["total"].(float64) != 1 {
		t.Fatalf("dayMarks = %v", dm)
	}
	// delete checkin
	rec = doJSON(t, h, "DELETE", "/api/v1/goals/"+gid+"/checkins/"+today, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("del checkin: %d", rec.Code)
	}
	// CHECKLIST goal + task complete
	rec = doJSON(t, h, "POST", "/api/v1/goals",
		`{"period":"`+period+`","title":"每日任务","type":"CHECKLIST"}`, cookie)
	cgd := data(t, rec.Body.String())
	cid := cgd["id"].(string)
	rec = doJSON(t, h, "POST", "/api/v1/goals/"+cid+"/tasks",
		`{"title":"做一套卷子","dueDate":"`+today+`"}`, cookie)
	td := data(t, rec.Body.String())
	taskID := td["id"].(string)
	rec = doJSON(t, h, "POST", "/api/v1/tasks/"+taskID+"/complete",
		`{"durationMin":60,"createEntry":true}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("complete: %d %s", rec.Code, rec.Body.String())
	}
	tk := data(t, rec.Body.String())
	if tk["done"] != true || tk["entryId"] == nil {
		t.Fatalf("task = %v", tk)
	}
	// entry was created (source=goal) — day total now 60
	rec = doJSON(t, h, "GET", "/api/v1/days/"+today, "", cookie)
	dd := data(t, rec.Body.String())
	if dd["totalMin"].(float64) != 60 {
		t.Fatalf("totalMin = %v", dd["totalMin"])
	}
	// uncomplete → entry kept, link broken
	rec = doJSON(t, h, "POST", "/api/v1/tasks/"+taskID+"/uncomplete", "", cookie)
	tk = data(t, rec.Body.String())
	if tk["done"] != false || tk["entryId"] != nil {
		t.Fatalf("uncompleted = %v", tk)
	}
	rec = doJSON(t, h, "GET", "/api/v1/days/"+today, "", cookie)
	dd = data(t, rec.Body.String())
	if dd["totalMin"].(float64) != 60 {
		t.Fatalf("entry should be kept, totalMin = %v", dd["totalMin"])
	}
}

func TestCarryOver(t *testing.T) {
	h, cookie := setupUser(t)
	period := domain.PeriodOf(domain.Today())
	next, _ := domain.NextPeriod(period)
	rec := doJSON(t, h, "POST", "/api/v1/goals",
		`{"period":"`+period+`","title":"卷子","type":"CHECKLIST"}`, cookie)
	gd := data(t, rec.Body.String())
	gid := gd["id"].(string)
	due := period + "-15"
	if len(due) != 10 {
		due = period + "-01"
	}
	rec = doJSON(t, h, "POST", "/api/v1/goals/"+gid+"/tasks",
		`{"title":"未完成的","dueDate":"`+due+`"}`, cookie)
	_ = data(t, rec.Body.String())
	// one done task (not carried), one undone (carried)
	rec = doJSON(t, h, "POST", "/api/v1/goals/"+gid+"/tasks",
		`{"title":"已完成的","dueDate":"`+due+`"}`, cookie)
	td2 := data(t, rec.Body.String())
	doneID := td2["id"].(string)
	// 空 body complete：必须 200 且响应是单个 JSON（回归：此前 EOF 路径
	// 会先写 400 再写 200，客户端收到拼接的非法响应）
	rec = doJSON(t, h, "POST", "/api/v1/tasks/"+doneID+"/complete", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("complete empty body = %d %s", rec.Code, rec.Body.String())
	}
	cd := data(t, rec.Body.String())
	if cd["done"] != true {
		t.Fatalf("complete empty body resp = %v", cd)
	}
	// carry over
	rec = doJSON(t, h, "POST", "/api/v1/goals/"+gid+"/carry-over", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("carry: %d %s", rec.Code, rec.Body.String())
	}
	nd := data(t, rec.Body.String())
	if nd["period"] != next || nd["carriedFrom"] != gid {
		t.Fatalf("carried = %v", nd)
	}
	newGid := nd["id"].(string)
	// new goal has only the undone task
	rec = doJSON(t, h, "GET", "/api/v1/goals/"+newGid, "", cookie)
	full := data(t, rec.Body.String())
	tasks, _ := full["tasks"].([]any)
	if len(tasks) != 1 {
		t.Fatalf("carried tasks = %v", tasks)
	}
	t0 := tasks[0].(map[string]any)
	if t0["title"] != "未完成的" {
		t.Fatalf("task = %v", t0)
	}
	// dueDate shifted to next period
	if t0["dueDate"] == nil || !strings.HasPrefix(t0["dueDate"].(string), next) {
		t.Fatalf("dueDate not shifted: %v", t0["dueDate"])
	}
}

func TestSearchStreakStats(t *testing.T) {
	h, cookie := setupUser(t)
	today := domain.Today()
	yesterday, _ := domain.AddDays(today, -1)
	// record two days: yesterday (entry) + today (diary)
	doJSON(t, h, "PATCH", "/api/v1/days/"+yesterday, `{"diary":"昨天"}`, cookie)
	doJSON(t, h, "PATCH", "/api/v1/days/"+today, `{"diary":"今天的日记含关键词"}`, cookie)
	rec := doJSON(t, h, "POST", "/api/v1/entries",
		`{"date":"`+yesterday+`","subject":"政治","durationMin":45,"note":"关键词笔记"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("entry: %s", rec.Body.String())
	}
	// search all
	rec = doJSON(t, h, "GET", "/api/v1/search?q="+urlQuery("关键词"), "", cookie)
	sd := data(t, rec.Body.String())
	if len(sd["days"].([]any)) != 1 || len(sd["entries"].([]any)) != 1 {
		t.Fatalf("search = %v", sd)
	}
	// search diary only
	rec = doJSON(t, h, "GET", "/api/v1/search?q="+urlQuery("关键词")+"&type=diary", "", cookie)
	sd = data(t, rec.Body.String())
	if len(sd["entries"].([]any)) != 0 {
		t.Fatalf("diary-only leaked entries: %v", sd)
	}
	// streak = 2
	rec = doJSON(t, h, "GET", "/api/v1/streak", "", cookie)
	st := data(t, rec.Body.String())
	if st["streak"].(float64) != 2 {
		t.Fatalf("streak = %v", st)
	}
	// month stats
	period := domain.PeriodOf(today)
	rec = doJSON(t, h, "GET", "/api/v1/stats/month?period="+period, "", cookie)
	ms := data(t, rec.Body.String())
	if ms["totalMin"].(float64) != 45 || ms["entryCount"].(float64) != 1 {
		t.Fatalf("stats = %v", ms)
	}
	// heatmap (envelope-wrapped array)
	from := yesterday
	rec = doJSON(t, h, "GET", "/api/v1/stats/heatmap?from="+from+"&to="+today, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("heatmap: %d", rec.Code)
	}
	var env2 envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env2); err != nil {
		t.Fatalf("heatmap envelope: %v", err)
	}
	cells, _ := env2.Data.([]any)
	if len(cells) != 1 {
		t.Fatalf("heatmap cells = %s", rec.Body.String())
	}
}

func urlQuery(s string) string { return url.QueryEscape(s) }

func TestExportImportRoundTrip(t *testing.T) {
	h, cookie := setupUser(t)
	today := domain.Today()
	period := domain.PeriodOf(today)
	// seed some data
	doJSON(t, h, "PATCH", "/api/v1/days/"+today, `{"diary":"导出测试"}`, cookie)
	doJSON(t, h, "POST", "/api/v1/entries",
		`{"date":"`+today+`","subject":"数学一","durationMin":60,"note":"n"}`, cookie)
	doJSON(t, h, "POST", "/api/v1/goals",
		`{"period":"`+period+`","title":"g","type":"COUNT","targetValue":100}`, cookie)
	// export
	rec := doJSON(t, h, "GET", "/api/v1/export", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("export: %d", rec.Code)
	}
	exported := rec.Body.String()
	// wipe-ish: import into same user is idempotent upsert — verify stats
	rec = doJSON(t, h, "POST", "/api/v1/import", exported, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	imp := data(t, rec.Body.String())
	stats := imp["stats"].(map[string]any)
	if stats["entries"].(float64) != 1 || stats["goals"].(float64) != 1 {
		t.Fatalf("import stats = %v", stats)
	}
	// v1 array import
	v1 := `[{"date":"2026-01-05","mood":"inspired","diary":"v1日记","learnings":[{"subject":"英语一","durationMin":30,"note":"单词"}]}]`
	rec = doJSON(t, h, "POST", "/api/v1/import", v1, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("v1 import: %d %s", rec.Code, rec.Body.String())
	}
	rec = doJSON(t, h, "GET", "/api/v1/days/2026-01-05", "", cookie)
	dd := data(t, rec.Body.String())
	if dd["diary"] != "v1日记" || dd["totalMin"].(float64) != 30 {
		t.Fatalf("v1 day = %v", dd)
	}
	// unknown mood fails whole batch
	bad := `[{"date":"2026-01-06","mood":"nonexistent-mood-xyz","diary":"x","learnings":[]}]`
	rec = doJSON(t, h, "POST", "/api/v1/import", bad, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad mood status = %d", rec.Code)
	}
}

func TestDictionaryArchiveUnarchive(t *testing.T) {
	h, cookie := setupUser(t)
	// subject: create → archive → unarchive round-trip
	rec := doJSON(t, h, "POST", "/api/v1/subjects", `{"name":"自定义科","color":"#123456"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("create subject: %d %s", rec.Code, rec.Body.String())
	}
	sid := data(t, rec.Body.String())["id"].(string)
	rec = doJSON(t, h, "POST", "/api/v1/subjects/"+sid+"/archive", "", cookie)
	sd := data(t, rec.Body.String())
	if sd["archivedAt"] == nil {
		t.Fatalf("archivedAt = %v", sd["archivedAt"])
	}
	rec = doJSON(t, h, "POST", "/api/v1/subjects/"+sid+"/unarchive", "", cookie)
	sd = data(t, rec.Body.String())
	if sd["archivedAt"] != nil {
		t.Fatalf("unarchivedAt = %v", sd["archivedAt"])
	}
	// state: create → archive → unarchive round-trip
	rec = doJSON(t, h, "POST", "/api/v1/states", `{"label":"摸鱼","polarity":-1}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("create state: %d %s", rec.Code, rec.Body.String())
	}
	stid := data(t, rec.Body.String())["id"].(string)
	rec = doJSON(t, h, "POST", "/api/v1/states/"+stid+"/archive", "", cookie)
	vd := data(t, rec.Body.String())
	if vd["archivedAt"] == nil {
		t.Fatalf("state archivedAt = %v", vd["archivedAt"])
	}
	rec = doJSON(t, h, "POST", "/api/v1/states/"+stid+"/unarchive", "", cookie)
	vd = data(t, rec.Body.String())
	if vd["archivedAt"] != nil {
		t.Fatalf("state unarchivedAt = %v", vd["archivedAt"])
	}
	// 404 on unknown id
	rec = doJSON(t, h, "POST", "/api/v1/subjects/nope/unarchive", "", cookie)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unarchive missing subject = %d", rec.Code)
	}
}

func TestUserIsolation(t *testing.T) {
	h, cookieA := setupUser(t)
	rec := doJSON(t, h, "POST", "/api/v1/entries",
		`{"date":"2026-01-01","subjectId":"someone-elses-subject","durationMin":10}`, cookieA)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("foreign subject status = %d", rec.Code)
	}
}
