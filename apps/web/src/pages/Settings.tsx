import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RefreshCw, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { archiveState, unarchiveSubject } from '../lib/api';
import { logout } from '../lib/auth';
import { useStates, useSubjects, invalidateAll } from '../lib/queries';
import StateEditModal from '../components/StateEditModal';
import SubjectEditModal from '../components/SubjectEditModal';
import { QueryError, QueryLoading } from '../components/QueryState';
import { useDataIO } from '../lib/useDataIO';
import { APP_VERSION } from '../lib/version';
import { showToast } from '../lib/toast';
import { askConfirm } from '../lib/confirm';
import { THEME_PICKER_ITEMS, getThemeMeta } from '../lib/theme';
import type { JournalState, SettingsPatch, Subject } from '../lib/types/api';

/** 每日学习目标预设（分钟）：4h/5h/6h/8h/10h，界外值走自定义输入 */
const GOAL_PRESETS = [240, 300, 360, 480, 600];

function SetRow({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="nb-set-row">
      <div className="nb-set-label">
        <div className="nb-set-title">{title}</div>
        <div className="nb-set-desc">{desc}</div>
      </div>
      <div className="nb-set-body">{children}</div>
    </div>
  );
}

function polarityLabel(p: number): string {
  return p === 1 ? '积极' : p === -1 ? '消极' : '中性';
}

