/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com).
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
  AppShell,
  Badge,
  Button,
  ColorSchemeToggle,
  ComplexSelect,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Footer,
  formatRelativeTime,
  Header,
  IconButton,
  InputAdornment,
  MenuItem,
  NotificationPanel,
  Box,
  Popover,
  Sidebar,
  TextField,
  Tooltip,
  Typography,
  UserMenu,
  useAppShell,
  useNotifications,
} from '@wso2/oxygen-ui';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { JSX } from 'react';
import { useNavigate, Outlet, NavLink } from 'react-router';
import Logo from '../components/Logo';
import { BarChart3, Bell, ChevronDown, ChevronRight, Layers, LayoutDashboard, LogOut, Plus, ScrollText, Search, Server, Shield, Sliders, User as UserIcon, X } from '@wso2/oxygen-ui-icons-react';
import { useProject, useProjectByHandler, useProjects, useComponents, useOrgs } from '../api/queries';
import { fetchOrgPermissions } from '../api/auth';
import { authenticatedFetch, switchOrgToken } from '../auth/tokenManager';
import { mockNotifications } from '../mock-data/mockNotifications';
import { useScope, useResource, resourceUrl, broaden, narrow, newProjectUrl, newComponentUrl, sidebarItems, hasProject, hasComponent, type Resource } from '../nav';
import { componentOverviewUrl, cookiePolicyUrl, loginUrl, orgHomeUrl, privacyPolicyUrl, profileUrl, projectHomeUrl } from '../paths';
import { useAuth } from '../auth/AuthContext';
import { useAccessControl } from '../contexts/AccessControlContext';
import { ALL_USER_MGT_PERMISSIONS, Permissions } from '../constants/permissions';

const SIDEBAR_ICONS: Record<Resource, JSX.Element> = {
  overview: <LayoutDashboard size={20} />,
  logs: <ScrollText size={20} />,
  loggers: <Sliders size={20} />,
  metrics: <BarChart3 size={20} />,
  runtimes: <Server size={20} />,
  environments: <Layers size={20} />,
  'access-control': <Shield size={20} />,
};

const SIDEBAR_CATEGORIES: { label: string; resources: Resource[] }[] = [
  { label: '', resources: ['overview'] },
  { label: 'Observability', resources: ['logs', 'loggers', 'metrics'] },
  { label: 'Infrastructure', resources: ['runtimes', 'environments'] },
  { label: 'Management', resources: ['access-control'] },
];

