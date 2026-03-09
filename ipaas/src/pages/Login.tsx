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

import { Alert, Box, ColorSchemeImage, Divider, Grid, Link, Stack, Typography } from '@wso2/oxygen-ui';
import { type JSX } from 'react';
import { Link as NavLink, useSearchParams } from 'react-router';
import LoginForm from '../components/LoginForm';
import { cookiePolicyUrl, privacyPolicyUrl } from '../paths';

const Footer = () => (
  <Box component="footer" sx={{ mt: 4 }}>
    <Stack direction="row" justifyContent="center" spacing={1}>
      <Link component={NavLink} to={privacyPolicyUrl()} underline="hover" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
        Privacy Policy
      </Link>
      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
      <Link component={NavLink} to={cookiePolicyUrl()} underline="hover" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
        Cookie Policy
      </Link>
    </Stack>
  </Box>
);

export default function Login(): JSX.Element {
  const base = import.meta.env.BASE_URL;
  const [searchParams] = useSearchParams();
  const signedOut = searchParams.get('state') === 'sign_out_success';

  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      <Grid container sx={{ flex: 1 }}>
        {/* Left panel — branding */}
        <Grid
          size={{ xs: 12, md: 8 }}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: { xs: 4, md: 8 },
            position: 'relative',
            overflow: 'hidden',
          }}>
          <Stack direction="column" alignItems="flex-start" gap={3} display={{ xs: 'none', md: 'flex' }} sx={{ width: '100%' }}>
            <ColorSchemeImage
              src={{ light: `${base}assets/images/logo/WSO2-Integration-Platform-Black.svg`, dark: `${base}assets/images/logo/WSO2-Integration-Platform-White.svg` }}
              alt={{ light: 'WSO2 Integration Platform Logo', dark: 'WSO2 Integration Platform Logo' }}
              height={60}
              width="auto"
              style={{ alignSelf: 'flex-start' }}
            />
            <Typography variant="h3" component="h1" sx={{ textAlign: 'left', width: '100%' }}>
              Get Started with WSO2 Integration Platform as a Service
            </Typography>
            <Box sx={{ maxWidth: 520, width: '100%' }}>
              <Typography variant="body1" sx={{ color: 'text.secondary', textAlign: 'left', width: '100%' }}>
                Build, deploy, and manage integrations in the cloud — fully managed, infinitely scalable, and always available.
              </Typography>
            </Box>
          </Stack>
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              justifyContent: 'flex-end',
              alignItems: 'center',
              mt: 2,
              width: '100%',
            }}>
            <img src={`${base}assets/images/icp-login.svg`} alt="IPaaS Login Illustration" style={{ maxWidth: '90%', maxHeight: '280px', objectFit: 'contain' }} />
          </Box>
        </Grid>

        {/* Right panel — sign-in form */}
        <Grid
          size={{ xs: 12, md: 4 }}
          sx={{
            display: 'flex',
            padding: 4,
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
          <Box sx={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
            {/* Mobile logo */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 3 }}>
              <ColorSchemeImage
                src={{ light: `${base}assets/images/logo/WSO2-Integration-Platform-Black.svg`, dark: `${base}assets/images/logo/WSO2-Integration-Platform-White.svg` }}
                alt={{ light: 'WSO2 Integration Platform Logo', dark: 'WSO2 Integration Platform Logo' }}
                height={48}
                width="auto"
              />
            </Box>

            {signedOut && (
              <Alert severity="success" sx={{ mb: 3 }}>
                You have been signed out successfully.
              </Alert>
            )}

            <LoginForm />
            <Footer />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
