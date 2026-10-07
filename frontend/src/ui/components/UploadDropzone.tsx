import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ACCEPT } from '../../core/parsers/files';
import { useT } from '../i18n';

export interface UploadDropzoneProps {
  onFile: (f: File) => void;
  disabled?: boolean;
  error?: string;
}

export function UploadDropzone({ onFile, disabled, error }: UploadDropzoneProps) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f && !disabled) onFile(f);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.current?.click();
    }
  };
  return (
    <div
      className={`dropzone${over ? ' over' : ''}${disabled ? ' disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-describedby="drop-hint"
      data-testid="dropzone"
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={key}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <strong>{over ? t.dropActive : t.dropTitle}</strong>
      <span id="drop-hint" className="muted">{t.dropHint}</span>
      {error && <span role="alert" className="error-text">{error}</span>}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        data-testid="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
