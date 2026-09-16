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

import { Box, CircularProgress, IconButton, Tooltip } from '@wso2/oxygen-ui';
import { Check, Copy } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useRef, useState } from 'react';
import type { BuildRunLogs } from '../types/build';
import { buildLogText } from '../utils/build';

export interface BuildLogViewerProps {
  logs: BuildRunLogs | null | undefined;
  logsLoading: boolean;
  showLogs: boolean;
}

export default function BuildLogViewer({ logs, logsLoading, showLogs }: BuildLogViewerProps) {
  const logsRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (showLogs && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, showLogs]);

  if (!showLogs) return null;

  const logText = buildLogText(logs);

  const handleCopy = () => {
    if (!logText) return;
    void navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {logsLoading && !logs ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy logs'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              disabled={!logText}
              sx={{
                mr: 1.5,
                position: 'absolute',
                top: 6,
                right: 6,
                zIndex: 1,
                color: copied ? 'success.light' : 'grey.500',
                '&:hover': { color: 'grey.200', bgcolor: 'grey.800' },
              }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </IconButton>
          </Tooltip>
          <Box
            component="pre"
            ref={logsRef}
            sx={(theme) => ({
              m: 0,
              p: 2,
              bgcolor: theme.syntax.dark.background,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              lineHeight: 1.6,
              overflowY: 'auto',
              maxHeight: 320,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: theme.syntax.dark.text,
            })}>
            {logText === null ? 'No log data available' : logText || 'Waiting for build logs...'}
          </Box>
        </Box>
      )}
    </>
  );
}
