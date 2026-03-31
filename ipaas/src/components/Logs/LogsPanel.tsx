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

import { Button, CircularProgress, Stack, Typography } from '@wso2/oxygen-ui';
import { RefreshCw, ScrollText } from '@wso2/oxygen-ui-icons-react';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { LogRow } from '../../api/logs';
import LogEntry from './LogEntry';

interface LogsPanelProps {
  isLoading: boolean;
  error: unknown;
  logs: LogRow[];
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  /** Called when the user clicks Retry (on error) or Refresh (on empty). */
  onRefetch: () => void;
  /** Called when the scroll sentinel enters the viewport to load the next page. */
  onFetchNextPage: () => void;
  /** Called when the user clicks "Clear filters" on the empty state. */
  onClearFilters: () => void;
}

export default function LogsPanel({ isLoading, error, logs, hasNextPage, isFetchingNextPage, onRefetch, onFetchNextPage, onClearFilters }: LogsPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleScroll = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight + 200) onFetchNextPage();
  }, [hasNextPage, isFetchingNextPage, onFetchNextPage]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (isLoading) {
    return <CircularProgress size={28} sx={{ display: 'block', mx: 'auto', my: 6 }} />;
  }

  if (error) {
    return (
      <Stack alignItems="center" gap={2} sx={{ py: 6 }}>
        <Typography color="error" textAlign="center">
          Failed to fetch logs: {(error as Error).message ?? 'Service unavailable'}
        </Typography>
        <Button variant="contained" startIcon={<RefreshCw size={16} />} onClick={onRefetch}>
          Retry
        </Button>
      </Stack>
    );
  }

  if (logs.length === 0) {
    return (
      <Stack alignItems="center" gap={2} sx={{ py: 8 }}>
        <ScrollText size={48} style={{ opacity: 0.3 }} />
        <Typography variant="h3" textAlign="center">
          No logs found
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 420 }}>
          No log entries matched your current filters for the selected time range. Try widening the time range, clearing some filters, or refreshing.
        </Typography>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" size="small" startIcon={<RefreshCw size={14} />} onClick={onRefetch}>
            Refresh
          </Button>
          <Button variant="text" size="small" onClick={onClearFilters}>
            Clear filters
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack
      ref={scrollContainerRef}
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'auto',
        maxHeight: 'calc(100vh - 300px)',
        padding: '16px',
      }}>
      {logs.map((log, index) => {
        const key = `${index}-${log.timestamp}-${log.logLine.slice(0, 50)}`;
        return <LogEntry key={key} log={log} expanded={expanded.has(key)} onToggle={() => toggle(key)} />;
      })}
      <div ref={sentinelRef} />
      {isFetchingNextPage && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 1 }} />}
      {!hasNextPage && (
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 1 }}>
          End of logs
        </Typography>
      )}
    </Stack>
  );
}
