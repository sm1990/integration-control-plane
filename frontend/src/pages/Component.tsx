import {
  Avatar,
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
  Divider,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  PageContent,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Typography,
} from '@wso2/oxygen-ui';
import { ChevronRight, Maximize2, RefreshCw, X, ListFilter, LayoutGrid } from '@wso2/oxygen-ui-icons-react';
import { Globe, Link2, ListOrdered, Clock, FolderArchive, Package, Plug, FileText, Radio, Server, Wifi, Layers } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { useEffect, useState, type JSX } from 'react';
import {
  useComponentByHandler,
  useEnvironments,
  useArtifactTypes,
  useArtifacts,
  useArtifactSource,
  useLocalEntryValue,
  useRefreshEnvironmentArtifacts,
  ARTIFACT_TYPE_TO_SOURCE_TYPE,
  type GqlEnvironment,
  type GqlArtifact,
  ARTIFACT_QUERY_MAP,
} from '../api/queries';
import { useUpdateArtifactStatus, useUpdateListenerState } from '../api/mutations';
import NotFound from '../components/NotFound';
import { resourceUrl, broaden, type ComponentScope } from '../nav';
import { useLoadComponentPermissions } from '../hooks/usePermissionLoader';

/** Format artifact type name for display: "RestApi" → "Rest Api" */
function formatArtifactTypeName(t: string): string {
  return t.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** "RestApi" → "Rest Api(s)", "ProxyService" → "Proxy Service(s)" */
function typePlural(t: string): string {
  return t.replace(/([a-z])([A-Z])/g, '$1 $2') + '(s)';
}

const ARTIFACT_ICONS: Record<string, JSX.Element> = {
  RestApi: <Globe size={18} />,
  ProxyService: <Server size={18} />,
  Endpoint: <Link2 size={18} />,
  InboundEndpoint: <Radio size={18} />,
  Sequence: <ListOrdered size={18} />,
  Task: <Clock size={18} />,
  LocalEntry: <FileText size={18} />,
  CarbonApp: <Package size={18} />,
  Connector: <Plug size={18} />,
  RegistryResource: <FolderArchive size={18} />,
  Listener: <Wifi size={18} />,
  Service: <Layers size={18} />,
};

const ARTIFACT_TABS: Record<string, string[]> = {
  RestApi: ['Overview', 'Source', 'API definition', 'Runtimes'],
  ProxyService: ['Overview', 'Endpoints', 'WSDL', 'Runtimes'],
  Task: ['Runtimes'],
  LocalEntry: ['Value', 'Runtimes'],
  CarbonApp: ['Artifacts', 'Runtimes'],
  Connector: ['Runtimes'],
  RegistryResource: ['Runtimes'],
  Listener: ['Overview', 'Runtimes'],
  Service: ['Overview', 'Resources', 'Runtimes'],
};
const DEFAULT_ARTIFACT_TABS = ['Overview', 'Source', 'Runtimes'];

const ENTRY_POINT_CONFIG: Record<string, { label: string; color: string; bgColor: string; metaField?: string }> = {
  RestApi: { label: 'API', color: '#1565c0', bgColor: '#e3f2fd', metaField: 'context' },
  ProxyService: { label: 'Proxy', color: '#e65100', bgColor: '#fff3e0' },
  InboundEndpoint: { label: 'Inbound', color: '#2e7d32', bgColor: '#e8f5e9', metaField: 'protocol' },
  Task: { label: 'Task', color: '#00695c', bgColor: '#e0f2f1' },
  Service: { label: 'Service', color: '#4a148c', bgColor: '#f3e5f5', metaField: 'basePath' },
  Listener: { label: 'Listener', color: '#bf360c', bgColor: '#fbe9e7' },
};

const ENTRY_POINT_DETAIL_TABS: Record<string, string[]> = {
  RestApi: ['Overview', 'Resources', 'Runtimes'],
  ProxyService: ['Overview', 'Runtimes'],
  InboundEndpoint: ['Overview', 'Runtimes'],
  Task: ['Runtimes'],
  Service: ['Overview', 'Resources', 'Runtimes'],
  Listener: ['Overview', 'Runtimes'],
};

interface SelectedArtifact {
  artifact: GqlArtifact;
  artifactType: string;
  envId: string;
  componentId: string;
  projectId: string;
  initialTab?: string;
}

const cellSx = { borderBottom: '1px solid', borderColor: 'divider' };
const labelSx = { ...cellSx, fontWeight: 600, textTransform: 'capitalize', width: 180 };
const preSx = { p: 2, bgcolor: 'action.hover', borderRadius: 1, overflow: 'auto', fontSize: 12, fontFamily: 'monospace', maxHeight: 500 };
const emptySx = { color: 'text.secondary', py: 2 };

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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Switch size="small" checked={checked} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} />
      <Typography variant="body2" color="text.secondary">
        {checked ? 'Enabled' : 'Disabled'}
      </Typography>
    </Stack>
  );
}