export default function Settings() {
  const qc = useQueryClient();
  const { theme, setTheme, dailyGoalMin, setDailyGoalMin, user, settings, patchSettings } = useApp();
  const [showStateEdit, setShowStateEdit] = useState(false);
  const [editingState, setEditingState] = useState<JournalState | null>(null);
  const [showSubjectEdit, setShowSubjectEdit] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [customGoalMin, setCustomGoalMin] = useState(String(dailyGoalMin));
  const {
    importStatus,
    migrating,
    handleExport,
    triggerImport,
    handleFileChange,
    handleMigrateLocal,
    fileInputRef,
  } = useDataIO();

  const { data: states, isPending, error, refetch } = useStates();
  const { data: subjects } = useSubjects();
  const customStates = (states ?? []).filter((s) => s.builtinKey == null && s.archivedAt == null);
  const builtinStates = (states ?? []).filter((s) => s.builtinKey != null && s.archivedAt == null);
  const activeSubjects = (subjects ?? []).filter((s) => s.archivedAt == null);
  const archivedSubjects = (subjects ?? []).filter((s) => s.archivedAt != null);

  useEffect(() => {
    setCustomGoalMin(String(dailyGoalMin));
  }, [dailyGoalMin]);

  const commitCustomGoal = () => {
    const min = parseInt(customGoalMin, 10);
    if (Number.isFinite(min) && min !== dailyGoalMin) setDailyGoalMin(min);
    else setCustomGoalMin(String(dailyGoalMin));
  };

  const handleEditState = (state: JournalState) => {
    setEditingState(state);
    setShowStateEdit(true);
  };

  const handleEditSubject = (subject: Subject | null) => {
    setEditingSubject(subject);
    setShowSubjectEdit(true);
  };

  const handleRestoreSubject = async (subject: Subject) => {
    try {
      await unarchiveSubject(subject.id);
      invalidateAll(qc);
      showToast(`已恢复「${subject.name}」`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '恢复失败');
    }
  };

  const handleDeleteState = async (state: JournalState) => {
    const confirmed = await askConfirm({
      title: '删除状态',
      message: `确定要删除「${state.label}」吗？历史记录仍会保留该状态标记。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await archiveState(state.id);
      invalidateAll(qc);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleLogout = async () => {
    const confirmed = await askConfirm({
      title: '退出登录',
      message: '退出后需要重新登录才能查看手帐。',
      confirmLabel: '退出',
    });
    if (!confirmed) return;
    await logout();
  };

  return (
    <div className="nb-book nb-single">
      <div className="nb-page single nb-gridbg">
        <div className="nb-date">
          <span className="nb-date-num">设置</span>
          <span className="nb-date-meta">考研目标、外观与数据</span>
        </div>

        {/* 考研目标：名称 + 初试日期（失焦保存） */}
        <ExamGoalRow settings={settings} patchSettings={patchSettings} />

        {/* 每日学习目标 */}
        <SetRow title="每日学习目标" desc="日历横线与合计以此为满格">
          <div className="nb-set-chips">
            {GOAL_PRESETS.map((min) => (
              <button
                key={min}
                type="button"
                className={`nb-chip${dailyGoalMin === min ? ' on' : ''}`}
                onClick={() => setDailyGoalMin(min)}
              >
                {min / 60}h
              </button>
            ))}
            <span className="nb-set-inline">
              或自定义
              <input
                className="nb-field num nb-set-num"
                type="number"
                min={15}
                max={960}
                value={customGoalMin}
                onChange={(e) => setCustomGoalMin(e.target.value)}
                onBlur={commitCustomGoal}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                aria-label="自定义每日学习目标（分钟）"
              />
              分钟
            </span>
          </div>
        </SetRow>

        {/* 科目预设：chips 点按进编辑弹层；已归档可恢复 */}
        <SetRow title="科目预设" desc="记一条时作为快捷选项">
          {subjects === undefined ? null : (
            <>
              <div className="nb-set-chips">
                {activeSubjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="nb-chip"
                    style={{ borderColor: s.color, color: s.color }}
                    onClick={() => handleEditSubject(s)}
                  >
                    {s.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="nb-chip nb-chip-dash"
                  onClick={() => handleEditSubject(null)}
                >
                  <Plus size={12} strokeWidth={2} /> 添加
                </button>
              </div>
              {archivedSubjects.length > 0 && (
                <div className="nb-set-archived">
                  <div className="nb-set-archived-title">已归档（{archivedSubjects.length}）</div>
                  {archivedSubjects.map((s) => (
                    <div key={s.id} className="nb-set-state">
                      <span className="nb-swatch" style={{ background: s.color, opacity: 0.45 }} />
                      <span className="nb-set-state-name" style={{ opacity: 0.6 }}>
                        {s.name}
                      </span>
                      <span className="nb-set-state-ops">
                        <button
                          type="button"
                          className="nb-set-restore"
                          onClick={() => void handleRestoreSubject(s)}
                        >
                          恢复
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </SetRow>

        {/* 外观 */}
        <SetRow title="外观" desc="格纸为本版默认">
          <div className="nb-set-chips">
            {THEME_PICKER_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nb-chip${theme === item.id ? ' on' : ''}`}
                onClick={() => setTheme(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <p className="nb-set-note">
            主题保存在账号、跨设备同步（当前：{getThemeMeta(theme)?.name ?? theme}）。
          </p>
        </SetRow>

        {/* 自定义状态 */}
        <SetRow title="自定义状态" desc="会以文字标注在日历上">
          {builtinStates.length > 0 && (
            <div className="nb-set-chips nb-set-builtin">
              {builtinStates.map((s) => (
                <span key={s.id} className="nb-chip nb-chip-static">
                  {s.label}
                </span>
              ))}
            </div>
          )}
          {isPending && !states ? (
            <QueryLoading />
          ) : error && !states ? (
            <QueryError message={error.message} onRetry={() => void refetch()} />
          ) : customStates.length === 0 ? (
            <p className="nb-empty-hint">还没有自定义状态，点击「+ 添加状态」创建属于自己的状态类型</p>
          ) : (
            <div className="nb-set-states">
              {customStates.map((state) => (
                <div key={state.id} className="nb-set-state">
                  <span className="nb-swatch" style={{ background: state.color }} />
                  <span className="nb-set-state-name">{state.label}</span>
                  <span className="nb-set-state-meta nb-mono">
                    {polarityLabel(state.polarity)} · {state.color}
                  </span>
                  <span className="nb-set-state-ops">
                    <button
                      type="button"
                      className="nb-icon-btn"
                      onClick={() => handleEditState(state)}
                      aria-label={`编辑 ${state.label}`}
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="nb-icon-btn nb-icon-btn-danger"
                      onClick={() => void handleDeleteState(state)}
                      aria-label={`删除 ${state.label}`}
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="nb-chip nb-chip-dash nb-set-add"
            onClick={() => {
              setEditingState(null);
              setShowStateEdit(true);
            }}
          >
            <Plus size={12} strokeWidth={2} /> 添加状态
          </button>
        </SetRow>

        {/* 数据管理 */}
        <SetRow title="数据管理" desc="JSON 兼容 v1 数组 / v2 含自定义心情">
          <div className="nb-set-chips">
            <button type="button" className="nb-btn" onClick={() => void handleExport()}>
              导出 JSON
            </button>
            <button
              type="button"
              className="nb-btn"
              onClick={triggerImport}
              style={
                importStatus === 'success'
                  ? { borderColor: 'var(--success)', color: 'var(--success)' }
                  : importStatus === 'error'
                    ? { borderColor: 'var(--danger)', color: 'var(--danger)' }
                    : undefined
              }
            >
              {importStatus === 'success' ? '导入成功' : importStatus === 'error' ? '导入失败' : '导入 JSON'}
            </button>
            <button
              type="button"
              className="nb-btn"
              onClick={() => void handleMigrateLocal()}
              disabled={migrating}
            >
              <RefreshCw size={13} strokeWidth={1.75} className={migrating ? 'animate-spin' : ''} />
              {migrating ? '迁移中…' : 'IndexedDB → 服务器'}
            </button>
          </div>
          <p className="nb-set-note">
            数据保存在手帐服务器。「迁移本地旧数据」把本浏览器 IndexedDB 中的第一期历史数据合并上传一次，幂等可重复。
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />
        </SetRow>

        {/* 账号与版本 */}
        <div className="nb-set-foot">
          <span className="nb-mono">
            v{APP_VERSION} · {user?.username ?? ''}
          </span>
          <button type="button" className="nb-btn r nb-set-logout" onClick={() => void handleLogout()}>
            <LogOut size={13} strokeWidth={1.75} /> 退出登录
          </button>
        </div>
      </div>

      {showStateEdit && (
        <StateEditModal
          onClose={() => {
            setShowStateEdit(false);
            setEditingState(null);
          }}
          editState={editingState}
        />
      )}

      {showSubjectEdit && (
        <SubjectEditModal
          onClose={() => {
            setShowSubjectEdit(false);
            setEditingSubject(null);
          }}
          editSubject={editingSubject}
        />
      )}
    </div>
  );
}

/** 考研目标行：名称 + 初试日期，改动失焦即 PATCH settings */
function ExamGoalRow({
  settings,
  patchSettings,
}: {
  settings: ReturnType<typeof useApp>['settings'];
  patchSettings: (patch: SettingsPatch) => void;
}) {
  const [name, setName] = useState(settings?.examName ?? '');
  const [date, setDate] = useState(settings?.examDate ?? '');

  useEffect(() => {
    setName(settings?.examName ?? '');
    setDate(settings?.examDate ?? '');
  }, [settings?.examName, settings?.examDate]);

  const commitName = () => {
    const v = name.trim();
    if (v !== (settings?.examName ?? '')) patchSettings({ examName: v });
  };
  const commitDate = () => {
    const v = date || null;
    if (v !== (settings?.examDate ?? null)) patchSettings({ examDate: v });
  };

  return (
    <SetRow title="考研目标" desc="首页 D-xxx 印章据此计算">
      <div className="nb-set-exam">
        <div>
          <label className="nb-flab">名称</label>
          <input
            className="nb-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            placeholder="考研"
          />
        </div>
        <div>
          <label className="nb-flab">初试日期</label>
          <input
            className="nb-field num"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={commitDate}
          />
        </div>
      </div>
    </SetRow>
  );
}
