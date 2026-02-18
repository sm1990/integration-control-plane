/**
 * Copyright (c) 2024, WSO2 LLC. (http://www.wso2.com).
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

import { useState } from 'react';
import type { JSX } from 'react';
import { Alert, Box, Button, CircularProgress, Divider, IconButton, InputAdornment, InputLabel, OutlinedInput, Typography } from '@wso2/oxygen-ui';
import { Eye, EyeOff } from '@wso2/oxygen-ui-icons-react';
import { useNavigate } from 'react-router';
import { resourceUrl } from '../nav';
import { useAuth } from '../auth/AuthContext';

export default function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const { login, loginWithOIDC } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleMouseUpPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleSSOLogin = async () => {
    setError(null);
    setSsoLoading(true);
    try {
      await loginWithOIDC();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO login failed');
      setSsoLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate(resourceUrl({ level: 'organizations', org: 'default' }, 'overview'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4, textAlign: 'center' }}>
        Sign In
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" flexDirection="column" gap={2.5}>
        <Box display="flex" flexDirection="column" gap={0.5}>
          <InputLabel htmlFor="username">Username</InputLabel>
          <OutlinedInput type="text" id="username" name="username" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} size="small" required disabled={loading} />
        </Box>
        <Box display="flex" flexDirection="column" gap={0.5}>
          <InputLabel htmlFor="password">Password</InputLabel>
          <OutlinedInput
            type={showPassword ? 'text' : 'password'}
            endAdornment={
              <InputAdornment position="end">
                <IconButton aria-label={showPassword ? 'hide the password' : 'display the password'} onClick={handleClickShowPassword} onMouseDown={handleMouseDownPassword} onMouseUp={handleMouseUpPassword} edge="end">
                  {showPassword ? <EyeOff /> : <Eye />}
                </IconButton>
              </InputAdornment>
            }
            id="password"
            name="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            size="small"
            required
            disabled={loading}
          />
        </Box>

        <Button
          variant="contained"
          color="primary"
          type="submit"
          fullWidth
          sx={{ mt: 1, bgcolor: '#1e1e1e', '&:hover': { bgcolor: '#333' }, textTransform: 'none', py: 1.2 }}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}>
          {loading ? 'Signing In...' : 'Login'}
        </Button>

        <Divider sx={{ my: 0.5 }}>OR</Divider>

        <Button
          variant="outlined"
          fullWidth
          sx={{ textTransform: 'none', py: 1.2, borderColor: '#ccc', color: 'text.primary' }}
          onClick={handleSSOLogin}
          disabled={loading || ssoLoading}
          startIcon={ssoLoading ? <CircularProgress size={20} color="inherit" /> : undefined}>
          {ssoLoading ? 'Redirecting...' : 'Sign in with SSO'}
        </Button>
      </Box>
    </form>
  );
}
