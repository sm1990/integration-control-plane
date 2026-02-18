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
  Typography,
  TextField,
  Tabs,
  Tab,
  Divider,
  FormControl,
  FormLabel,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  PageTitle,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  Grid,
  Avatar,
  ThemeSwitcher,
  PageContent,
} from '@wso2/oxygen-ui';
import { Save, Building2, Bell, Shield, Key, Trash2, Palette, Users, CreditCard } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Language = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';
type Timezone = 'utc' | 'est' | 'pst' | 'cet' | 'jst' | 'ist';

interface SettingsState {
  general: {
    orgName: string;
    displayName: string;
    description: string;
    website: string;
    industry: string;
    size: string;
  };
  appearance: {
    theme: Theme;
    language: Language;
    timezone: Timezone;
    dateFormat: string;
  };
  notifications: {
    email: boolean;
    slack: boolean;
    security: boolean;
    billing: boolean;
    weekly: boolean;
    updates: boolean;
  };
  security: {
    mfa: boolean;
    timeout: string;
    ipWhitelist: boolean;
    domains: string;
  };
}

const Section = ({ title, children, variant = 'outlined', titleColor }: { title: string; children: ReactNode; variant?: 'outlined' | 'elevation'; titleColor?: string }) => (
  <Card variant={variant} sx={{ borderColor: titleColor ? `${titleColor}.main` : undefined }}>
    <CardContent sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 2, color: titleColor ? `${titleColor}.main` : undefined }}>
        {title}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</Box>
    </CardContent>
  </Card>
);

const Toggle = ({ check, onChange, label, sub }: { check: boolean; onChange: (v: boolean) => void; label: string; sub: string }) => (
  <Box>
    <FormControlLabel control={<Switch checked={check} onChange={(e) => onChange(e.target.checked)} />} label={label} />
    <Typography variant="body2" color="text.secondary" sx={{ ml: 5, mt: -1 }}>
      {sub}
    </Typography>
  </Box>
);

const Field = ({ label, val, onChange, full = true, multi = false, rows, type = 'text', help }: { label: string; val: string; onChange: (v: string) => void; full?: boolean; multi?: boolean; rows?: number; type?: string; help?: string }) => (
  <FormControl fullWidth={full}>
    <FormLabel>{label}</FormLabel>
    <TextField fullWidth={full} multiline={multi} rows={rows} type={type} value={val} onChange={(e) => onChange(e.target.value)} helperText={help} />
  </FormControl>
);

