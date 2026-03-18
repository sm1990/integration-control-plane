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

import { Box, Button, Card, CardContent, Typography, Chip, Select, MenuItem, FormControl, FormLabel, Switch, FormControlLabel, Divider, PageContent, PageTitle } from '@wso2/oxygen-ui';
import { Download, RefreshCw, Filter, AlertCircle, CheckCircle, AlertTriangle, Info } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { capitalize } from '../utils/string';
import { Link as NavigateLink, useParams } from 'react-router';
import { orgAnalyticsUrl } from '../paths';
import { useState, type JSX, type ReactNode } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  component: string;
  message: string;
  details?: string;
}

const mockLogs: LogEntry[] = [
  {
    id: '1',
    timestamp: '2026-01-05 14:32:15',
    level: 'success',
    component: 'Authentication',
    message: 'User login successful',
    details: 'User: john.doe@example.com, IP: 192.168.1.100',
  },
  {
    id: '2',
    timestamp: '2026-01-05 14:30:42',
    level: 'warning',
    component: 'MFA',
    message: 'Multiple failed MFA attempts detected',
    details: 'User: jane.smith@example.com, Attempts: 3',
  },
  {
    id: '3',
    timestamp: '2026-01-05 14:28:10',
    level: 'error',
    component: 'Password Reset',
    message: 'Password reset token expired',
    details: 'Token ID: abc123xyz, User: mike.johnson@example.com',
  },
  {
    id: '4',
    timestamp: '2026-01-05 14:25:33',
    level: 'info',
    component: 'Registration',
    message: 'New user registration initiated',
    details: 'Email: sarah.wilson@example.com',
  },
];

const LOG_CONFIG: Record<
  string,
  {
    icon: ReactNode;
    color: 'success' | 'warning' | 'error' | 'info' | 'default';
  }
> = {
  success: { icon: <CheckCircle size={18} />, color: 'success' },
  warning: { icon: <AlertTriangle size={18} />, color: 'warning' },
  error: { icon: <AlertCircle size={18} />, color: 'error' },
  info: { icon: <Info size={18} />, color: 'info' },
};

const LogItem = ({ log, expanded, onToggle }: { log: LogEntry; expanded: boolean; onToggle: () => void }) => {
  const cfg = LOG_CONFIG[log.level] || LOG_CONFIG.info;
  return (
    <Box>
      <Box sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={onToggle}>
        <Box sx={{ display: 'flex', alignItems: 'start', gap: 2 }}>
          <Box sx={{ color: `${cfg.color}.main`, mt: 0.5 }}>{cfg.icon}</Box>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Chip label={log.level} size="small" color={cfg.color} />
              <Chip label={log.component} size="small" variant="outlined" />
              <Typography variant="caption" color="text.secondary">
                {log.timestamp}
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight={500}>
              {log.message}
            </Typography>
            {expanded && log.details && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}>
                {log.details}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default function Logs(): JSX.Element {
  const { orgId } = useParams<{ orgId: string }>() || 'default-org';
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [comp, setComp] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const logs = mockLogs.filter((l) => (level === 'all' || l.level === level) && (comp === 'all' || l.component === comp) && (!query || [l.message, l.component, l.details || ''].some((s) => s.toLowerCase().includes(query.toLowerCase()))));

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.BackButton component={<NavigateLink to={orgAnalyticsUrl(orgId ?? 'default')} />} />
        <PageTitle.Header>Activity Logs</PageTitle.Header>
        <PageTitle.SubHeader>View and monitor authentication events and system activities</PageTitle.SubHeader>
        <PageTitle.Actions>
          <FormControlLabel control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />} label="Auto-refresh" />
          <Button variant="outlined" startIcon={<RefreshCw size={18} />}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<Download size={18} />}>
            Export
          </Button>
        </PageTitle.Actions>
      </PageTitle>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              alignItems: 'end',
            }}>
            <Box sx={{ flexGrow: 1, minWidth: 250 }}>
              <SearchField value={query} onChange={setQuery} placeholder="Search logs..." size="medium" fullWidth />
            </Box>
            <FormControl sx={{ minWidth: 150 }}>
              <FormLabel>Level</FormLabel>
              <Select value={level} onChange={(e) => setLevel(e.target.value as string)}>
                <MenuItem value="all">All Levels</MenuItem>
                {['success', 'info', 'warning', 'error'].map((l) => (
                  <MenuItem key={l} value={l}>
                    {capitalize(l)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 180 }}>
              <FormLabel>Component</FormLabel>
              <Select value={comp} onChange={(e) => setComp(e.target.value as string)}>
                <MenuItem value="all">All Components</MenuItem>
                {['Authentication', 'MFA', 'Password Reset', 'Registration', 'OAuth'].map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" startIcon={<Filter size={18} />}>
              Advanced
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {logs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="body2" color="text.secondary">
                No logs found
              </Typography>
            </Box>
          ) : (
            <Box>
              {logs.map((l, i) => (
                <Box key={l.id}>
                  <LogItem log={l} expanded={expanded === l.id} onToggle={() => setExpanded(expanded === l.id ? null : l.id)} />
                  {i < logs.length - 1 && <Divider />}
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
      <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Showing {logs.length} of {mockLogs.length} logs
        </Typography>
      </Box>
    </PageContent>
  );
}
