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

import { Chip, IconButton, Stack, Tooltip, Typography } from '@wso2/oxygen-ui';
import { ChevronDown, ChevronRight, Copy } from '@wso2/oxygen-ui-icons-react';
import type { JSX } from 'react';
import type { LogRow } from '../../api/logs';
import { DISPLAY_FIELDS, copyLog, formatValue, levelColor } from '../../utils/logs';

export default function LogEntry({ log, expanded, onToggle }: { log: LogRow; expanded: boolean; onToggle: () => void }): JSX.Element {
  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        onClick={onToggle}
        sx={{
          fontFamily: 'monospace',
          fontSize: 12,
          px: 0.5,
          py: 0.25,
          cursor: 'pointer',
          borderRadius: 1,
          minHeight: 32,
          '&:hover': { bgcolor: 'action.hover' },
          '&:hover .log-actions': { visibility: 'visible' },
        }}>
        <IconButton size="small" aria-label={expanded ? 'Collapse log entry' : 'Expand log entry'} sx={{ p: 0, mr: 0.5 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </IconButton>
        <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, color: levelColor(log.level).text, whiteSpace: 'nowrap', mr: 1 }}>
          {new Date(log.timestamp).toLocaleString()}
        </Typography>
        <Chip
          label={log.level}
          size="small"
          sx={{
            fontFamily: 'monospace',
            fontSize: 10,
            height: 18,
            mr: 1,
            bgcolor: levelColor(log.level).bg,
            color: levelColor(log.level).text,
            fontWeight: 700,
          }}
        />
        {log.serviceType && (
          <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', mr: 1 }}>
            {log.serviceType}
          </Typography>
        )}
        <Typography
          component="span"
          sx={{
            fontFamily: 'monospace',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}>
          {log.logLine}
        </Typography>
        <Stack direction="row" className="log-actions" sx={{ visibility: 'hidden', ml: 1, flexShrink: 0 }}>
          <Tooltip title="Copy">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                copyLog(log);
              }}>
              <Copy size={14} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      {expanded && (
        <Stack
          sx={{
            pl: 5,
            pb: 1,
            fontFamily: 'monospace',
            fontSize: 12,
            bgcolor: 'background.default',
            borderRadius: 1,
            mx: 0.5,
            mb: 0.5,
          }}>
          {DISPLAY_FIELDS.map(({ key, label }) => {
            const val = formatValue(log[key]);
            if (!val) return null;
            return (
              <Stack key={key} direction="row" sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 0.5, gap: 2 }}>
                <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, minWidth: 160, flexShrink: 0 }}>
                  {label}
                </Typography>
                <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {key === 'timestamp' ? new Date(val).toLocaleString() : val}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
    </>
  );
}
