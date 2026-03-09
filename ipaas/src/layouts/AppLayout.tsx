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
  NotificationPanel,
  Box,
  Sidebar,
  Tooltip,
  UserMenu,
  useAppShell,
  useNotifications,
} from '@wso2/oxygen-ui';
import { useState } from 'react';
import type { JSX } from 'react';
import { useNavigate, Outlet } from 'react-router';
import Logo from '../components/Logo';
import { BarChart3, Bell, Building, ChevronDown, ChevronRight, Layers, LayoutDashboard, LogOut, ScrollText, Server, Shield, Sliders, User as UserIcon, X } from '@wso2/oxygen-ui-icons-react';
import { useProjectByHandler, useProjects, useComponents } from '../api/queries';
import { mockNotifications } from '../mock-data/mockNotifications';
import { useScope, useResource, resourceUrl, broaden, narrow, sidebarItems, hasProject, hasComponent, type Resource } from '../nav';
import { cookiePolicyUrl, loginUrl, privacyPolicyUrl, profileUrl } from '../paths';
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

  const { username, displayName, logout } = useAuth();
  const { hasAnyPermission } = useAccessControl();

  const { state: shell, actions } = useAppShell({ initialCollapsed: true });
  const [tabIndex, setTabIndex] = useState(0);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { notifications, actions: notifActions, unreadCount, unreadNotifications } = useNotifications({ initialNotifications: [...mockNotifications] });
  const alertNotifications = notifications.filter((n) => n.type === 'warning' || n.type === 'error');
  const getFilteredNotifications = () => {
    if (tabIndex === 1) return unreadNotifications;
    if (tabIndex === 2) return alertNotifications;
    return notifications;
  };

  const { data: project } = useProjectByHandler(hasProject(scope) ? scope.project : '');
  const projectId = project?.id ?? '';
  const { data: projects = [] } = useProjects();
  const { data: components = [] } = useComponents(scope.org, projectId);

  // Find component UUID for permission checks
  const currentComponent = hasComponent(scope) ? components.find((c) => c.handler === scope.component) : undefined;
  const componentId = currentComponent?.id;

  /** Returns the resource if the user has permission at the target scope, or 'overview' as fallback. */
  const canAccessResource = (targetScope: Parameters<typeof hasProject>[0], target: Resource): Resource => {
    switch (target) {
      case 'overview':
        return 'overview';
      case 'access-control': {
        const perms: string[] = [...ALL_USER_MGT_PERMISSIONS];
        if (hasProject(targetScope)) perms.push(Permissions.PROJECT_EDIT, Permissions.PROJECT_MANAGE);
        if (hasComponent(targetScope)) perms.push(Permissions.INTEGRATION_EDIT, Permissions.INTEGRATION_MANAGE);
        return hasAnyPermission(perms, projectId || undefined, componentId) ? 'access-control' : 'overview';
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
              <Logo />
            </Header.BrandLogo>
          </Header.Brand>
          <Header.Switchers showDivider={false}>
            <ComplexSelect
              value={scope.org}
              onChange={() => {}}
              size="small"
              sx={{ minWidth: 180 }}
              IconComponent={() => null}
              SelectDisplayProps={{ 'aria-label': 'Select organization' }}
              renderValue={() => (
                <>
                  <ComplexSelect.MenuItem.Icon>
                    <Building />
                  </ComplexSelect.MenuItem.Icon>
                  <ComplexSelect.MenuItem.Text primary="Default Organization" secondary="Organization" />
                </>
              )}
              label="Organizations">
              <ComplexSelect.MenuItem value="default">
                <ComplexSelect.MenuItem.Icon>
                  <Building />
                </ComplexSelect.MenuItem.Icon>
                <ComplexSelect.MenuItem.Text primary="Default Organization" secondary="Organization" />
              </ComplexSelect.MenuItem>
            </ComplexSelect>
            {hasProject(scope) && (
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <ComplexSelect
                  value={scope.project}
                  onChange={(e) => {
                    const newScope = narrow({ level: 'organizations', org: scope.org }, String(e.target.value));
                    const target = resource ?? 'overview';
                    navigate(resourceUrl(newScope, canAccessResource(newScope, target)));
                  }}
                  size="small"
                  sx={{ minWidth: 160 }}
                  IconComponent={({ ownerState: _ownerState, ...props }) => (
                    <span {...props} style={{ position: 'absolute', top: 'auto', bottom: '0', right: '6px', display: 'flex', pointerEvents: 'none' }}>
                      <ChevronDown size={18} />
                    </span>
                  )}
                  SelectDisplayProps={{ 'aria-label': 'Select project' }}
                  renderValue={() => <ComplexSelect.MenuItem.Text primary={project?.name ?? scope.project} secondary="Project" />}
                  label="Projects">
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
                    navigate(resourceUrl(orgScope, canAccessResource(orgScope, target)));
                  }}>
                  <X size={16} />
                </IconButton>
              </Box>
            )}
            {hasComponent(scope) && (
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <ComplexSelect
                  value={scope.component}
                  onChange={(e) => {
                    const newScope = narrow({ level: 'projects', org: scope.org, project: scope.project }, String(e.target.value));
                    const target = resource ?? 'overview';
                    navigate(resourceUrl(newScope, canAccessResource(newScope, target)));
                  }}
                  size="small"
                  sx={{ minWidth: 160 }}
                  IconComponent={({ ownerState: _ownerState, ...props }) => (
                    <span {...props} style={{ position: 'absolute', top: 'auto', bottom: '0', right: '6px', display: 'flex', pointerEvents: 'none' }}>
                      <ChevronDown size={18} />
                    </span>
                  )}
                  SelectDisplayProps={{ 'aria-label': 'Select integration' }}
                  renderValue={() => <ComplexSelect.MenuItem.Text primary={scope.component} secondary="Integration" />}
                  label="Integrations">
                  {components.map((c) => (
                    <ComplexSelect.MenuItem key={c.id} value={c.handler}>
                      <ComplexSelect.MenuItem.Text primary={c.displayName} secondary={c.componentType} />
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