const Option = ({ label, val, onChange, opts }: { label: string; val: string; onChange: (v: string) => void; opts: { v: string; l: string }[] }) => (
  <FormControl fullWidth>
    <FormLabel>{label}</FormLabel>
    <Select value={val} onChange={(e) => onChange(e.target.value as string)}>
      {opts.map((o) => (
        <MenuItem key={o.v} value={o.v}>
          {o.l}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

export default function SettingsPage(): JSX.Element {
  const [tab, setTab] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [data, setData] = useState<SettingsState>({
    general: {
      orgName: 'Acme Corp',
      displayName: 'ACME',
      description: 'Tech solutions',
      website: 'https://acme.com',
      industry: 'technology',
      size: '50-200',
    },
    appearance: {
      theme: 'light',
      language: 'en',
      timezone: 'utc',
      dateFormat: 'MM/DD/YYYY',
    },
    notifications: {
      email: true,
      slack: false,
      security: true,
      billing: true,
      weekly: false,
      updates: true,
    },
    security: {
      mfa: true,
      timeout: '30',
      ipWhitelist: false,
      domains: '@acme.com',
    },
  });

  const update = <K extends keyof SettingsState>(section: K, update: Partial<SettingsState[K]>) => {
    setData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...update },
    }));
    setDirty(true);
  };

  const tabs = [
    {
      icon: <Building2 size={18} />,
      label: 'General',
      render: () => (
        <Section title="Organization Information">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                fontSize: '2rem',
              }}>
              AC
            </Avatar>
            <Box>
              <Button variant="outlined" size="small" sx={{ mb: 1 }}>
                Change Logo
              </Button>
              <Typography variant="caption" display="block" color="text.secondary">
                Square, 200x200px
              </Typography>
            </Box>
          </Box>
          <Field label="Organization Name" val={data.general.orgName} onChange={(v) => update('general', { orgName: v })} />
          <Field label="Display Name" val={data.general.displayName} onChange={(v) => update('general', { displayName: v })} />
          <Field label="Description" val={data.general.description} multi rows={3} onChange={(v) => update('general', { description: v })} />
          <Field label="Website" val={data.general.website} type="url" onChange={(v) => update('general', { website: v })} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Option
                label="Industry"
                val={data.general.industry}
                onChange={(v) => update('general', { industry: v })}
                opts={[
                  { v: 'technology', l: 'Technology' },
                  { v: 'finance', l: 'Finance' },
                  { v: 'healthcare', l: 'Healthcare' },
                ]}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Option
                label="Company Size"
                val={data.general.size}
                onChange={(v) => update('general', { size: v })}
                opts={[
                  { v: '1-10', l: '1-10' },
                  { v: '50-200', l: '50-200' },
                  { v: '500+', l: '500+' },
                ]}
              />
            </Grid>
          </Grid>
        </Section>
      ),
    },
    {
      icon: <Palette size={18} />,
      label: 'Appearance',
      render: () => (
        <Section title="Appearance">
          <FormControl>
            <FormLabel>Theme</FormLabel>
            <ThemeSwitcher />
          </FormControl>
          <Option
            label="Language"
            val={data.appearance.language}
            onChange={(v) => update('appearance', { language: v as Language })}
            opts={[
              { v: 'en', l: 'English' },
              { v: 'es', l: 'Spanish' },
              { v: 'fr', l: 'French' },
            ]}
          />
          <Option
            label="Timezone"
            val={data.appearance.timezone}
            onChange={(v) => update('appearance', { timezone: v as Timezone })}
            opts={[
              { v: 'utc', l: 'UTC' },
              { v: 'est', l: 'EST' },
              { v: 'pst', l: 'PST' },
            ]}
          />
          <Option
            label="Date Format"
            val={data.appearance.dateFormat}
            onChange={(v) => update('appearance', { dateFormat: v })}
            opts={[
              { v: 'MM/DD/YYYY', l: 'MM/DD/YYYY' },
              { v: 'DD/MM/YYYY', l: 'DD/MM/YYYY' },
              { v: 'YYYY-MM-DD', l: 'YYYY-MM-DD' },
            ]}
          />
        </Section>
      ),
    },
    {
      icon: <Bell size={18} />,
      label: 'Notifications',
      render: () => (
        <Section title="Notifications">
          <Toggle check={data.notifications.email} onChange={(v) => update('notifications', { email: v })} label="Email" sub="Receive email notifications" />
          <Toggle check={data.notifications.slack} onChange={(v) => update('notifications', { slack: v })} label="Slack" sub="Send to Slack workspace" />
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2">Types</Typography>
          <Toggle check={data.notifications.security} onChange={(v) => update('notifications', { security: v })} label="Security" sub="Security alerts" />
          <Toggle check={data.notifications.billing} onChange={(v) => update('notifications', { billing: v })} label="Billing" sub="Billing alerts" />
        </Section>
      ),
    },
    {
      icon: <Shield size={18} />,
      label: 'Security',
      render: () => (
        <Section title="Security">
          <Toggle check={data.security.mfa} onChange={(v) => update('security', { mfa: v })} label="Require 2FA" sub="Mandatory 2FA for all members" />
          <Field label="Session Timeout (min)" type="number" val={data.security.timeout} onChange={(v) => update('security', { timeout: v })} help="Auto logout after inactivity" />
          <Toggle check={data.security.ipWhitelist} onChange={(v) => update('security', { ipWhitelist: v })} label="IP Whitelist" sub="Restrict IP access" />
          <Field label="Allowed Domains" val={data.security.domains} onChange={(v) => update('security', { domains: v })} help="Comma-separated domains" />
          <Alert severity="info">
            <Typography variant="body2">Strong security settings help protect your organization.</Typography>
          </Alert>
        </Section>
      ),
    },
    {
      icon: <Users size={18} />,
      label: 'Members',
      render: () => (
        <Section title="Team Members">
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Typography variant="h5">Team</Typography>
            <Button variant="contained" size="small" startIcon={<Users size={18} />}>
              Invite
            </Button>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <List>
            {[
              {
                n: 'John Doe',
                e: 'john@acme.com',
                r: 'Owner',
                c: 'primary',
                a: 'JD',
              },
              {
                n: 'Jane Smith',
                e: 'jane@acme.com',
                r: 'Admin',
                c: 'success',
                a: 'JS',
              },
            ].map((m, i) => (
              <ListItem
                key={i}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 2,
                }}>
                <Avatar sx={{ mr: 2 }}>{m.a}</Avatar>
                <ListItemText
                  primary={m.n}
                  secondary={
                    <Box display="flex" gap={1} mt={0.5}>
                      <Typography variant="body2">{m.e}</Typography>
                      <Chip label={m.r} size="small" color={m.c as 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'} />
                    </Box>
                  }
                />
                <Button size="small" variant="outlined" color="error" disabled={m.r === 'Owner'}>
                  Remove
                </Button>
              </ListItem>
            ))}
          </List>
        </Section>
      ),
    },
    {
      icon: <Key size={18} />,
      label: 'API Keys',
      render: () => (
        <Section title="API Keys">
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Typography variant="h5">Keys</Typography>
            <Button variant="contained" size="small">
              Generate
            </Button>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <List>
            {[
              { t: 'Production', k: 'sk_prod_•••' },
              { t: 'Development', k: 'sk_dev_•••' },
            ].map((k, i) => (
              <ListItem
                key={i}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 2,
                }}>
                <ListItemText
                  primary={`${k.t} Key`}
                  secondary={
                    <Box display="flex" gap={1} mt={1}>
                      <Typography variant="body2" fontFamily="monospace">
                        {k.k}
                      </Typography>
                      <Chip label="Active" size="small" color="success" />
                    </Box>
                  }
                />
                <Button size="small" variant="outlined" sx={{ mr: 1 }}>
                  Copy
                </Button>
                <Button size="small" variant="outlined" color="error">
                  Revoke
                </Button>
              </ListItem>
            ))}
          </List>
        </Section>
      ),
    },
    {
      icon: <CreditCard size={18} />,
      label: 'Billing',
      render: () => (
        <Section title="Billing">
          <Typography variant="subtitle1" gutterBottom>
            Plan
          </Typography>
          <Box p={2} border={1} borderColor="primary.main" borderRadius={1} bgcolor="action.hover" mb={3}>
            <Box display="flex" justifyContent="space-between">
              <Box>
                <Typography variant="h6">Enterprise</Typography>
              </Box>
              <Typography variant="h5" color="primary">
                $99/mo
              </Typography>
            </Box>
          </Box>
          <Button variant="outlined" color="warning">
            Change Plan
          </Button>
        </Section>
      ),
    },
    {
      icon: <Trash2 size={18} />,
      label: 'Danger',
      render: () => (
        <Section title="Danger Zone" variant="outlined" titleColor="error">
          <Alert severity="error" sx={{ mb: 2 }}>
            Permanent actions.
          </Alert>
          <Button variant="contained" color="error" startIcon={<Trash2 size={18} />}>
            Delete Organization
          </Button>
        </Section>
      ),
    },
  ];

  return (
    <PageContent>
      <Box display="flex" alignItems="center" gap={2} mb={4}>
        <Box flexGrow={1}>
          <PageTitle>
            <PageTitle.Header>Organization Settings</PageTitle.Header>
            <PageTitle.SubHeader>Manage your organization preferences</PageTitle.SubHeader>
          </PageTitle>
        </Box>
        {dirty && (
          <Button variant="contained" startIcon={<Save size={18} />} onClick={() => setDirty(false)}>
            Save Changes
          </Button>
        )}
      </Box>

      {dirty && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Unsaved changes.
        </Alert>
      )}

      <Box display="flex" gap={3}>
        <Card variant="outlined" sx={{ width: 280, height: 'fit-content' }}>
          <CardContent sx={{ p: 3 }}>
            <Tabs orientation="vertical" value={tab} onChange={(_, v) => setTab(v)}>
              {tabs.map((t, i) => (
                <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} />
              ))}
            </Tabs>
          </CardContent>
        </Card>
        <Box flexGrow={1}>{tabs[tab].render()}</Box>
      </Box>
    </PageContent>
  );
}
