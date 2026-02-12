import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  PageContent,
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
import { ChevronRight, Maximize2, RefreshCw, X } from '@wso2/oxygen-ui-icons-react';
import { Globe, Link2, ArrowRightLeft, Inbox, ListOrdered, Clock, FolderArchive, Package, Plug, FileText } from '@wso2/oxygen-ui-icons-react';
import SearchField from '../components/SearchField';
import { useEffect, useState, type JSX } from 'react';
import { useComponentByHandler, useEnvironments, useArtifactTypes, useArtifacts, useArtifactSource, useLocalEntryValue, ARTIFACT_TYPE_TO_SOURCE_TYPE, type GqlEnvironment, type GqlArtifact, ARTIFACT_QUERY_MAP } from '../api/queries';
import { useUpdateArtifactStatus } from '../api/mutations';
import NotFound from '../components/NotFound';
import { resourceUrl, broaden, type ComponentScope } from '../nav';

/** "RestApi" → "Rest Apis", "ProxyService" → "Proxy Services" */
function typePlural(t: string): string {
  return t.replace(/([a-z])([A-Z])/g, '$1 $2') + 's';
}

const ARTIFACT_ICONS: Record<string, JSX.Element> = {
  RestApi: <Globe size={18} />,
  ProxyService: <ArrowRightLeft size={18} />,
  Endpoint: <Link2 size={18} />,
  InboundEndpoint: <Inbox size={18} />,
  Sequence: <ListOrdered size={18} />,
  Task: <Clock size={18} />,
  LocalEntry: <FileText size={18} />,
  CarbonApp: <Package size={18} />,
  Connector: <Plug size={18} />,
  RegistryResource: <FolderArchive size={18} />,
};

const ARTIFACT_TABS: Record<string, string[]> = {
  RestApi: ['Overview', 'Source', 'API definition', 'Runtimes'],
  ProxyService: ['Overview', 'Endpoints', 'WSDL', 'Runtimes'],
  Task: ['Runtimes'],
  LocalEntry: ['Value', 'Runtimes'],
  CarbonApp: ['Artifacts', 'Runtimes'],
  Connector: ['Runtimes'],
  RegistryResource: ['Runtimes'],
};
const DEFAULT_ARTIFACT_TABS = ['Overview', 'Source', 'Runtimes'];

interface SelectedArtifact {
  artifact: GqlArtifact;
  artifactType: string;
  envId: string;
  componentId: string;
  projectId: string;
}

const cellSx = { borderBottom: '1px solid', borderColor: 'divider' };
const labelSx = { ...cellSx, fontWeight: 600, textTransform: 'capitalize', width: 180 };
const preSx = { p: 2, bgcolor: 'action.hover', borderRadius: 1, overflow: 'auto', fontSize: 12, fontFamily: 'monospace', maxHeight: 500 };
const emptySx = { color: 'text.secondary', py: 2 };

function Toggle({ checked }: { checked: boolean }) {
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Switch size="small" checked={checked} />
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

function ArtifactOverview({ artifact, artifactType }: TabProps) {
  const artifactMapping = ARTIFACT_QUERY_MAP[artifactType];
  if (!artifactMapping) return null;
  const isProxyService = artifactType === 'ProxyService';
  const fields = artifactMapping.fields.split(', ');
  const tracing = (artifact.tracing ?? 'disabled').toString().toLowerCase();
  const artifactState = (artifact.state ?? '').toString().toLowerCase();
  const endpoints = (artifact.endpoints as string[] | undefined) ?? [];
  const attributes = (artifact.attributes as Array<{ name: string; value?: string }> | undefined) ?? [];

  const formatFieldValue = (f: string) => {
    const val = artifact[f];
    return f === 'version' && !val ? 'N/A' : (val ?? 'N/A').toString();
  };

  return (
    <Stack gap={2}>
      <Table size="small">
        <TableBody>
          {fields.map((f) => (
            <TableRow key={f}>
              <TableCell sx={labelSx}>{f}</TableCell>
              <TableCell sx={cellSx}>{isProxyService && f === 'state' ? <Chip label={formatFieldValue(f).toUpperCase()} size="small" color={artifactState === 'enabled' ? 'success' : 'default'} /> : formatFieldValue(f)}</TableCell>
            </TableRow>
          ))}
          {isProxyService && (
            <TableRow>
              <TableCell sx={labelSx}>Enable/Disable</TableCell>
              <TableCell sx={cellSx}>
                <Toggle checked={artifactState === 'enabled'} />
              </TableCell>
            </TableRow>
          )}
          <TableRow>
            <TableCell sx={labelSx}>Tracing</TableCell>
            <TableCell sx={cellSx}>
              <Toggle checked={tracing === 'enabled'} />
            </TableCell>
          </TableRow>
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

function ArtifactWsdl(_props: TabProps) {
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
    setActiveTabIndex(0);
  }, [artifactKey]);

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
  const toggleStatus = useUpdateArtifactStatus();
  const artifactMapping = ARTIFACT_QUERY_MAP[artifactType];
  if (!artifactMapping) return null;

  const columns = artifactMapping.fields.split(', ').filter((f) => f !== 'state' && f !== 'container');
  const filtered = artifacts.filter((a) => !query || a.name?.toString().toLowerCase().includes(query.toLowerCase()));
  const supportsToggle = ['ProxyService', 'Endpoint', 'Task'].includes(artifactType);
  const hasStateField = ['ProxyService', 'Task', 'Connector'].includes(artifactType);
  const maxPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);
  const paginatedArtifacts = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);
  const totalColumns = columns.length + (hasStateField ? 1 : 0);
  const columnSize = Math.floor(12 / totalColumns);

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
                      toggleStatus.mutate({ envId, componentId, artifactType, artifactName: a.name, status: enabled ? 'inactive' : 'active' });
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
    </>
  );
}

function ArtifactTypeSelector({ envId, componentId, onSelectArtifact }: { envId: string; componentId: string; onSelectArtifact: (a: GqlArtifact, type: string, envId: string) => void }) {
  const { data: types = [], isLoading } = useArtifactTypes(componentId, envId);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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
              <ListItemText primary={t.artifactType} />
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

function Environment({ env, componentId, onSelectArtifact }: { env: GqlEnvironment; componentId: string; onSelectArtifact: (a: GqlArtifact, type: string, envId: string) => void }) {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {env.name}
          </Typography>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconButton size="small">
              <RefreshCw size={16} />
            </IconButton>
            <Button variant="contained">Configure Runtime</Button>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <ArtifactTypeSelector envId={env.id} componentId={componentId} onSelectArtifact={onSelectArtifact} />
      </CardContent>
    </Card>
  );
}

export default function Component(scope: ComponentScope): JSX.Element {
  const { data: component, isLoading } = useComponentByHandler(scope.project, scope.component);
  const { data: environments = [] } = useEnvironments(scope.project);
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null);

  if (isLoading)
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  if (!component) return <NotFound message="Component not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;

  return (
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
          <Environment key={env.id} env={env} componentId={component.id} onSelectArtifact={(a, type, envId) => setSelectedArtifact({ artifact: a, artifactType: type, envId, componentId: component.id, projectId: scope.project })} />
        ))}
      </PageContent>
      <ArtifactDetail selected={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
    </Box>
  );
}
