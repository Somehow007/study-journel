import { useState, useRef } from 'react';
import { exportAllData, importData } from './db';
import { formatDate } from './dateUtils';

/** 共享的数据导出/导入逻辑（Sidebar 和 Settings 共用） */
export function useDataIO() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleExport = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-journal-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

      const confirmed = window.confirm(
        `即将导入 ${records.length} 条记录。现有数据将被覆盖，确认继续？`
      );
      if (!confirmed) return;

      await importData(data);
      // useLiveQuery 会自动响应数据变化，无需刷新页面
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 3000);
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
      alert(err instanceof Error ? err.message : '导入失败，请检查文件格式');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return { fileInputRef, importStatus, handleExport, triggerImport, handleFileChange };
}
