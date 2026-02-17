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

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Switch,
  Tab,
  TablePagination,
  Tabs,
  Typography,
} from '@wso2/oxygen-ui';
import { ChevronRight, Maximize2, X } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useState } from 'react';
import { useArtifactTypes, useArtifacts, ARTIFACT_QUERY_MAP, type GqlArtifact } from '../api/queries';
import { useUpdateArtifactStatus, useUpdateListenerState } from '../api/mutations';
import SearchField from './SearchField';
import { ArtifactSource, ArtifactApiDefinition, ArtifactEndpoints, ArtifactWsdl, ArtifactValue, ArtifactCarbonArtifacts, ArtifactRuntimes } from './ArtifactTabs';
import { ARTIFACT_ICONS, ARTIFACT_TABS, DEFAULT_ARTIFACT_TABS, ENTRY_POINT_TYPE_SET, formatArtifactTypeName, typePlural, type SelectedArtifact, type TabProps } from './artifact-config';

function ListenerConfirmDialog({ open, action, listenerName, onConfirm, onCancel }: { open: boolean; action: 'START' | 'STOP'; listenerName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{action === 'STOP' ? 'Disable Listener' : 'Enable Listener'}</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to {action === 'STOP' ? 'disable' : 'enable'} the listener <strong>{listenerName}</strong>?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="text">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained" color={action === 'STOP' ? 'error' : 'primary'}>
          {action === 'STOP' ? 'Disable' : 'Enable'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SelectedTypeArtifacts({ artifacts, artifactType, envId, componentId, query, onSelect }: { artifacts: GqlArtifact[]; artifactType: string; envId: string; componentId: string; query: string; onSelect: (a: GqlArtifact) => void }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; artifact: GqlArtifact | null; action: 'START' | 'STOP' } | null>(null);
  const toggleStatus = useUpdateArtifactStatus();
  const updateListenerState = useUpdateListenerState();
  const artifactMapping = ARTIFACT_QUERY_MAP[artifactType];
  if (!artifactMapping) return null;

  const columns = artifactMapping.fields.split(', ').filter((f) => f !== 'state' && f !== 'container');
  const filtered = artifacts.filter((a) => !query || a.name?.toString().toLowerCase().includes(query.toLowerCase()));
  const supportsToggle = ['Endpoint', 'Listener'].includes(artifactType);
  const hasStateField = ['Connector', 'Listener'].includes(artifactType);
  const maxPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);
  const paginatedArtifacts = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);
  const totalColumns = columns.length + (hasStateField ? 1 : 0);
  const columnSize = Math.floor(12 / totalColumns);

  const handleToggle = (artifact: GqlArtifact, enabled: boolean) => {
    if (artifactType === 'Listener') {
      // Show confirmation dialog for listeners
      setConfirmDialog({
        open: true,
        artifact,
        action: enabled ? 'STOP' : 'START',
      });
    } else {
      // Direct toggle for other artifact types
      toggleStatus.mutate({ envId, componentId, artifactType, artifactName: artifact.name?.toString() ?? '', status: enabled ? 'inactive' : 'active' });
    }
  };

  const handleConfirmListenerToggle = () => {
    if (!confirmDialog?.artifact) return;

    const runtimes = (confirmDialog.artifact.runtimes as Array<{ runtimeId: string }> | undefined) ?? [];
    const runtimeIds = runtimes.map((r) => r.runtimeId);

    updateListenerState.mutate({
      runtimeIds,
      listenerName: confirmDialog.artifact.name?.toString() ?? '',
      action: confirmDialog.action,
    });

    setConfirmDialog(null);
  };

  return (
    <>
      <Stack gap={1.5}>
        {paginatedArtifacts.map((a, i) => {
          const artifactState = (a.state ?? '').toString().toLowerCase();
          const enabled = artifactState === 'enabled';
          return (
            <Card key={i} variant="outlined" sx={{ cursor: 'pointer', width: '100%', '&:hover': { boxShadow: 1 } }} onClick={() => onSelect(a)}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Grid container spacing={2} sx={{ flex: 1 }}>
                  {columns.map((col) => (
                    <Grid key={col} size={{ xs: columnSize }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                        {col}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {(a[col] ?? '—').toString()}
                      </Typography>
                    </Grid>
                  ))}
                  {hasStateField && (
                    <Grid size={{ xs: columnSize }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        State
                      </Typography>
                      <Chip label={(a.state ?? '—').toString().charAt(0).toUpperCase() + (a.state ?? '—').toString().slice(1).toLowerCase()} size="small" variant="outlined" color={enabled ? 'success' : 'default'} sx={{ fontSize: '0.875rem' }} />
                    </Grid>
                  )}
                </Grid>
                {supportsToggle && (
                  <Switch
                    size="small"
                    checked={enabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(a, enabled);
                    }}
                    sx={{ mr: 1 }}
                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${a.name}`}
                  />
                )}
                <ChevronRight size={18} style={{ color: 'var(--oxygen-palette-text-secondary)', flexShrink: 0 }} />
              </CardContent>
            </Card>
          );
        })}
      </Stack>
      {filtered.length > rowsPerPage && (
        <TablePagination
          component="div"
          count={filtered.length}
          page={safePage}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{ mt: 1 }}
        />
      )}

      {/* Listener State Confirmation Dialog */}
      <ListenerConfirmDialog open={confirmDialog?.open ?? false} action={confirmDialog?.action ?? 'START'} listenerName={confirmDialog?.artifact?.name?.toString() ?? ''} onConfirm={handleConfirmListenerToggle} onCancel={() => setConfirmDialog(null)} />
    </>
  );
}

export function ArtifactTypeSelector({ envId, componentId, onSelectArtifact }: { envId: string; componentId: string; onSelectArtifact: (a: GqlArtifact, type: string, envId: string) => void }) {
  const { data: allTypes = [], isLoading } = useArtifactTypes(componentId, envId);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const types = allTypes.filter((t) => !ENTRY_POINT_TYPE_SET.has(t.artifactType));
  const selectedArtifactType = selectedType ?? types[0]?.artifactType ?? '';
  const { data: artifacts = [], isLoading: loadingArtifacts } = useArtifacts(selectedArtifactType, envId, componentId);

  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (types.length === 0)
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No artifacts found for this component.
      </Typography>
    );

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 3 }}>
        <List disablePadding>
          {types.map((t) => (
            <ListItemButton
              key={t.artifactType}
              selected={t.artifactType === selectedArtifactType}
              onClick={() => {
                setSelectedType(t.artifactType);
                setQuery('');
              }}
              sx={{ borderRadius: 1, mb: 0.5 }}>
              {ARTIFACT_ICONS[t.artifactType] && <ListItemIcon sx={{ minWidth: 32 }}>{ARTIFACT_ICONS[t.artifactType]}</ListItemIcon>}
              <ListItemText primary={formatArtifactTypeName(t.artifactType)} />
            </ListItemButton>
          ))}
        </List>
      </Grid>
      <Grid size={{ xs: 12, sm: 9 }}>
        <Typography variant="overline" sx={{ mb: 1, display: 'block' }}>
          {typePlural(selectedArtifactType)}
        </Typography>
        <SearchField value={query} onChange={setQuery} placeholder={`Search ${typePlural(selectedArtifactType)} by name`} fullWidth sx={{ mb: 2 }} />
        {loadingArtifacts ? (
          <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />
        ) : (
          <SelectedTypeArtifacts artifacts={artifacts} artifactType={selectedArtifactType} envId={envId} componentId={componentId} query={query} onSelect={(a) => onSelectArtifact(a, selectedArtifactType, envId)} />
        )}
      </Grid>
    </Grid>
  );
}

const drawerSx = { '& .MuiDrawer-paper': { width: '60%', maxWidth: 700, minWidth: 400, position: 'fixed', top: 64, height: 'calc(100% - 64px)', borderLeft: '1px solid', borderColor: 'divider' } };
const headerSx = { px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' };

export function ArtifactDetail({ selected, onClose }: { selected: SelectedArtifact | null; onClose: () => void }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const artifactKey = selected ? `${selected.artifactType}-${selected.artifact.name}` : '';
  useEffect(() => {
    if (selected?.initialTab) {
      const tabs = ARTIFACT_TABS[selected.artifactType] ?? DEFAULT_ARTIFACT_TABS;
      const idx = tabs.indexOf(selected.initialTab);
      setActiveTabIndex(idx >= 0 ? idx : 0);
    } else {
      setActiveTabIndex(0);
    }
  }, [artifactKey, selected?.artifactType, selected?.initialTab]);

  if (!selected) return null;

  const { artifact, artifactType, envId, componentId } = selected;
  const tabs = ARTIFACT_TABS[artifactType] ?? DEFAULT_ARTIFACT_TABS;
  const validTabIndex = Math.min(activeTabIndex, tabs.length - 1);
  const activeTab = tabs[validTabIndex];

  const tabProps: TabProps = { artifact, artifactType, envId, componentId, projectId: selected.projectId };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Source':
        return <ArtifactSource {...tabProps} />;
      case 'API definition':
        return <ArtifactApiDefinition {...tabProps} />;
      case 'Endpoints':
        return <ArtifactEndpoints {...tabProps} />;
      case 'WSDL':
        return <ArtifactWsdl {...tabProps} />;
      case 'Value':
        return <ArtifactValue {...tabProps} />;
      case 'Artifacts':
        return <ArtifactCarbonArtifacts {...tabProps} />;
      case 'Runtimes':
        return <ArtifactRuntimes {...tabProps} />;
      default:
        return null;
    }
  };

  return (
    <Drawer anchor="right" open onClose={onClose} variant="persistent" sx={drawerSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={headerSx}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {artifact.name?.toString()}
        </Typography>
        <Stack direction="row" gap={0.5}>
          <IconButton size="small" aria-label="maximize" disabled>
            <Maximize2 size={16} />
          </IconButton>
          <IconButton size="small" aria-label="close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </Stack>
      </Stack>
      <Box sx={{ px: 2 }}>
        {tabs.length > 0 && (
          <>
            <Tabs value={validTabIndex} onChange={(_, v) => setActiveTabIndex(v)} sx={{ mb: 2 }}>
              {tabs.map((t) => (
                <Tab key={t} label={t} />
              ))}
            </Tabs>
            {renderActiveTab()}
          </>
        )}
      </Box>
    </Drawer>
  );
}
