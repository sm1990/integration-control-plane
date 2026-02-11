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

import { Box, Divider, Grid, Link, Stack, Typography } from '@wso2/oxygen-ui';
import { type JSX } from 'react';
import LoginForm from '../components/LoginForm';

const Footer = () => (
  <Box component="footer" sx={{ mt: 4 }}>
    <Stack direction="row" justifyContent="center" spacing={1}>
      <Link href="#" underline="hover" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
        Privacy Policy
      </Link>
      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
      <Link href="#" underline="hover" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
        Cookie Policy
      </Link>
    </Stack>
  </Box>
);

export default function Login(): JSX.Element {
  const base = import.meta.env.BASE_URL;

  return (
    <Box sx={{ height: '100vh', display: 'flex', bgcolor: 'background.default' }}>
      <Grid container sx={{ flex: 1 }}>
        <Grid
          size={{ xs: 12, md: 8 }}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: { xs: 4, md: 8 },
            position: 'relative',
            overflow: 'hidden',
          }}>
          <Stack direction="column" alignItems="flex-start" gap={0.5} maxWidth={520} display={{ xs: 'none', md: 'flex' }} sx={{ width: '100%' }}>
            <img src={`${base}assets/images/icp-logo.svg`} alt="ICP Logo" height={60} />
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              Get Started with WSO2 Integrator: ICP
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              A centralized platform for controlling, managing, and observing your integration solutions with confidence and scale.
            </Typography>
          </Stack>
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              justifyContent: 'center',
              alignItems: 'center',
              flex: 1,
              mt: 2,
              width: '100%',
            }}>
            <img src={`${base}assets/images/icp-login.svg`} alt="ICP Login Illustration" style={{ maxWidth: '90%', maxHeight: '480px', objectFit: 'contain' }} />
          </Box>
        </Grid>

        <Grid
          size={{ xs: 12, md: 4 }}
          sx={{
            display: 'flex',
            padding: 4,
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 400,
              margin: '0 auto',
            }}>
            <LoginForm />
            <Footer />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
