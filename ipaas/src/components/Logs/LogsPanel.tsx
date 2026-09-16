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

import { Box, Button, CircularProgress, Stack, Typography } from '@wso2/oxygen-ui';
import { AlertTriangle, RefreshCw, ScrollText } from '@wso2/oxygen-ui-icons-react';
import { Fragment, useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

interface LogsPanelProps<T> {
  isLoading: boolean;
  error: unknown;
  /** Rows to render. */
  items: T[];
  /** Stable key per row (also used to track which rows are expanded). */
  getKey: (item: T, index: number) => string;
  /** Renders a single row; `toggle` flips its expanded state, `expanded` reflects it. */
  renderRow: (item: T, expanded: boolean, toggle: () => void) => ReactNode;
  /** Called when the user clicks Retry (on error) or Refresh (on empty). */
  onRefetch: () => void;
  /** Infinite-scroll pagination — omit `onFetchNextPage` for a single-shot (non-paginated) panel. */
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage?: () => void;
  /** Shows a "Clear filters" action on the empty state when provided. */
  onClearFilters?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Friendly error copy shown instead of the raw backend error. */
  errorTitle?: string;
  errorDescription?: string;
}

/**
 * The shared infinite log panel: loading / error / empty states, an auto-loading scroll
 * container, and per-row expand tracking. Row rendering is delegated via `renderRow`, so it
 * serves runtime logs (LogEntry), audit logs (AuditLogRow), and any future log-like list.
 */
export default function LogsPanel<T>({
  isLoading,
  error,
  items,
  getKey,
  renderRow,
  onRefetch,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
  onClearFilters,
  emptyTitle = 'No logs found',
  emptyDescription = 'No log entries matched your current filters for the selected time range. Try widening the time range, clearing some filters, or refreshing.',
  errorTitle = "Couldn't load logs",
  errorDescription = 'The logging service is temporarily unavailable. Please try again in a moment.',
}: LogsPanelProps<T>): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const paginated = !!onFetchNextPage;

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleScroll = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || !onFetchNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight + 200) onFetchNextPage();
  }, [hasNextPage, isFetchingNextPage, onFetchNextPage]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !paginated) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll, paginated]);

  useEffect(() => {
    if (paginated && items.length === 0 && hasNextPage && !isFetchingNextPage) onFetchNextPage?.();
  }, [paginated, items.length, hasNextPage, isFetchingNextPage, onFetchNextPage]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return (
      <Stack alignItems="center" gap={1.5} sx={{ py: 8 }}>
        <AlertTriangle size={48} style={{ opacity: 0.35 }} />
        <Typography variant="h3" textAlign="center">
          {errorTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 420 }}>
          {errorDescription}
        </Typography>
        <Button variant="outlined" size="small" startIcon={<RefreshCw size={14} />} onClick={onRefetch} sx={{ mt: 0.5 }}>
          Retry
        </Button>
      </Stack>
    );
  }

  if (items.length === 0) {
    return (
      <Stack alignItems="center" gap={2} sx={{ py: 8 }}>
        <ScrollText size={48} style={{ opacity: 0.3 }} />
        <Typography variant="h3" textAlign="center">
          {emptyTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 420 }}>
          {emptyDescription}
        </Typography>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" size="small" startIcon={<RefreshCw size={14} />} onClick={onRefetch}>
            Refresh
          </Button>
          {onClearFilters && (
            <Button variant="text" size="small" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
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
      {items.map((item, index) => {
        const key = getKey(item, index);
        return <Fragment key={key}>{renderRow(item, expanded.has(key), () => toggle(key))}</Fragment>;
      })}
      {paginated && (
        <>
          <div ref={sentinelRef} />
          {isFetchingNextPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
              <CircularProgress size={20} />
            </Box>
          )}
          {!hasNextPage && (
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 1 }}>
              End of logs
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}
