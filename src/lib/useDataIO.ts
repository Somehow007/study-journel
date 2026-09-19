import { useState, useRef } from 'react';
import { exportAllData, importData } from './api';
import { exportAllData as exportLocalData } from './db';
import { formatDate } from './dateUtils';
import { showToast } from './toast';
import { askConfirm } from './confirm';

/**
 * 共享的数据导出/导入逻辑（Sidebar 和 Settings 共用）。
 *
 * 第二期后端化后：导出/导入都走服务端（/api/journal/export、/import，按日期幂等 upsert）；
 * 另提供「迁移本地数据」入口：把本浏览器 IndexedDB 里的旧数据（db.ts 保留读取能力）
 * 一次性合并上传到服务端，完成第一期 → 第二期的历史数据迁移。
 */
export function useDataIO() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [migrating, setMigrating] = useState(false);

  const flashStatus = (status: 'success' | 'error') => {
    setImportStatus(status);
    setTimeout(() => setImportStatus('idle'), 3000);
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `study-journal-${formatDate(new Date())}.json`;
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
      const data = JSON.parse(text);

      const records = Array.isArray(data) ? data : data.records;
      if (!records || !Array.isArray(records)) {
        throw new Error('数据格式错误');
      }

      for (const item of records) {
        if (!item.date || typeof item.date !== 'string') {
          throw new Error('数据格式错误：缺少 date 字段');
        }
      }

      const confirmed = await askConfirm({
        title: '导入数据',
        message: `即将导入 ${records.length} 条记录。同一天已有记录会被合并覆盖，其余日期不受影响。`,
        confirmLabel: '导入',
      });
      if (!confirmed) return;

      const result = await importData(data);
      flashStatus('success');
      showToast(`导入完成：${result.recordsImported} 条记录、${result.moodsImported} 个自定义心情`, 'success');
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
      const local = await exportLocalData();
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

      const result = await importData(local);
      flashStatus('success');
      showToast(`迁移完成：${result.recordsImported} 条记录、${result.moodsImported} 个自定义心情已同步到服务器`, 'success');
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
