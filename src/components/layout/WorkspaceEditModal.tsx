/* ================================================================
   Fit — WorkspaceEditModal Component
   ================================================================ */

import { useState, useRef } from 'react';
import { useTranslation } from '../../i18n';
import type { Workspace } from '../../types';

interface WorkspaceEditModalProps {
  workspace: Workspace;
  onClose: () => void;
  onSave: (name: string, color: string, icon?: string) => void;
}

const COLOR_PRESETS = [
  { name: 'purple', hex: '#a88bc7', bg: '#362145', text: '#a88bc7' },
  { name: 'teal', hex: '#60b0a2', bg: '#164540', text: '#60b0a2' },
  { name: 'orange', hex: '#d4a857', bg: '#4c3b1a', text: '#d4a857' },
  { name: 'violet', hex: '#c97070', bg: '#4a2323', text: '#c97070' },
  { name: 'blue', hex: '#6fa3c9', bg: '#1b3b52', text: '#6fa3c9' },
  { name: 'green', hex: '#8cb87a', bg: '#27451c', text: '#8cb87a' },
];

export function WorkspaceEditModal({ workspace, onClose, onSave }: WorkspaceEditModalProps) {
  const [name, setName] = useState(workspace.name);
  const [selectedColor, setSelectedColor] = useState(workspace.color || '#60b0a2');
  const [icon, setIcon] = useState<string | undefined>(workspace.icon);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          setIcon(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), selectedColor, icon);
    onClose();
  };

  const matchedPreset = COLOR_PRESETS.find(p => p.hex === selectedColor);
  const previewBg = matchedPreset ? matchedPreset.bg : '#164540';
  const previewText = matchedPreset ? matchedPreset.text : '#60b0a2';

  return (
    <div className="modal-backdrop">
      <div className="edit-modal" onClick={e => e.stopPropagation()}>
        <div className="edit-modal__header">
          <span className="edit-modal__title">{t('workspace.editTitle')}</span>
          <button className="edit-modal__close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="edit-modal__body">
          <div className="edit-modal__field">
            <label className="edit-modal__label">{t('workspace.name')}</label>
            <input
              type="text"
              className="edit-modal__input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('workspace.namePlaceholder')}
              autoFocus
            />
          </div>

          <div className="edit-modal__field">
            <label className="edit-modal__label">{t('workspace.icon')}</label>
            <div className="edit-modal__icon-row">
              <div
                className="edit-modal__icon-preview"
                style={{
                  backgroundColor: previewBg,
                  color: previewText,
                  cursor: 'pointer',
                }}
                onClick={triggerFileInput}
              >
                {icon ? (
                  <img src={icon} alt="project icon" className="edit-modal__icon-img" />
                ) : (
                  <span className="edit-modal__icon-letter">
                    {name ? name.charAt(0).toUpperCase() : 'A'}
                  </span>
                )}
              </div>
              <div className="edit-modal__icon-upload-info" onClick={triggerFileInput}>
                <span className="edit-modal__icon-upload-text">{t('workspace.iconHint')}</span>
                <span className="edit-modal__icon-upload-subtext">{t('workspace.iconSize')}</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
            </div>
          </div>

          <div className="edit-modal__field">
            <label className="edit-modal__label">{t('workspace.color')}</label>
            <div className="edit-modal__colors">
              {COLOR_PRESETS.map(preset => {
                const isActive = selectedColor === preset.hex;
                return (
                  <button
                    key={preset.hex}
                    className={`edit-modal__color-circle ${isActive ? 'edit-modal__color-circle--active' : ''}`}
                    style={{
                      backgroundColor: preset.bg,
                      color: preset.text,
                      boxShadow: isActive ? `0 0 0 2px var(--color-canvas), 0 0 0 4px ${preset.hex}` : undefined,
                    }}
                    onClick={() => setSelectedColor(preset.hex)}
                    title={preset.name}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                      {name ? name.charAt(0).toUpperCase() : 'A'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="edit-modal__footer">
          <button className="edit-modal__btn edit-modal__btn--cancel" onClick={onClose}>
            {t('workspace.cancel')}
          </button>
          <button
            className="edit-modal__btn edit-modal__btn--save"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {t('workspace.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
