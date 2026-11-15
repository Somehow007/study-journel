import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { exportAllData, importData } from './api';
import { readLegacyIdb } from './legacyIdb';
import { formatDate } from './dateUtils';
import { showToast } from './toast';
import { askConfirm } from './confirm';
import { invalidateAll } from './queries';
import type { ImportResult } from './types/api';

/**
 * 共享的数据导出/导入/旧库迁移逻辑（Sidebar 和 Settings 共用）。
 *
 * v3：导出/导入都走 Go 服务端（/api/v1/export、/import，幂等 upsert 合并）；
 * 「迁移本地旧数据」读取浏览器 IndexedDB（StudyJournalDB）中的第一期数据，
 * 按 v2 格式（records + customMoods）一次性上传，导入后失效全部查询。
 */
export function useDataIO() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [migrating, setMigrating] = useState(false);

  const flashStatus = (status: 'success' | 'error') => {
    setImportStatus(status);
    setTimeout(() => setImportStatus('idle'), 3000);
  };

  const summarizeImport = (result: ImportResult): string => {
    const s = result.stats;
    const parts = [
      s.days ? `${s.days} 天` : '',
      s.entries ? `${s.entries} 条学习` : '',
      s.minutes ? `${Math.round((s.minutes / 60) * 10) / 10} 小时` : '',
      s.subjects ? `${s.subjects} 个科目` : '',
      s.states ? `${s.states} 种状态` : '',
      s.goals ? `${s.goals} 个目标` : '',
      s.tasks ? `${s.tasks} 个任务` : '',
      s.checkins ? `${s.checkins} 次打卡` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('、') : '无新增数据';
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `study-journey-${formatDate(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出失败');
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data: unknown = JSON.parse(text);

      const looksValid =
        Array.isArray(data) ||
        (typeof data === 'object' && data !== null);
      if (!looksValid) {
        throw new Error('数据格式错误');
      }

      const confirmed = await askConfirm({
        title: '导入数据',
        message:
          '即将把文件内容合并导入到服务器。同一天/同一记录会以文件为准合并，其余数据不受影响。',
        confirmLabel: '导入',
      });
      if (!confirmed) return;

      const result = await importData(data);
      invalidateAll(qc);
      flashStatus('success');
      showToast(`导入完成：${summarizeImport(result)}`, 'success');
    } catch (err) {
      console.error('Import failed:', err);
      flashStatus('error');
      showToast(err instanceof Error ? err.message : '导入失败，请检查文件格式');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /** 一次性迁移：把本浏览器 IndexedDB 中的旧数据合并上传到服务端（幂等，可重复执行） */
  const handleMigrateLocal = async () => {
    setMigrating(true);
    try {
      const local = await readLegacyIdb();
      if (local.records.length === 0 && local.customMoods.length === 0) {
        showToast('浏览器本地没有可迁移的数据');
        return;
      }
      const confirmed = await askConfirm({
        title: '迁移本地数据',
        message:
          `浏览器本地有 ${local.records.length} 条记录、${local.customMoods.length} 个自定义心情。\n` +
          '将合并上传到服务器（同一天/同一心情以本地版本为准，重复执行不会产生重复数据）。',
        confirmLabel: '开始迁移',
      });
      if (!confirmed) return;

      const result = await importData({
        records: local.records,
        customMoods: local.customMoods,
      });
      invalidateAll(qc);
      flashStatus('success');
      showToast(`迁移完成：${summarizeImport(result)}已同步到服务器`, 'success');
    } catch (err) {
      console.error('Local migration failed:', err);
      flashStatus('error');
      showToast(err instanceof Error ? err.message : '迁移失败');
    } finally {
      setMigrating(false);
    }
  };

  return {
    fileInputRef,
    importStatus,
    migrating,
    handleExport,
    triggerImport,
    handleFileChange,
    handleMigrateLocal,
  };
}