export default function AppLayout(): JSX.Element {
  const navigate = useNavigate();
  const scope = useScope();
  const resource = useResource();

  const queryClient = useQueryClient();
  const { username, displayName, logout, userId, isOidcUser } = useAuth();
  const { hasAnyPermission, setOrgPermissions } = useAccessControl();

  const { state: shell, actions } = useAppShell({ initialCollapsed: true });
  const [tabIndex, setTabIndex] = useState(0);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const orgCardRef = useRef<HTMLDivElement>(null);
  const projectCardRef = useRef<HTMLDivElement>(null);
  const integrationCardRef = useRef<HTMLDivElement>(null);
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<HTMLElement | null>(null);
  const [projectMenuDir, setProjectMenuDir] = useState<'right' | 'below'>('right');
  const [projectSearch, setProjectSearch] = useState('');
  const [componentMenuAnchor, setComponentMenuAnchor] = useState<HTMLElement | null>(null);
  const [componentMenuDir, setComponentMenuDir] = useState<'right' | 'below'>('right');
  const [componentSearch, setComponentSearch] = useState('');
  const [orgMenuAnchor, setOrgMenuAnchor] = useState<HTMLElement | null>(null);
  const [orgSearch, setOrgSearch] = useState('');
  const { data: orgsData = [] } = useOrgs();

  const { notifications, actions: notifActions, unreadCount, unreadNotifications } = useNotifications({ initialNotifications: [...mockNotifications] });
  const alertNotifications = notifications.filter((n) => n.type === 'warning' || n.type === 'error');
  const getFilteredNotifications = () => {
    if (tabIndex === 1) return unreadNotifications;
    if (tabIndex === 2) return alertNotifications;
    return notifications;
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const projectParam = hasProject(scope) ? scope.project : '';
  const isProjectUuid = UUID_RE.test(projectParam);
  const { data: projectByHandler } = useProjectByHandler(!isProjectUuid ? projectParam : '');
  const { data: projectById } = useProject(isProjectUuid ? projectParam : '');
  const project = isProjectUuid ? projectById : projectByHandler;
  const projectId = project?.id ?? '';
  const { data: projects = [] } = useProjects();
  const { data: components = [] } = useComponents(scope.org, projectId);

  // Helper to get project display name with fallback to projects list
  const getProjectDisplayName = () => {
    if (project?.name) return project.name;
    // Fallback: search in projects list by handler or id
    if (hasProject(scope)) {
      const foundProject = projects.find((p) => p.handler === scope.project || p.id === scope.project || String(p.id) === scope.project);
      if (foundProject?.name) return foundProject.name;
      return isProjectUuid ? 'Loading...' : scope.project;
    }
    return '';
  };

  // Helper to get component display name with fallback to components list
  const getComponentDisplayName = () => {
    if (currentComponent?.displayName) return currentComponent.displayName;
    // Fallback: search in components list by handler or id
    if (hasComponent(scope)) {
      const foundComponent = components.find((c) => c.handler === scope.component || c.id === scope.component || String(c.id) === scope.component);
      if (foundComponent?.displayName) return foundComponent.displayName;
      // If still showing UUID, show loading instead
      const isUuid = UUID_RE.test(scope.component);
      return isUuid ? 'Loading...' : scope.component;
    }
    return '';
  };

  const orgPermsLoadedRef = useRef('');
  useEffect(() => {
    if (!userId || !scope.org || orgPermsLoadedRef.current === scope.org) return;
    orgPermsLoadedRef.current = scope.org;
    if (isOidcUser) {
      // OIDC users are authorized via Choreo STS — grant all ICP permissions locally
      setOrgPermissions(Object.values(Permissions));
      return;
    }
    fetchOrgPermissions(scope.org, userId)
      .then((data) => setOrgPermissions(data.permissionNames))
      .catch(() => setOrgPermissions([]));
  }, [scope.org, userId, isOidcUser, setOrgPermissions]);

  // Recover org numeric ID if it was not saved during OIDC callback (e.g. old sessions)
  const [, setOrgIdVersion] = useState(0);
  const orgIdFetchedRef = useRef(false);
  useEffect(() => {
    if (!isOidcUser || !userId || window.API_CONFIG.asgardeoOrgNumericId || orgIdFetchedRef.current) return;
    orgIdFetchedRef.current = true;
    authenticatedFetch(`${window.API_CONFIG.choreoOrgApiUrl}/orgs`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const orgs: Array<{ handle?: string; orgHandle?: string; org_handle?: string; id?: string | number; orgId?: string | number }> = data.list ?? data.organizations ?? (Array.isArray(data) ? data : []);
        for (const org of orgs) {
          const numericId = org.id ?? org.orgId;
          if (numericId) {
            const parsedId = typeof numericId === 'string' ? parseInt(numericId, 10) : numericId;
            if (!isNaN(parsedId) && parsedId > 0) {
              window.API_CONFIG.asgardeoOrgNumericId = parsedId;
              localStorage.setItem('icp_org_numeric_id', String(parsedId));
              setOrgIdVersion((v) => v + 1); // trigger re-render so queries re-evaluate orgId()
            }
            break;
          }
        }
      })
      .catch(() => {});
  }, [isOidcUser, userId]);

  // Find component UUID for permission checks
  const currentComponent = hasComponent(scope) ? components.find((c) => c.handler === scope.component) : undefined;
  const componentId = currentComponent?.id;

  /** Returns the resource if the user has permission at the target scope, or 'overview' as fallback. */
  const canAccessResource = (targetScope: Parameters<typeof hasProject>[0], target: Resource, targetProjectId: string | undefined = projectId || undefined, targetComponentId: string | undefined = componentId): Resource => {
    switch (target) {
      case 'overview':
        return 'overview';
      case 'access-control': {
        const perms: string[] = [...ALL_USER_MGT_PERMISSIONS];
        if (hasProject(targetScope)) perms.push(Permissions.PROJECT_EDIT, Permissions.PROJECT_MANAGE);
        if (hasComponent(targetScope)) perms.push(Permissions.INTEGRATION_EDIT, Permissions.INTEGRATION_MANAGE);
        return hasAnyPermission(perms, targetProjectId, targetComponentId) ? 'access-control' : 'overview';
      }
      case 'logs':
        return 'logs';
      case 'loggers':
        return 'loggers';
      case 'metrics':
        return 'metrics';
      case 'runtimes':
        return 'runtimes';
      case 'environments':
        return 'environments';
    }
  };

  const accessControlPerms: string[] = [...ALL_USER_MGT_PERMISSIONS];
  if (hasProject(scope)) {
    accessControlPerms.push(Permissions.PROJECT_EDIT, Permissions.PROJECT_MANAGE);
  }
  if (hasComponent(scope)) {
    accessControlPerms.push(Permissions.INTEGRATION_EDIT, Permissions.INTEGRATION_MANAGE);
  }
  const canSeeAccessControl = hasAnyPermission(accessControlPerms, projectId || undefined, componentId);
  const items = sidebarItems(scope, resource).filter((item) => item.resource !== 'access-control' || canSeeAccessControl);

  return (
    <AppShell>
      <AppShell.Navbar>
        <Header>
          <Header.Toggle collapsed={shell.sidebarCollapsed} onToggle={actions.toggleSidebar} />
          <Header.Brand>
            <Header.BrandLogo>
              <NavLink to={orgHomeUrl(scope.org)} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                <Logo />
              </NavLink>
            </Header.BrandLogo>
          </Header.Brand>
          <Header.Switchers showDivider={false}>
            <Box
              ref={orgCardRef}
              role="button"
              tabIndex={0}
              sx={{ display: 'inline-flex', alignSelf: 'center', cursor: 'pointer' }}
              onClick={() => setOrgMenuAnchor(orgCardRef.current)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOrgMenuAnchor(orgCardRef.current);
                }
              }}>
              <ComplexSelect
                value={scope.org}
                open={false}
                onChange={() => {}}
                onOpen={() => {}}
                size="small"
                sx={{ minWidth: 180 }}
                IconComponent={({ ownerState: _ownerState, ...props }) => (
                  <span {...props} aria-hidden="true" style={{ position: 'absolute', top: 'auto', bottom: '0', right: '6px', display: 'flex', pointerEvents: 'none' }}>
                    <ChevronDown size={18} />
                  </span>
                )}
                SelectDisplayProps={{ 'aria-label': 'Select organization' }}
                renderValue={() => <ComplexSelect.MenuItem.Text primary={scope.org} secondary="Organization" />}
                label="Organization">
                <ComplexSelect.MenuItem value={scope.org}>
                  <ComplexSelect.MenuItem.Text primary={scope.org} secondary="Organization" />
                </ComplexSelect.MenuItem>
              </ComplexSelect>
            </Box>
            <Popover
              anchorEl={orgMenuAnchor}
              open={Boolean(orgMenuAnchor)}
              onClose={() => {
                setOrgMenuAnchor(null);
                setOrgSearch('');
              }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              PaperProps={{ sx: { width: 260, mt: 0.5 } }}>
              <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Organization
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search"
                  autoFocus
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Search size={16} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Divider />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1, pb: 0.5 }}>
                All Organizations
              </Typography>
              {(orgsData.length > 0 ? orgsData : [{ handle: scope.org, numericId: 0 }])
                .filter((o) => !orgSearch.trim() || o.handle.toLowerCase().includes(orgSearch.trim().toLowerCase()))
                .map((o) => (
                  <MenuItem
                    key={o.handle}
                    selected={scope.org === o.handle}
                    onClick={() => {
                      setOrgMenuAnchor(null);
                      setOrgSearch('');
                      if (o.handle === scope.org) {
                        navigate(orgHomeUrl(o.handle));
                        return;
                      }
                      switchOrgToken(o.handle)
                        .then(() => {
                          if (o.numericId > 0) {
                            window.API_CONFIG.asgardeoOrgNumericId = o.numericId;
                            localStorage.setItem('icp_org_numeric_id', String(o.numericId));
                          }
                          queryClient.clear();
                          navigate(orgHomeUrl(o.handle));
                        })
                        .catch(() => navigate(orgHomeUrl(o.handle)));
                    }}>
                    {o.handle}
                  </MenuItem>
                ))}
            </Popover>
            {!hasProject(scope) && !projectMenuAnchor && (
              <Tooltip title="Select project">
                <IconButton
                  size="small"
                  onClick={() => {
                    setProjectMenuDir('right');
                    setProjectMenuAnchor(orgCardRef.current);
                  }}>
                  <ChevronRight size={18} />
                </IconButton>
              </Tooltip>
            )}
            <Popover
              anchorEl={projectMenuAnchor}
              open={Boolean(projectMenuAnchor)}
              onClose={() => {
                setProjectMenuAnchor(null);
                setProjectSearch('');
              }}
              anchorOrigin={projectMenuDir === 'right' ? { vertical: 'top', horizontal: 'right' } : { vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              marginThreshold={projectMenuDir === 'right' ? 0 : undefined}
              PaperProps={{ sx: { width: 260, ...(projectMenuDir === 'right' ? { ml: 1 } : { mt: 0.5 }) } }}>
              <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Project
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search"
                  autoFocus
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Search size={16} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Button
                variant="text"
                size="small"
                startIcon={<Plus size={16} />}
                fullWidth
                sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
                onClick={() => {
                  setProjectMenuAnchor(null);
                  setProjectSearch('');
                  navigate(newProjectUrl({ org: scope.org }));
                }}>
                Create Project
              </Button>
              <Divider />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1, pb: 0.5 }}>
                All Projects
              </Typography>
              {projects.filter((p) => !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.trim().toLowerCase())).length === 0 ? (
                <MenuItem disabled>No projects found</MenuItem>
              ) : (
                projects
                  .filter((p) => !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()))
                  .map((p) => (
                    <MenuItem
                      key={p.id}
                      selected={hasProject(scope) && (scope.project === p.handler || scope.project === p.id)}
                      onClick={() => {
                        setProjectMenuAnchor(null);
                        setProjectSearch('');
                        const newScope = narrow({ level: 'organizations', org: scope.org }, p.id);
                        const target = resource ?? 'overview';
                        const resolvedTarget = canAccessResource(newScope, target, p.id, undefined);
                        navigate(resolvedTarget === 'overview' ? projectHomeUrl(scope.org, p.id) : resourceUrl(newScope, resolvedTarget));
                      }}>
                      {p.name}
                    </MenuItem>
                  ))
              )}
            </Popover>
            {hasProject(scope) && (
              <>
                <Box
                  ref={projectCardRef}
                  role="button"
                  tabIndex={0}
                  sx={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}
                  onClick={() => navigate(resourceUrl({ level: 'projects' as const, org: scope.org, project: scope.project }, 'overview'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(resourceUrl({ level: 'projects' as const, org: scope.org, project: scope.project }, 'overview'));
                    }
                  }}>
                  <ComplexSelect
                    value={project?.handler ?? scope.project}
                    open={false}
                    onChange={() => {}}
                    onOpen={() => {}}
                    size="small"
                    sx={{ minWidth: 160 }}
                    IconComponent={({ ownerState: _ownerState, ...props }) => (
                      <span
                        {...props}
                        role="button"
                        tabIndex={0}
                        aria-label="Change project"
                        style={{ position: 'absolute', top: 'auto', bottom: '0', right: '6px', display: 'flex', pointerEvents: 'all', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectMenuDir('below');
                          setProjectMenuAnchor(projectCardRef.current);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setProjectMenuDir('below');
                            setProjectMenuAnchor(projectCardRef.current);
                          }
                        }}>
                        <ChevronDown size={18} />
                      </span>
                    )}
                    SelectDisplayProps={{ 'aria-label': 'Select project' }}
                    renderValue={() => <ComplexSelect.MenuItem.Text primary={getProjectDisplayName()} secondary="Project" />}
                    label="Projects">
                    {/* Placeholder item so renderValue fires while project is loading by UUID */}
                    {isProjectUuid && !project && (
                      <ComplexSelect.MenuItem key="__uuid_placeholder__" value={scope.project} sx={{ display: 'none' }}>
                        <ComplexSelect.MenuItem.Text primary={getProjectDisplayName()} secondary="Project" />
                      </ComplexSelect.MenuItem>
                    )}
                    {projects.map((p) => (
                      <ComplexSelect.MenuItem key={p.handler} value={p.handler}>
                        <ComplexSelect.MenuItem.Text primary={p.name} secondary={p.description} />
                      </ComplexSelect.MenuItem>
                    ))}
                  </ComplexSelect>
                  <IconButton
                    size="small"
                    aria-label="Clear project"
                    sx={{ position: 'absolute', top: '3px', right: '3px' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const orgScope = { level: 'organizations' as const, org: scope.org };
                      const target = resource ?? 'overview';
                      const resolvedOrgTarget = canAccessResource(orgScope, target);
                      navigate(resolvedOrgTarget === 'overview' ? orgHomeUrl(scope.org) : resourceUrl(orgScope, resolvedOrgTarget));
                    }}>
                    <X size={16} />
                  </IconButton>
                </Box>
                {!hasComponent(scope) && !componentMenuAnchor && (
                  <Tooltip title="Select integration">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setComponentMenuDir('right');
                        setComponentMenuAnchor(projectCardRef.current);
                      }}>
                      <ChevronRight size={18} />
                    </IconButton>
                  </Tooltip>
                )}
                <Popover
                  anchorEl={componentMenuAnchor}
                  open={Boolean(componentMenuAnchor)}
                  onClose={() => {
                    setComponentMenuAnchor(null);
                    setComponentSearch('');
                  }}
                  anchorOrigin={componentMenuDir === 'right' ? { vertical: 'top', horizontal: 'right' } : { vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  marginThreshold={componentMenuDir === 'right' ? 0 : undefined}
                  PaperProps={{ sx: { width: 260, ...(componentMenuDir === 'right' ? { ml: 1 } : { mt: 0.5 }) } }}>
                  <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Integration
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Search"
                      autoFocus
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Search size={16} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<Plus size={16} />}
                    fullWidth
                    sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
                    onClick={() => {
                      setComponentMenuAnchor(null);
                      setComponentSearch('');
                      navigate(newComponentUrl({ org: scope.org, project: scope.project }));
                    }}>
                    Create Integration
                  </Button>
                  <Divider />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1, pb: 0.5 }}>
                    All Integrations
                  </Typography>
                  {components.filter((c) => !componentSearch.trim() || c.displayName.toLowerCase().includes(componentSearch.trim().toLowerCase())).length === 0 ? (
                    <MenuItem disabled>No integrations found</MenuItem>
                  ) : (
                    components
                      .filter((c) => !componentSearch.trim() || c.displayName.toLowerCase().includes(componentSearch.trim().toLowerCase()))
                      .map((c) => (
                        <MenuItem
                          key={c.id}
                          selected={hasComponent(scope) && scope.component === c.handler}
                          onClick={() => {
                            setComponentMenuAnchor(null);
                            setComponentSearch('');
                            const newScope = narrow({ level: 'projects', org: scope.org, project: scope.project }, c.handler);
                            const resolvedTarget = canAccessResource(newScope, resource ?? 'overview', projectId, c.id);
                            navigate(resolvedTarget === 'overview' ? componentOverviewUrl(scope.org, scope.project, c.handler) : resourceUrl(newScope, resolvedTarget));
                          }}>
                          {c.displayName}
                        </MenuItem>
                      ))
                  )}
                </Popover>
              </>
            )}
            {hasComponent(scope) && (
              <Box
                ref={integrationCardRef}
                role="button"
                tabIndex={0}
                sx={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}
                onClick={() => navigate(resourceUrl(scope, 'overview'))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(resourceUrl(scope, 'overview'));
                  }
                }}>
                <ComplexSelect
                  value={scope.component}
                  open={false}
                  onChange={() => {}}
                  onOpen={() => {}}
                  size="small"
                  sx={{ minWidth: 160 }}
                  IconComponent={({ ownerState: _ownerState, ...props }) => (
                    <span
                      {...props}
                      role="button"
                      tabIndex={0}
                      aria-label="Change integration"
                      style={{ position: 'absolute', top: 'auto', bottom: '0', right: '6px', display: 'flex', pointerEvents: 'all', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setComponentMenuDir('below');
                        setComponentMenuAnchor(integrationCardRef.current);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setComponentMenuDir('below');
                          setComponentMenuAnchor(integrationCardRef.current);
                        }
                      }}>
                      <ChevronDown size={18} />
                    </span>
                  )}
                  SelectDisplayProps={{ 'aria-label': 'Select integration' }}
                  renderValue={() => <ComplexSelect.MenuItem.Text primary={getComponentDisplayName()} secondary="Integration" />}
                  label="Integrations">
                  {/* Fallback keeps the value valid while components are loading */}
                  {!components.some((c) => c.handler === scope.component) && (
                    <ComplexSelect.MenuItem key="__current" value={scope.component} sx={{ display: 'none' }}>
                      <ComplexSelect.MenuItem.Text primary="" secondary="" />
                    </ComplexSelect.MenuItem>
                  )}
                  {components.map((c) => (
                    <ComplexSelect.MenuItem key={c.id} value={c.handler}>
                      <ComplexSelect.MenuItem.Text primary={c.displayName} secondary={c.displayType} />
                    </ComplexSelect.MenuItem>
                  ))}
                </ComplexSelect>
                <IconButton
                  size="small"
                  aria-label="Clear integration"
                  sx={{ position: 'absolute', top: '3px', right: '3px' }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const projectScope = broaden(scope)!;
                    const target = resource ?? 'overview';
                    navigate(resourceUrl(projectScope, canAccessResource(projectScope, target)));
                  }}>
                  <X size={16} />
                </IconButton>
              </Box>
            )}
          </Header.Switchers>
          <Header.Spacer />
          <Header.Actions>
            <ColorSchemeToggle />
            <Tooltip title="Notifications">
              <IconButton onClick={actions.toggleNotificationPanel} size="small" sx={{ color: 'text.secondary' }}>
                <Badge badgeContent={unreadCount ?? 0} color="error" max={99} invisible={(unreadCount ?? 0) === 0}>
                  <Bell size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 1, display: { xs: 'none', sm: 'block' } }} />
            <UserMenu>
              <UserMenu.Trigger name={displayName || username || 'User'} />
              <UserMenu.Header name={displayName || username || 'User'} email={username} role="Admin" />
              <UserMenu.Item icon={<UserIcon size={18} />} label="Profile" onClick={() => navigate(profileUrl())} />
              <UserMenu.Divider />
              <UserMenu.Logout icon={<LogOut size={18} />} label="Sign Out" onClick={() => setConfirmDialogOpen(true)} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </AppShell.Navbar>

      <AppShell.Sidebar>
        <Sidebar
          collapsed={shell.sidebarCollapsed}
          activeItem={resource ?? 'overview'}
          expandedMenus={shell.expandedMenus}
          onSelect={(id) => {
            if (id === 'expand') {
              actions.toggleSidebar();
            } else {
              const item = items.find((i) => i.resource === id);
              if (item) navigate(item.url);
            }
          }}
          onToggleExpand={actions.toggleMenu}
          sx={{ backgroundColor: 'background.acrylic', backdropFilter: 'blur(3px)' }}>
          <Sidebar.Nav>
            {SIDEBAR_CATEGORIES.map(({ label, resources }) => {
              const catItems = items.filter((item) => resources.includes(item.resource));
              if (catItems.length === 0) return null;
              return (
                <Sidebar.Category key={label || 'main'}>
                  {label && <Sidebar.CategoryLabel>{label}</Sidebar.CategoryLabel>}
                  {catItems.map((item) => (
                    <Sidebar.Item key={item.resource} id={item.resource}>
                      <Sidebar.ItemIcon>{SIDEBAR_ICONS[item.resource]}</Sidebar.ItemIcon>
                      <Sidebar.ItemLabel>{item.label}</Sidebar.ItemLabel>
                    </Sidebar.Item>
                  ))}
                </Sidebar.Category>
              );
            })}
          </Sidebar.Nav>

          <Sidebar.Footer sx={{ py: 0 }}>
            <Sidebar.Category sx={{ mb: 0 }}>
              <Sidebar.Item id="expand" sx={{ minHeight: 0, py: '15px' }}>
                <Sidebar.ItemIcon>
                  <ChevronRight size={20} style={{ transform: shell.sidebarCollapsed ? 'none' : 'rotate(180deg)' }} />
                </Sidebar.ItemIcon>
                <Sidebar.ItemLabel>{shell.sidebarCollapsed ? 'Expand' : 'Collapse'}</Sidebar.ItemLabel>
              </Sidebar.Item>
            </Sidebar.Category>
          </Sidebar.Footer>
        </Sidebar>
      </AppShell.Sidebar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer>
        <Footer>
          <Footer.Link
            href={privacyPolicyUrl()}
            onClick={(e) => {
              if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented) {
                e.preventDefault();
                navigate(privacyPolicyUrl());
              }
            }}>
            Privacy Policy
          </Footer.Link>
          <Footer.Link
            href={cookiePolicyUrl()}
            onClick={(e) => {
              if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented) {
                e.preventDefault();
                navigate(cookiePolicyUrl());
              }
            }}>
            Cookie Policy
          </Footer.Link>
          <Footer.Link href="#support">Support</Footer.Link>
          <Footer.Copyright>&copy; {new Date().getFullYear()}, WSO2 LLC.</Footer.Copyright>
        </Footer>
      </AppShell.Footer>

      <AppShell.NotificationPanel>
        <NotificationPanel open={shell.notificationPanelOpen} onClose={actions.toggleNotificationPanel}>
          <NotificationPanel.Header>
            <NotificationPanel.HeaderIcon>
              <Bell size={20} />
            </NotificationPanel.HeaderIcon>
            <NotificationPanel.HeaderTitle>Notifications</NotificationPanel.HeaderTitle>
            {unreadCount > 0 && <NotificationPanel.HeaderBadge>{unreadCount}</NotificationPanel.HeaderBadge>}
            <NotificationPanel.HeaderClose />
          </NotificationPanel.Header>
          <NotificationPanel.Tabs
            tabs={[
              { label: 'All', count: notifications.length },
              {
                label: 'Unread',
                count: unreadNotifications.length,
                color: 'primary',
              },
              {
                label: 'Alerts',
                count: alertNotifications.length,
                color: 'warning',
              },
            ]}
            value={tabIndex}
            onChange={setTabIndex}
          />
          {notifications.length > 0 && <NotificationPanel.Actions hasUnread={unreadNotifications.length > 0} onMarkAllRead={notifActions.markAllRead} onClearAll={notifActions.clearAll} />}
          {getFilteredNotifications().length === 0 ? (
            <NotificationPanel.EmptyState />
          ) : (
            <NotificationPanel.List>
              {getFilteredNotifications().map((notification) => (
                <NotificationPanel.Item key={notification.id} id={notification.id} type={notification.type ?? 'info'} read={notification.read} onMarkRead={notifActions.markRead} onDismiss={notifActions.dismiss}>
                  <NotificationPanel.ItemAvatar>{notification.avatar}</NotificationPanel.ItemAvatar>
                  <NotificationPanel.ItemTitle>{notification.title}</NotificationPanel.ItemTitle>
                  <NotificationPanel.ItemMessage>{notification.message}</NotificationPanel.ItemMessage>
                  <NotificationPanel.ItemTimestamp>{formatRelativeTime(notification.timestamp)}</NotificationPanel.ItemTimestamp>
                  {notification.actionLabel && <NotificationPanel.ItemAction>{notification.actionLabel}</NotificationPanel.ItemAction>}
                </NotificationPanel.Item>
              ))}
            </NotificationPanel.List>
          )}
        </NotificationPanel>

        {/* Confirm Dialog - managed locally */}
        <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Sign Out</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to sign out of your account?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={async () => {
                await logout();
                navigate(loginUrl());
                setConfirmDialogOpen(false);
              }}>
              Sign Out
            </Button>
          </DialogActions>
        </Dialog>
      </AppShell.NotificationPanel>
    </AppShell>
  );
}
