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

import { Autocomplete, Box, Button, Checkbox, CircularProgress, Collapse, Drawer, FormControlLabel, IconButton, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@wso2/oxygen-ui';
import { ChevronDown, ChevronUp, X } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useState } from 'react';
import { useComponentDeployment, useExecutionConfigs } from '../../api/queries';
import { getOrgUuidFromToken } from '../../auth/tokenManager';
import { useDeployDeploymentTrack } from '../../api/mutations';
import { INTERVAL_UNITS, TIMEZONE_OPTIONS, CRON_FIELD_LABELS, type IntervalUnit, type CronField, intervalToCron, cronToInterval, parseCronParts, buildCronFromParts, describeCron, getTimezoneLabel } from '../../utils/cronUtils';

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (msg: string) => void;
  envId: string;
  envName: string;
  componentId: string;
  orgHandler: string;
  versionId: string;
  deploymentPipelineId: string;
}

export default function ScheduleDialog({ open, onClose, onSaveSuccess, onSaveError, envId, envName: _envName, componentId, orgHandler, versionId, deploymentPipelineId }: ScheduleDialogProps) {
  const [tab, setTab] = useState(0);
  const [intervalCount, setIntervalCount] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('Minute');
  const [cronFields, setCronFields] = useState<Record<CronField, string>>({ minute: '*/1', hour: '*', dom: '*', month: '*', dow: '*' });
  const [timezone, setTimezone] = useState('UTC');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState<string>('');
  const [allowConcurrency, setAllowConcurrency] = useState(false);
  const [retryCount, setRetryCount] = useState<string>('');

  const orgUuid = getOrgUuidFromToken() ?? '';
  const { data: deployment, isLoading: loadingDeployment } = useComponentDeployment(orgHandler, orgUuid, componentId, versionId, envId);
  const releaseId = deployment?.releaseId ?? '';
  const { data: existingConfigs, isLoading: loadingExecConfigs } = useExecutionConfigs(componentId, releaseId);
  const loadingConfigs = loadingDeployment || loadingExecConfigs;
  const deployTrack = useDeployDeploymentTrack();

  useEffect(() => {
    if (!existingConfigs || !open) return;
    const freq = existingConfigs.cronjobFrequency || '*/1 * * * *';
    const tz = existingConfigs.cronjobTimezone || 'UTC';
    setTimezone(tz);
    if (existingConfigs.timeoutSeconds != null) setTimeoutSeconds(String(existingConfigs.timeoutSeconds));
    if (existingConfigs.cronjobAllowConcurrency != null) setAllowConcurrency(existingConfigs.cronjobAllowConcurrency);
    if (existingConfigs.retryCount != null) setRetryCount(String(existingConfigs.retryCount));
    const parsed = cronToInterval(freq);
    if (parsed) {
      setTab(0);
      setIntervalCount(parsed.count);
      setIntervalUnit(parsed.unit);
    } else {
      setTab(1);
      setCronFields(parseCronParts(freq));
    }
  }, [existingConfigs, open]);

  const cronExpression = tab === 0 ? intervalToCron(intervalCount, intervalUnit) : buildCronFromParts(cronFields);

  const handleSave = () => {
    deployTrack.mutate(
      {
        componentId,
        id: versionId,
        imageId: deployment?.build?.buildId ?? '',
        environmentId: envId,
        deploymentPipelineId,
        cron: cronExpression,
        cronTimezone: timezone,
        jobTimeoutSeconds: timeoutSeconds ? parseInt(timeoutSeconds, 10) : 300,
        cronJobAllowConcurrency: allowConcurrency,
      },
      {
        onSuccess: () => {
          onClose();
          onSaveSuccess?.();
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Failed to save schedule';
          onClose();
          onSaveError?.(msg);
        },
      },
    );
  };

  const description = describeCron(cronExpression);

  const drawerSx = {
    '& .MuiDrawer-paper': {
      width: 440,
      position: 'fixed',
      top: 64,
      height: 'calc(100% - 64px)',
      borderLeft: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
    },
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} variant="temporary" sx={drawerSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Schedule
        </Typography>
        <IconButton size="small" aria-label="close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
        {loadingConfigs ? (
          <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 4 }} />
        ) : (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label="BY INTERVAL" />
              <Tab label="BY CRON" />
            </Tabs>

            {tab === 0 && (
              <Stack gap={2}>
                <Typography variant="body2" color="text.secondary">
                  Repeat beginning of every
                </Typography>
                <Stack direction="row" gap={2}>
                  <TextField
                    type="text"
                    inputMode="numeric"
                    value={intervalCount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setIntervalCount(raw === '' ? ('' as unknown as number) : parseInt(raw, 10));
                    }}
                    onBlur={() => {
                      if (!intervalCount || intervalCount < 1) setIntervalCount(1);
                    }}
                    sx={{ width: 120 }}
                  />
                  <Select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)} sx={{ flex: 1 }}>
                    {INTERVAL_UNITS.map((u) => (
                      <MenuItem key={u} value={u}>
                        {u}
                      </MenuItem>
                    ))}
                  </Select>
                </Stack>
                {description && (
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                )}
              </Stack>
            )}

            {tab === 1 && (
              <Stack gap={1.5}>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', textAlign: 'center', py: 0.5 }}>
                  {cronExpression}
                </Typography>
                {description && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    {description}
                  </Typography>
                )}
                {CRON_FIELD_LABELS.map(({ key, label, placeholder }) => (
                  <Box key={key}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <TextField fullWidth size="small" placeholder={placeholder} value={cronFields[key as CronField]} onChange={(e) => setCronFields((prev) => ({ ...prev, [key]: e.target.value }))} />
                  </Box>
                ))}
                <Typography variant="caption" color="text.secondary">
                  * any value &nbsp; , separator for multiple values &nbsp; - range of values &nbsp; / step values
                </Typography>
              </Stack>
            )}

            <Box sx={{ mt: 2 }}>
              <Button variant="text" size="small" endIcon={advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} onClick={() => setAdvancedOpen((v) => !v)} sx={{ px: 0 }}>
                Advanced Settings
              </Button>
              <Collapse in={advancedOpen}>
                <Stack gap={2} sx={{ mt: 1.5 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      In Time Zone
                    </Typography>
                    <Autocomplete
                      options={TIMEZONE_OPTIONS}
                      value={TIMEZONE_OPTIONS.find((o) => o.value === timezone) ?? { label: getTimezoneLabel(timezone), value: timezone }}
                      onChange={(_, v) => setTimezone(v?.value ?? 'UTC')}
                      getOptionLabel={(o) => o.label}
                      isOptionEqualToValue={(o, v) => o.value === v.value}
                      renderInput={(params) => <TextField {...params} size="small" />}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
                      Execution Behavior
                    </Typography>
                    <Stack gap={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Job Timeout (in seconds)
                        </Typography>
                        <TextField fullWidth size="small" type="number" value={timeoutSeconds} onChange={(e) => setTimeoutSeconds(e.target.value)} placeholder="No timeout" inputProps={{ min: 0 }} />
                      </Box>
                      <FormControlLabel control={<Checkbox checked={allowConcurrency} onChange={(e) => setAllowConcurrency(e.target.checked)} size="small" />} label="Allow Overlapping Executions" />
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Attempt Count
                        </Typography>
                        <TextField fullWidth size="small" type="number" value={retryCount} onChange={(e) => setRetryCount(e.target.value)} placeholder="0" inputProps={{ min: 0 }} />
                      </Box>
                    </Stack>
                  </Box>
                </Stack>
              </Collapse>
            </Box>
          </>
        )}
      </Box>

      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Button onClick={onClose}>Back</Button>
        <Button variant="contained" onClick={handleSave} disabled={deployTrack.isPending || !deployment?.build?.buildId}>
          {deployTrack.isPending ? 'Updating…' : 'Update'}
        </Button>
      </Stack>
    </Drawer>
  );
}
