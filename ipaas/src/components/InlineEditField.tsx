/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { CircularProgress, IconButton, TextField, Tooltip } from '@wso2/oxygen-ui';
import { Check, Pencil } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useRef, useState, type JSX } from 'react';

export interface InlineEditFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  editable: boolean;
  validate?: (value: string) => string;
  onSave: (value: string) => Promise<void>;
}

/** An editable field: type straight into it, then save with the done icon, Enter, or by clicking away. */
export default function InlineEditField({ label, value, placeholder, multiline, editable, validate, onSave }: InlineEditFieldProps): JSX.Element {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dirty = draft.trim() !== value.trim();

  // Adopt an external value change, but never over an edit in flight: a rejected save leaves the
  // field blurred and dirty, and resyncing there would discard what the user typed.
  useEffect(() => {
    if (!focused && !dirty) setDraft(value);
  }, [value, focused, dirty]);

  const error = dirty ? (validate?.(draft) ?? '') : '';

  const commit = async () => {
    if (saving || !dirty || error) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
    } catch {
      // Failure is surfaced by the caller's alert; keep the edit so it can be retried.
    } finally {
      setSaving(false);
    }
  };

  return (
    <TextField
      inputRef={inputRef}
      label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={async () => {
        await commit();
        setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          void commit();
        } else if (e.key === 'Escape') {
          setDraft(value);
        }
      }}
      fullWidth
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      error={!!error}
      helperText={error || ' '}
      slotProps={{
        input: {
          readOnly: !editable,
          endAdornment: !editable ? undefined : saving ? (
            <CircularProgress size={16} />
          ) : dirty ? (
            <Tooltip title={error || `Save ${label.toLowerCase()}`}>
              <span>
                {/* Mouse-down default is suppressed so the field keeps focus and blur doesn't save first. */}
                <IconButton size="small" edge="end" aria-label={`Save ${label.toLowerCase()}`} disabled={!!error} onMouseDown={(e) => e.preventDefault()} onClick={() => void commit()}>
                  <Check size={16} />
                </IconButton>
              </span>
            </Tooltip>
          ) : focused ? null : (
            <Tooltip title={`Edit ${label.toLowerCase()}`}>
              <IconButton size="small" edge="end" aria-label={`Edit ${label.toLowerCase()}`} onClick={() => inputRef.current?.focus()}>
                <Pencil size={16} />
              </IconButton>
            </Tooltip>
          ),
        },
      }}
    />
  );
}
