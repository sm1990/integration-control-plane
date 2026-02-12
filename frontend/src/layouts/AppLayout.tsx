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
  Link,
  NotificationPanel,
  Sidebar,
  Stack,
  Tooltip,
  UserMenu,
  useAppShell,
  useNotifications,
} from '@wso2/oxygen-ui';
import { useState } from 'react';
import type { JSX } from 'react';
import { useNavigate, Outlet, Link as NavLink } from 'react-router';
import Logo from '../components/Logo';
import { BarChart3, Bell, Building, ChevronRight, Layers, LayoutDashboard, LogOut, ScrollText, Settings, Shield, User as UserIcon, X } from '@wso2/oxygen-ui-icons-react';
import { useProject, useProjects, useComponents } from '../api/queries';
import { mockNotifications } from '../mock-data/mockNotifications';
import { useScope, useResource, resourceUrl, broaden, narrow, sidebarItems, hasProject, hasComponent, type Resource } from '../nav';
import { orgAccessControlUrl, projectAccessControlUrl, loginUrl } from '../paths';
import { useAuth } from '../auth/AuthContext';

const SIDEBAR_ICONS: Record<Resource, JSX.Element> = {
  overview: <LayoutDashboard size={20} />,
  logs: <ScrollText size={20} />,
  runtimes: <Settings size={20} />,
  environments: <Layers size={20} />,
};

export default function AppLayout(): JSX.Element {
  const navigate = useNavigate();
  const scope = useScope();
  const resource = useResource();

  const { username, displayName, logout } = useAuth();

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

  const { data: project } = useProject(hasProject(scope) ? scope.project : '');
  const { data: projects = [] } = useProjects();
  const { data: components = [] } = useComponents(scope.org, hasProject(scope) ? scope.project : '');

  const items = sidebarItems(scope, resource);

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
              <Stack direction="row" alignItems="center" gap={0.5}>
                <ComplexSelect
                  value={scope.project}
                  onChange={(e) => {
                    const newScope = narrow({ level: 'organizations', org: scope.org }, String(e.target.value));
                    navigate(resourceUrl(newScope, resource ?? 'overview'));
                  }}
                  size="small"
                  sx={{ minWidth: 160 }}
                  renderValue={() => <ComplexSelect.MenuItem.Text primary={project?.name ?? scope.project} secondary="Project" />}
                  label="Projects">
                  {projects.map((p) => (
                    <ComplexSelect.MenuItem key={p.id} value={p.id}>
                      <ComplexSelect.MenuItem.Text primary={p.name} secondary={p.description} />
                    </ComplexSelect.MenuItem>
                  ))}
                </ComplexSelect>
                <IconButton size="small" onClick={() => navigate(resourceUrl({ level: 'organizations', org: scope.org }, resource ?? 'overview'))}>
                  <X size={14} />
                </IconButton>
              </Stack>
            )}
            {hasComponent(scope) && (
              <Stack direction="row" alignItems="center" gap={0.5}>
                <ComplexSelect
                  value={scope.component}
                  onChange={(e) => {
                    const newScope = narrow({ level: 'projects', org: scope.org, project: scope.project }, String(e.target.value));
                    navigate(resourceUrl(newScope, resource ?? 'overview'));
                  }}
                  size="small"
                  sx={{ minWidth: 160 }}
                  renderValue={() => <ComplexSelect.MenuItem.Text primary={scope.component} secondary="Integration" />}
                  label="Integrations">
                  {components.map((c) => (
                    <ComplexSelect.MenuItem key={c.id} value={c.handler}>
                      <ComplexSelect.MenuItem.Text primary={c.displayName} secondary={c.componentType} />
                    </ComplexSelect.MenuItem>
                  ))}
                </ComplexSelect>
                <IconButton size="small" onClick={() => navigate(resourceUrl(broaden(scope)!, resource ?? 'overview'))}>
                  <X size={14} />
                </IconButton>
              </Stack>
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
              <UserMenu.Item icon={<UserIcon size={18} />} label="Profile" />
              <UserMenu.Item icon={<Settings size={18} />} label="Settings" />
              <UserMenu.Divider />
              <UserMenu.Logout icon={<LogOut size={18} />} onClick={() => setConfirmDialogOpen(true)} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </AppShell.Navbar>

      <AppShell.Sidebar>
        <Sidebar collapsed={shell.sidebarCollapsed} activeItem={resource ?? 'overview'} expandedMenus={shell.expandedMenus} onSelect={() => {}} onToggleExpand={actions.toggleMenu}>
          <Sidebar.Nav>
            <Sidebar.Category>
              {items.map((item) => (
                <Link key={item.resource} component={NavLink} to={item.url}>
                  <Sidebar.Item id={item.resource}>
                    <Sidebar.ItemIcon>{SIDEBAR_ICONS[item.resource]}</Sidebar.ItemIcon>
                    <Sidebar.ItemLabel>{item.label}</Sidebar.ItemLabel>
                  </Sidebar.Item>
                </Link>
              ))}
              {hasProject(scope) && (
                <Sidebar.Item id="metrics">
                  <Sidebar.ItemIcon>
                    <BarChart3 size={20} />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Metrics</Sidebar.ItemLabel>
                </Sidebar.Item>
              )}
            </Sidebar.Category>
            <Sidebar.Category>
              {!hasProject(scope) && (
                <Link component={NavLink} to={orgAccessControlUrl(scope.org)}>
                  <Sidebar.Item id="access-control">
                    <Sidebar.ItemIcon>
                      <Shield size={20} />
                    </Sidebar.ItemIcon>
                    <Sidebar.ItemLabel>Access Control</Sidebar.ItemLabel>
                  </Sidebar.Item>
                </Link>
              )}
              {hasProject(scope) && (
                <Link component={NavLink} to={projectAccessControlUrl(scope.org, scope.project)}>
                  <Sidebar.Item id="project-access-control">
                    <Sidebar.ItemIcon>
                      <Shield size={20} />
                    </Sidebar.ItemIcon>
                    <Sidebar.ItemLabel>Access Control</Sidebar.ItemLabel>
                  </Sidebar.Item>
                </Link>
              )}
            </Sidebar.Category>
          </Sidebar.Nav>

          <Sidebar.Footer>
            <Sidebar.Category>
              <Button variant="text" fullWidth onClick={actions.toggleSidebar} sx={{ minHeight: 'auto', py: 1, justifyContent: 'flex-start' }}>
                <Sidebar.Item id="expand">
                  <Sidebar.ItemIcon>
                    <ChevronRight size={20} style={{ transform: shell.sidebarCollapsed ? 'none' : 'rotate(180deg)' }} />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Expand</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Button>
            </Sidebar.Category>
          </Sidebar.Footer>
        </Sidebar>
      </AppShell.Sidebar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer>
        <Footer>
          <Footer.Link href="#privacy">Privacy Policy</Footer.Link>
          <Footer.Link href="#cookies">Cookie Policy</Footer.Link>
          <Footer.Link href="#support">Support</Footer.Link>
          <Footer.Divider />
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
