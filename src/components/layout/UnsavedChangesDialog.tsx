/* ================================================================
   Fit — UnsavedChangesDialog Component
   ================================================================ */

import { useTranslation } from '../../i18n';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ isOpen, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel} style={{ zIndex: 99999 }}>
      <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="edit-modal__header">
          <span className="edit-modal__title">{t('unsavedDialog.title')}</span>
          <button className="edit-modal__close-btn" onClick={onCancel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="edit-modal__body" style={{ color: 'var(--color-body)', fontSize: 'var(--text-body-sm)', lineHeight: '1.5', paddingBottom: 'var(--space-lg)' }}>
          {t('unsavedDialog.message')}
        </div>

        <div className="edit-modal__footer" style={{ gap: 'var(--space-sm)' }}>
          <button className="edit-modal__btn edit-modal__btn--discard" onClick={onDiscard}>
            {t('unsavedDialog.discard')}
          </button>
          <div style={{ flex: 1 }} />
          <button className="edit-modal__btn edit-modal__btn--cancel" onClick={onCancel}>
            {t('unsavedDialog.cancel')}
          </button>
          <button className="edit-modal__btn edit-modal__btn--save" onClick={onSave}>
            {t('unsavedDialog.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
