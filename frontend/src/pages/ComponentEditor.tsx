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

import { Box, Button, Card, CardContent, Typography, TextField, IconButton, Tabs, Tab, Divider, FormControl, FormLabel, Switch, PageContent, FormControlLabel, Chip, Grid } from '@wso2/oxygen-ui';
import { ArrowLeft, Save, Eye, Code, Settings, Play, Undo, Redo } from '@wso2/oxygen-ui-icons-react';
import { useNavigate, useParams } from 'react-router';
import { projectUrl } from '../paths';
import { useState, type JSX } from 'react';

const DEFAULT_CONFIG = {
  title: 'Sign In',
  subtitle: 'Welcome back! Please sign in to continue',
  usernameLabel: 'Username',
  passwordLabel: 'Password',
  submitButton: 'Sign In',
  showRememberMe: true,
  showForgotPassword: true,
  allowSignUp: true,
  enableSocialLogin: true,
};

const DEFAULT_CODE = `{
  "type": "authentication",
  "flow": "login",
  "options": {
    "rememberMe": true,
    "forgotPassword": true,
    "socialLogin": ["google", "github"]
  }
}`;

const Toolbar = ({ onBack, onTest, onPreview, isPreview, onSave }: { onBack: () => void; onTest: () => void; onPreview: () => void; isPreview: boolean; onSave: () => void }) => (
  <Box
    sx={{
      p: 2,
      borderBottom: 1,
      borderColor: 'divider',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      bgcolor: 'background.paper',
    }}>
    <IconButton onClick={onBack}>
      <ArrowLeft size={20} />
    </IconButton>
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h6">Login Flow Editor</Typography>
      <Typography variant="caption" color="text.secondary">
        Basic Login Flow
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <IconButton size="small">
        <Undo size={18} />
      </IconButton>
      <IconButton size="small">
        <Redo size={18} />
      </IconButton>
    </Box>
    <Divider orientation="vertical" flexItem />
    <Button variant="outlined" startIcon={<Play size={18} />} onClick={onTest}>
      Test
    </Button>
    <Button variant="outlined" startIcon={<Eye size={18} />} onClick={onPreview}>
      {isPreview ? 'Edit' : 'Preview'}
    </Button>
    <Button variant="contained" startIcon={<Save size={18} />} onClick={onSave}>
      Save
    </Button>
  </Box>
);

const EditorPanel = ({
  activeTab,
  onTabChange,
  config,
  onConfigChange,
  code,
}: {
  activeTab: number;
  onTabChange: (_: React.SyntheticEvent, v: number) => void;
  config: Record<string, string | boolean>;
  onConfigChange: (k: string, v: string | boolean) => void;
  code: string;
}) => (
  <Box sx={{ p: 3 }}>
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs value={activeTab} onChange={onTabChange} variant="fullWidth">
        <Tab label="Visual Editor" icon={<Settings size={16} />} iconPosition="start" />
        <Tab label="Code Editor" icon={<Code size={16} />} iconPosition="start" />
      </Tabs>
    </Box>
    {activeTab === 0 ? (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h6">Form Configuration</Typography>
        <FormControl>
          <FormLabel>Title</FormLabel>
          <TextField fullWidth value={config.title} onChange={(e) => onConfigChange('title', e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel>Subtitle</FormLabel>
          <TextField fullWidth value={config.subtitle} onChange={(e) => onConfigChange('subtitle', e.target.value)} />
        </FormControl>
        <Typography variant="subtitle1">Field Labels</Typography>
        <FormControl>
          <FormLabel>Username</FormLabel>
          <TextField fullWidth value={config.usernameLabel} onChange={(e) => onConfigChange('usernameLabel', e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel>Password</FormLabel>
          <TextField fullWidth value={config.passwordLabel} onChange={(e) => onConfigChange('passwordLabel', e.target.value)} />
        </FormControl>
        <Typography variant="subtitle1">Options</Typography>
        {['showRememberMe', 'showForgotPassword', 'allowSignUp', 'enableSocialLogin'].map((k) => (
          <FormControlLabel key={k} control={<Switch checked={config[k as keyof typeof config] as boolean} onChange={(e) => onConfigChange(k, e.target.checked)} />} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} />
        ))}
      </Box>
    ) : (
      <Box
        sx={{
          bgcolor: 'grey.900',
          color: 'grey.100',
          p: 2,
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          overflow: 'auto',
          maxHeight: 'calc(100vh - 300px)',
          whiteSpace: 'pre',
        }}>
        {code}
      </Box>
    )}
  </Box>
);

const PreviewPanel = ({ config }: { config: Record<string, string | boolean> }) => (
  <Card sx={{ width: '100%', maxWidth: 450, m: 3 }}>
    <CardContent sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        {config.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {config.subtitle}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField fullWidth placeholder={`Enter your ${config.usernameLabel.toLowerCase()}`} />
        <TextField fullWidth type="password" placeholder={`Enter your ${config.passwordLabel.toLowerCase()}`} />
        {config.showRememberMe && <FormControlLabel control={<Switch size="small" />} label="Remember me" />}
        <Button variant="contained" fullWidth size="large">
          {config.submitButton}
        </Button>
        {config.showForgotPassword && (
          <Button variant="text" size="small" fullWidth>
            Forgot password?
          </Button>
        )}
        {config.enableSocialLogin && (
          <Grid container spacing={1} sx={{ mt: 1 }}>
            <Grid size={6}>
              <Button variant="outlined" fullWidth>
                Google
              </Button>
            </Grid>
            <Grid size={6}>
              <Button variant="outlined" fullWidth>
                GitHub
              </Button>
            </Grid>
          </Grid>
        )}
      </Box>
    </CardContent>
  </Card>
);

export default function ComponentEditor(): JSX.Element {
  const navigate = useNavigate();
  const { id, orgId } = useParams<{ id: string; orgId: string }>();
  const [tab, setTab] = useState(0);
  const [preview, setPreview] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  return (
    <PageContent fullWidth noPadding>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Toolbar onBack={() => navigate(projectUrl(orgId!, id!))} onTest={() => {}} onPreview={() => setPreview(!preview)} isPreview={preview} onSave={() => {}} />
        <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
          <Box
            sx={{
              width: preview ? '0%' : '50%',
              borderRight: 1,
              borderColor: 'divider',
              overflow: 'auto',
              transition: 'width 0.3s',
            }}>
            <EditorPanel activeTab={tab} onTabChange={(_, v) => setTab(v)} config={config} onConfigChange={(k, v) => setConfig({ ...config, [k]: v })} code={DEFAULT_CODE} />
          </Box>
          <Box
            sx={{
              width: preview ? '100%' : '50%',
              overflow: 'auto',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'width 0.3s',
            }}>
            <PreviewPanel config={config} />
          </Box>
        </Box>
        <Box
          sx={{
            p: 1,
            px: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'background.paper',
          }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip label="Unsaved changes" size="small" color="warning" />
            <Typography variant="caption" color="text.secondary">
              Last saved: 2 minutes ago
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Ready
          </Typography>
        </Box>
      </Box>
    </PageContent>
  );
}