function DataTable({ headers, rows, emptyMsg }: { headers?: string[]; rows: (string | JSX.Element)[][]; emptyMsg?: string }) {
  if (rows.length === 0) return <Typography sx={emptySx}>{emptyMsg ?? 'No data available.'}</Typography>;
  return (
    <Table size="small">
      {headers && (
        <TableHead>
          <TableRow>
            {headers.map((h) => (
              <TableCell key={h} sx={{ fontWeight: 600 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
      )}
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j} sx={headers ? undefined : cellSx}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type TabProps = SelectedArtifact;

function ArtifactOverview({ artifact, artifactType, envId, componentId }: TabProps) {
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: 'START' | 'STOP' } | null>(null);
  const toggleStatus = useUpdateArtifactStatus();
  const updateListenerState = useUpdateListenerState();

  const artifactMapping = ARTIFACT_QUERY_MAP[artifactType];
  if (!artifactMapping) return null;
  const isProxyService = artifactType === 'ProxyService';
  const hasToggle = ['ProxyService', 'Listener'].includes(artifactType);
  const hasTracing = !['Service', 'Listener'].includes(artifactType);
  const fields = artifactMapping.fields.split(', ');
  const tracing = (artifact.tracing ?? 'disabled').toString().toLowerCase();
  const artifactState = (artifact.state ?? '').toString().toLowerCase();
  const endpoints = (artifact.endpoints as string[] | undefined) ?? [];
  const attributes = (artifact.attributes as Array<{ name: string; value?: string }> | undefined) ?? [];

  const formatFieldValue = (f: string) => {
    const val = artifact[f];
    return f === 'version' && !val ? 'N/A' : (val ?? 'N/A').toString();
  };

  const handleToggle = (enabled: boolean) => {
    if (artifactType === 'Listener') {
      setConfirmDialog({
        open: true,
        action: enabled ? 'STOP' : 'START',
      });
    } else {
      toggleStatus.mutate({
        envId,
        componentId,
        artifactType,
        artifactName: artifact.name?.toString() ?? '',
        status: enabled ? 'inactive' : 'active',
      });
    }
  };

  const handleConfirmListenerToggle = () => {
    if (!confirmDialog) return;
    const runtimes = (artifact.runtimes as Array<{ runtimeId: string }> | undefined) ?? [];
    const runtimeIds = runtimes.map((r) => r.runtimeId);

    updateListenerState.mutate({
      runtimeIds,
      listenerName: artifact.name?.toString() ?? '',
      action: confirmDialog.action,
    });

    setConfirmDialog(null);
  };

  return (
    <Stack gap={2}>
      <Table size="small">
        <TableBody>
          {fields.map((f) => (
            <TableRow key={f}>
              <TableCell sx={labelSx}>{f}</TableCell>
              <TableCell sx={cellSx}>{hasToggle && f === 'state' ? <Chip label={formatFieldValue(f).toUpperCase()} size="small" color={artifactState === 'enabled' ? 'success' : 'default'} /> : formatFieldValue(f)}</TableCell>
            </TableRow>
          ))}
          {hasToggle && (
            <TableRow>
              <TableCell sx={labelSx}>Enable/Disable</TableCell>
              <TableCell sx={cellSx}>
                <Toggle checked={artifactState === 'enabled'} onChange={() => handleToggle(artifactState === 'enabled')} disabled={toggleStatus.isPending || updateListenerState.isPending} />
              </TableCell>
            </TableRow>
          )}
          {hasTracing && (
            <TableRow>
              <TableCell sx={labelSx}>Tracing</TableCell>
              <TableCell sx={cellSx}>
                <Toggle checked={tracing === 'enabled'} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {isProxyService && endpoints.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Endpoints
          </Typography>
          <DataTable
            rows={endpoints.map((ep) => [
              <Typography key={ep} variant="body2" sx={{ fontFamily: 'monospace' }}>
                {ep}
              </Typography>,
            ])}
          />
        </>
      )}
      {attributes.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Attributes
          </Typography>
          <DataTable headers={['Name', 'Value']} rows={attributes.map((a) => [a.name.toString(), (a.value ?? '').toString()])} />
        </>
      )}

      {/* Listener State Confirmation Dialog */}
      <ListenerConfirmDialog open={confirmDialog?.open ?? false} action={confirmDialog?.action ?? 'START'} listenerName={artifact.name?.toString() ?? ''} onConfirm={handleConfirmListenerToggle} onCancel={() => setConfirmDialog(null)} />
    </Stack>
  );
}

function ArtifactSource({ envId, componentId, artifactType, artifact }: TabProps) {
  const sourceType = ARTIFACT_TYPE_TO_SOURCE_TYPE[artifactType] ?? artifactType.toLowerCase();
  const { data: source, isLoading, error } = useArtifactSource(envId, componentId, sourceType, artifact.name?.toString() ?? '');
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (error || !source) return <Typography sx={emptySx}>No source content available.</Typography>;
  return (
    <Box component="pre" sx={preSx}>
      {source}
    </Box>
  );
}

function ArtifactApiDefinition({ artifact }: TabProps) {
  const resources = (artifact.resources as Array<{ path?: string; methods?: string }> | undefined) ?? [];
  const context = (artifact.context ?? '/*').toString();
  const items = resources.length === 0 ? [{ methods: 'POST', path: context }] : resources;
  return (
    <Stack gap={1}>
      {items.map((r, i) => (
        <Box key={i} sx={{ bgcolor: '#e8f5e9', p: 1.5, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip label={(r.methods ?? 'GET').toString().toUpperCase()} size="small" sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 700 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {r.path ?? context}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function ArtifactEndpoints({ artifact }: TabProps) {
  const endpoints = (artifact.endpoints as string[] | undefined) ?? [];
  return (
    <DataTable
      rows={endpoints.map((ep) => [
        <Typography key={ep} variant="body2" sx={{ fontFamily: 'monospace' }}>
          {ep}
        </Typography>,
      ])}
      emptyMsg="No endpoints available."
    />
  );
}

function ServiceResources({ artifact }: TabProps) {
  const resources = (artifact.resources as Array<{ url?: string; methods?: string[] }> | undefined) ?? [];
  const basePath = (artifact.basePath ?? '/').toString();

  return (
    <Stack gap={1}>
      {resources.length === 0 ? (
        <Typography sx={emptySx}>No resources available.</Typography>
      ) : (
        resources.map((r, i) => {
          const methods = r.methods ?? [];
          return (
            <Box key={i} sx={{ bgcolor: '#e8f5e9', p: 1.5, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {methods.map((method, idx) => (
                <Chip key={idx} label={method.toUpperCase()} size="small" sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 700 }} />
              ))}
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {basePath}
                {r.url ?? ''}
              </Typography>
            </Box>
          );
        })
      )}
    </Stack>
  );
}

function ArtifactWsdl(_wsdlProps: TabProps) {
  void _wsdlProps;
  return <Typography sx={emptySx}>No WSDL content available.</Typography>;
}

function ArtifactValue({ artifact, envId, componentId }: TabProps) {
  const { data: value, isLoading } = useLocalEntryValue(componentId, artifact.name?.toString() ?? '', envId);
  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (!value) return <Typography sx={emptySx}>No value available.</Typography>;
  return (
    <>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Value: {artifact.name?.toString()}
      </Typography>
      <Box component="pre" sx={preSx}>
        {value}
      </Box>
    </>
  );
}

function ArtifactCarbonArtifacts({ artifact }: TabProps) {
  const artifacts = (artifact.artifacts as Array<{ name: string; type: string }> | undefined) ?? [];
  return <DataTable headers={['Artifact Name', 'Artifact Type']} rows={artifacts.map((a) => [a.name, a.type])} emptyMsg="No artifacts found." />;
}

function ArtifactRuntimes({ artifact }: TabProps) {
  const runtimes = (artifact.runtimes as Array<{ runtimeId: string; status: string }> | undefined) ?? [];
  return (
    <DataTable
      headers={['Runtime ID', 'Status']}
      rows={runtimes.map((r) => [
        <Typography key="id" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
          {r.runtimeId}
        </Typography>,
        <Typography key="status" variant="body2" color={r.status === 'RUNNING' ? 'success.main' : 'error.main'} sx={{ fontWeight: 600 }}>
          {r.status}
        </Typography>,
      ])}
      emptyMsg="No runtimes found."
    />
  );
}

const drawerSx = { '& .MuiDrawer-paper': { width: '60%', maxWidth: 700, minWidth: 400, position: 'fixed', top: 64, height: 'calc(100% - 64px)', borderLeft: '1px solid', borderColor: 'divider' } };
const headerSx = { px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' };

function ArtifactDetail({ selected, onClose }: { selected: SelectedArtifact | null; onClose: () => void }) {
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
      case 'Overview':
        return <ArtifactOverview {...tabProps} />;
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
      case 'Resources':
        return <ServiceResources {...tabProps} />;
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
          <IconButton size="small">
            <Maximize2 size={16} />
          </IconButton>
          <IconButton size="small" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </Stack>
      </Stack>
      <Box sx={{ px: 2 }}>
        <Tabs value={validTabIndex} onChange={(_, v) => setActiveTabIndex(v)} sx={{ mb: 2 }}>
          {tabs.map((t) => (
            <Tab key={t} label={t} />
          ))}
        </Tabs>
        {renderActiveTab()}
      </Box>
    </Drawer>
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
                      <Typography variant="caption" color="text.secondary">
                        State
                      </Typography>
                      <Chip label={(a.state ?? '—').toString().toUpperCase()} size="small" color={enabled ? 'success' : 'default'} />
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
                  />
                )}
                <ChevronRight size={18} style={{ color: 'var(--oxygen-palette-text-secondary)', flexShrink: 0 }} />
              </CardContent>
            </Card>
          );
        })}
      </Stack>
      {filtered.length > 5 && (
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
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

const ENTRY_POINT_TYPE_SET = new Set(Object.keys(ENTRY_POINT_CONFIG));

function ArtifactTypeSelector({ envId, componentId, onSelectArtifact }: { envId: string; componentId: string; onSelectArtifact: (a: GqlArtifact, type: string, envId: string) => void }) {
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
        <SearchField value={query} onChange={setQuery} placeholder={`Search ${typePlural(selectedArtifactType)} by name, context, or version`} fullWidth sx={{ mb: 2 }} />
        {loadingArtifacts ? (
          <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />
        ) : (
          <SelectedTypeArtifacts artifacts={artifacts} artifactType={selectedArtifactType} envId={envId} componentId={componentId} query={query} onSelect={(a) => onSelectArtifact(a, selectedArtifactType, envId)} />
        )}
      </Grid>
    </Grid>
  );
}

function EntryPointDetail({ selected, onViewSource, onViewRuntimes }: { selected: SelectedArtifact; onViewSource: () => void; onViewRuntimes: () => void }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const { artifact, artifactType, envId, componentId, projectId } = selected;
  const config = ENTRY_POINT_CONFIG[artifactType];
  const tabs = ENTRY_POINT_DETAIL_TABS[artifactType] ?? ['Overview', 'Runtimes'];
  const validTabIndex = Math.min(activeTabIndex, tabs.length - 1);
  const activeTab = tabs[validTabIndex];
  const tabProps: TabProps = { artifact, artifactType, envId, componentId, projectId };
  const container = artifact.container?.toString();
  const context = artifact.context?.toString();
  const tracing = (artifact.tracing ?? 'disabled').toString().toLowerCase();

  const artifactKey = `${artifactType}-${artifact.name}`;
  useEffect(() => {
    if (selected.initialTab) {
      const idx = tabs.indexOf(selected.initialTab);
      setActiveTabIndex(idx >= 0 ? idx : 0);
    } else {
      setActiveTabIndex(0);
    }
  }, [artifactKey, selected.initialTab]);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Overview':
        return <ArtifactOverview {...tabProps} />;
      case 'Resources':
        return <ArtifactApiDefinition {...tabProps} />;
      case 'Runtimes':
        return <ArtifactRuntimes {...tabProps} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
        <Chip label={(config?.label ?? artifactType).toUpperCase()} size="small" sx={{ bgcolor: config?.bgColor, color: config?.color, fontWeight: 700, fontSize: 11 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {artifact.name?.toString()}
        </Typography>
        {container && <Chip label={`C-App: ${container}`} size="small" variant="outlined" sx={{ bgcolor: '#e8eaf6', color: '#3949ab', fontSize: 11 }} />}
        {context && (
          <Typography variant="body2" color="text.secondary">
            Context: {context}
          </Typography>
        )}
        <Chip label={tracing === 'enabled' ? 'Tracing Enabled' : 'Tracing Disabled'} size="small" color={tracing === 'enabled' ? 'success' : 'default'} variant="outlined" sx={{ ml: 'auto' }} />
        {(ARTIFACT_TABS[artifactType] ?? DEFAULT_ARTIFACT_TABS).includes('Source') && (
          <Button variant="outlined" size="small" onClick={onViewSource}>
            View Source
          </Button>
        )}
        <Button variant="outlined" size="small" onClick={onViewRuntimes}>
          View Runtimes
        </Button>
      </Stack>
      <Tabs value={validTabIndex} onChange={(_, v) => setActiveTabIndex(v)} sx={{ mb: 2 }}>
        {tabs.map((t) => (
          <Tab key={t} label={t} />
        ))}
      </Tabs>
      {renderActiveTab()}
    </Box>
  );
}

function EntryPointsList({ envId, componentId, projectId, componentType, onOpenDrawer }: { envId: string; componentId: string; projectId: string; componentType: string; onOpenDrawer: (a: GqlArtifact, type: string, envId: string, tab: string) => void }) {
  const [selectedKey, setSelectedKey] = useState('');
  const isMI = componentType === 'MI';

  const { data: apis = [], isLoading: loadingApis } = useArtifacts('RestApi', envId, componentId, { enabled: isMI });
  const { data: proxies = [], isLoading: loadingProxies } = useArtifacts('ProxyService', envId, componentId, { enabled: isMI });
  const { data: inboundEps = [], isLoading: loadingInbound } = useArtifacts('InboundEndpoint', envId, componentId, { enabled: isMI });
  const { data: tasks = [], isLoading: loadingTasks } = useArtifacts('Task', envId, componentId, { enabled: isMI });
  const { data: services = [], isLoading: loadingServices } = useArtifacts('Service', envId, componentId, { enabled: !isMI });
  const { data: listeners = [], isLoading: loadingListeners } = useArtifacts('Listener', envId, componentId, { enabled: !isMI });

  const isLoading = isMI ? loadingApis || loadingProxies || loadingInbound || loadingTasks : loadingServices || loadingListeners;

  const allEntryPoints = isMI
    ? [...apis.map((a) => ({ artifact: a, type: 'RestApi' })), ...proxies.map((a) => ({ artifact: a, type: 'ProxyService' })), ...inboundEps.map((a) => ({ artifact: a, type: 'InboundEndpoint' })), ...tasks.map((a) => ({ artifact: a, type: 'Task' }))]
    : [...services.map((a) => ({ artifact: a, type: 'Service' })), ...listeners.map((a) => ({ artifact: a, type: 'Listener' }))];

  const allKeys = new Set(allEntryPoints.map(({ artifact: a, type }) => `${type}::${a.name}`));
  const firstKey = allEntryPoints.length > 0 ? `${allEntryPoints[0].type}::${allEntryPoints[0].artifact.name}` : '';
  const activeKey = selectedKey && allKeys.has(selectedKey) ? selectedKey : firstKey;
  const selectedEntry = allEntryPoints.find(({ artifact: a, type }) => `${type}::${a.name}` === activeKey);

  if (isLoading) return <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', py: 4 }} />;
  if (allEntryPoints.length === 0)
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No entry points found for this component.
      </Typography>
    );

  return (
    <>
      <Select
        value={activeKey}
        onChange={(e) => setSelectedKey(e.target.value as string)}
        fullWidth
        renderValue={(value) => {
          const entry = allEntryPoints.find(({ artifact: a, type }) => `${type}::${a.name}` === value);
          if (!entry) return value;
          const config = ENTRY_POINT_CONFIG[entry.type];
          const meta = config?.metaField ? entry.artifact[config.metaField]?.toString() : undefined;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip label={config?.label} size="small" sx={{ bgcolor: config?.bgColor, color: config?.color, fontWeight: 700, fontSize: 11, minWidth: 60, justifyContent: 'center' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {entry.artifact.name?.toString()}
              </Typography>
              {meta && (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                  {meta}
                </Typography>
              )}
            </Box>
          );
        }}>
        {allEntryPoints.map(({ artifact: a, type }) => {
          const key = `${type}::${a.name}`;
          const config = ENTRY_POINT_CONFIG[type];
          const meta = config?.metaField ? a[config.metaField]?.toString() : undefined;
          return (
            <MenuItem key={key} value={key}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                <Chip label={config?.label} size="small" sx={{ bgcolor: config?.bgColor, color: config?.color, fontWeight: 700, fontSize: 11, minWidth: 60, justifyContent: 'center' }} />
                <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                  {a.name?.toString()}
                </Typography>
                {meta && (
                  <Typography variant="body2" color="text.secondary">
                    {meta}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          );
        })}
      </Select>
      {selectedEntry && (
        <EntryPointDetail
          selected={{ artifact: selectedEntry.artifact, artifactType: selectedEntry.type, envId, componentId, projectId }}
          onViewSource={() => onOpenDrawer(selectedEntry.artifact, selectedEntry.type, envId, 'Source')}
          onViewRuntimes={() => onOpenDrawer(selectedEntry.artifact, selectedEntry.type, envId, 'Runtimes')}
        />
      )}
    </>
  );
}

function Environment({
  env,
  componentId,
  projectId,
  componentType,
  onSelectArtifact,
  onOpenDrawerForTab,
}: {
  env: GqlEnvironment;
  componentId: string;
  projectId: string;
  componentType: string;
  onSelectArtifact: (a: GqlArtifact, type: string, envId: string) => void;
  onOpenDrawerForTab: (a: GqlArtifact, type: string, envId: string, tab: string) => void;
}) {
  const refreshEnvironmentArtifacts = useRefreshEnvironmentArtifacts();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'entryPoints' | 'allArtifacts'>('entryPoints');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshEnvironmentArtifacts(env.id, componentId);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {env.name}
          </Typography>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconButton size="small" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw
                size={16}
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  transformOrigin: 'center',
                }}
              />
            </IconButton>
            <Button variant="contained">Configure Runtime</Button>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        {componentType === 'MI' && (
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="overline">VIEW MODE</Typography>
            <Stack direction="row">
              <Button variant={viewMode === 'entryPoints' ? 'contained' : 'outlined'} size="small" startIcon={<ListFilter size={14} />} onClick={() => setViewMode('entryPoints')} sx={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
                Entry Points
              </Button>
              <Button variant={viewMode === 'allArtifacts' ? 'contained' : 'outlined'} size="small" startIcon={<LayoutGrid size={14} />} onClick={() => setViewMode('allArtifacts')} sx={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, ml: '-1px' }}>
                All Artifacts
              </Button>
            </Stack>
          </Stack>
        )}
        {(componentType !== 'MI' || viewMode === 'entryPoints') && <EntryPointsList envId={env.id} componentId={componentId} projectId={projectId} componentType={componentType} onOpenDrawer={onOpenDrawerForTab} />}
        {componentType === 'MI' && viewMode === 'allArtifacts' && <ArtifactTypeSelector envId={env.id} componentId={componentId} onSelectArtifact={onSelectArtifact} />}
      </CardContent>
    </Card>
  );
}

export default function Component(scope: ComponentScope): JSX.Element {
  const { data: component, isLoading } = useComponentByHandler(scope.project, scope.component);
  const { data: environments = [] } = useEnvironments(scope.project);
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null);

  // Load component permissions using the UUID - only when component is loaded
  useLoadComponentPermissions(scope.org, scope.project, component?.id || '');

  if (isLoading)
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  if (!component) return <NotFound message="Component not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <Box sx={{ position: 'relative', overflow: 'hidden', flex: 1 }}>
        <PageContent>
          <Stack component="header" direction="row" alignItems="center" gap={2} sx={{ mb: 1 }}>
            <Avatar sx={{ width: 56, height: 56, fontSize: 24, bgcolor: 'text.primary', color: 'background.paper' }}>{component.displayName?.[0]?.toUpperCase() ?? 'C'}</Avatar>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {component.displayName ?? scope.component}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, ml: 9 }}>
            {component.description || '+ Add Description'}
          </Typography>
          {environments.map((env) => (
            <Environment
              key={env.id}
              env={env}
              componentId={component.id}
              projectId={scope.project}
              componentType={component.componentType}
              onSelectArtifact={(a, type, envId) => setSelectedArtifact({ artifact: a, artifactType: type, envId, componentId: component.id, projectId: scope.project })}
              onOpenDrawerForTab={(a, type, envId, tab) => setSelectedArtifact({ artifact: a, artifactType: type, envId, componentId: component.id, projectId: scope.project, initialTab: tab })}
            />
          ))}
        </PageContent>
        <ArtifactDetail selected={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
      </Box>
    </>
  );
}
