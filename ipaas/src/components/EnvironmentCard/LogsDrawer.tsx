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

import { Box, Button, Checkbox, Drawer, FormControlLabel, IconButton, InputAdornment, OutlinedInput, Stack, Typography } from '@wso2/oxygen-ui';
import { RefreshCcw, Search, X } from '@wso2/oxygen-ui-icons-react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import CenteredLoader from '../CenteredLoader';
import { useExecutionLogs } from '../../api/queries';

interface LogsDrawerProps {
  open: boolean;
  onClose: () => void;
  executionId: string;
  componentId: string;
  deploymentTrackId: string;
  environmentId: string;
}

function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} style={{ background: '#fde68a', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

const drawerSx = {
  '& .MuiDrawer-paper': {
    width: 680,
    position: 'fixed',
    top: 64,
    height: 'calc(100% - 64px)',
    display: 'flex',
    flexDirection: 'column',
  },
} as const;

export default function LogsDrawer({ open, onClose, executionId, componentId, deploymentTrackId, environmentId }: LogsDrawerProps) {
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading } = useExecutionLogs(componentId, deploymentTrackId, executionId, environmentId, open && !!executionId);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState(false);

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    onClose();
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['executionLogs', componentId, deploymentTrackId, executionId, environmentId] });
  };

  const filtered = useMemo(() => {
    if (!filterMode || !search.trim()) return logs;
    const lower = search.toLowerCase();
    return logs.filter((e) => {
      const line = `${e.timestamp} ${e.message}`.toLowerCase();
      return line.includes(lower);
    });
  }, [logs, search, filterMode]);

  return (
    <Drawer anchor="right" open={open} onClose={handleClose} variant="temporary" sx={drawerSx}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="h5">Latest Logs</Typography>
        <IconButton size="small" aria-label="close" onClick={handleClose}>
          <X size={16} />
        </IconButton>
      </Stack>

      {/* Search + filter */}
      <Box sx={{ px: 2, pt: 2, pb: 1, flexShrink: 0 }}>
        <OutlinedInput
          fullWidth
          size="small"
          placeholder="Enter keyword to highlight logs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startAdornment={
            <InputAdornment position="start">
              <Search size={16} />
            </InputAdornment>
          }
          endAdornment={
            search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')} edge="end">
                  <X size={13} />
                </IconButton>
              </InputAdornment>
            ) : null
          }
          sx={{
            bgcolor: 'action.hover',
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid', borderColor: 'primary.main' },
            fontSize: '0.875rem',
          }}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
          <FormControlLabel control={<Checkbox size="small" checked={filterMode} onChange={(e) => setFilterMode(e.target.checked)} />} label={<Typography variant="body2">Filter logs with this search term</Typography>} sx={{ m: 0 }} />
          <Button size="small" variant="text" startIcon={<RefreshCcw size={14} />} onClick={handleRefresh} disabled={isLoading}>
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Log content */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1 }}>
        {isLoading ? (
<<<<<<< Updated upstream
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={32} color="primary" />
          </Box>
=======
          <CenteredLoader />
>>>>>>> Stashed changes
        ) : !logs || logs.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              No logs available for this execution.
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No log lines match the search term.
            </Typography>
          </Box>
        ) : (
          <Box component="pre" sx={{ m: 0, fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {filtered.map((entry, i) => {
              const line = entry.timestamp ? `${entry.timestamp} ${entry.message}` : entry.message;
              return (
                <Box key={i} component="span" sx={{ display: 'block' }}>
                  {search && !filterMode ? highlightText(line, search) : line}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
