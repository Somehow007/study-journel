import { useState } from 'react';
import { X } from 'lucide-react';
import { changePassword } from '../lib/auth';
import { showToast } from '../lib/toast';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

interface PasswordEditModalProps {
  onClose: () => void;
}

function CloseButton() {
  const close = useSheetClose();
  return (
    <Pressable
      variant="icon"
      onClick={close}
      className="absolute right-3 top-3 flex items-center justify-center text-[var(--ink-faint)]"
      aria-label="关闭"
    >
      <X size={18} />
    </Pressable>
  );
}

function SheetCancel() {
  const close = useSheetClose();
  return (
    <Pressable variant="pill" onClick={close} className="nb-btn">
      取消
    </Pressable>
  );
}

export default function PasswordEditModal({ onClose }: PasswordEditModalProps) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!oldPw) {
      setError('请输入原密码');
      return;
    }
    if ([...newPw].length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    if (newPw !== confirmPw) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPw === oldPw) {
      setError('新密码不能与原密码相同');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(oldPw, newPw);
      showToast('密码已更新，其他设备已退出');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet title="修改密码" onClose={onClose}>
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <CloseButton />
        <div className="nb-dialog-h mb-5 pr-8">修改密码</div>

        <label className="nb-flab">原密码</label>
        <input
          type="password"
          value={oldPw}
          onChange={(e) => {
            setOldPw(e.target.value);
            setError('');
          }}
          autoComplete="current-password"
          className="nb-field mb-4"
          autoFocus
        />

        <label className="nb-flab">新密码</label>
        <input
          type="password"
          value={newPw}
          onChange={(e) => {
            setNewPw(e.target.value);
            setError('');
          }}
          autoComplete="new-password"
          className="nb-field mb-4"
        />

        <label className="nb-flab">确认新密码</label>
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => {
            setConfirmPw(e.target.value);
            setError('');
          }}
          autoComplete="new-password"
          className="nb-field mb-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave();
          }}
        />
        {error && <p className="mb-4 text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
        <p className="mb-5 font-[family-name:var(--font-title)] text-[12px]" style={{ color: 'var(--ink-faint)' }}>
          新密码至少 8 位；修改成功后其他设备的登录会立即失效。
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <SheetCancel />
          <button type="button" className="nb-btn p" onClick={() => void handleSave()} disabled={submitting}>
            {submitting ? '提交中…' : '确认修改'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
