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

import { Box, ColorSchemeImage, Divider, Grid, Link, Paper, Stack, Typography, useThemeContent } from '@wso2/oxygen-ui'
import { type JSX } from 'react'
import LoginForm from '../components/LoginForm'
import { AppWindow, Cloud, Cog, FlaskConical, ShieldCheck, TerminalSquare, Zap } from '@wso2/oxygen-ui-icons-react'

type ThemeItem = {
  header: string
  sub: string
  items: { icon: JSX.Element; title: string }[]
  logo: string
  logoAlt: string
  bg: string
}

const THEME_CONFIG: Record<string, ThemeItem> = {
  default: {
    header: 'Get Started with Asgardeo Identity and Access Management Solution',
    sub: 'A flexible and secure identity platform for your applications',
    items: [
      { icon: <Cloud className="text-muted-foreground" />, title: 'Flexible Identity Platform' },
      { icon: <ShieldCheck className="text-muted-foreground" />, title: 'Zero-trust Security' },
      { icon: <TerminalSquare className="text-muted-foreground" />, title: 'Developer-first Experience' },
      { icon: <Zap className="text-muted-foreground" />, title: 'Extensible & Enterprise-ready' },
    ],
    logo: 'logo',
    logoAlt: 'Asgardeo Logo',
    bg: 'login',
  },
  choreo: {
    header: 'Get Started with Choreo Internal Developer Platform',
    sub: 'A full-fledged platform for cloud native application development',
    items: [
      { icon: <AppWindow className="text-muted-foreground" />, title: 'Design and develop applications' },
      { icon: <Cloud className="text-muted-foreground" />, title: 'Deploy and promote across environments' },
      { icon: <Cog className="text-muted-foreground" />, title: 'Manage application configurations' },
      { icon: <FlaskConical className="text-muted-foreground" />, title: 'Observe and test an application' },
    ],
    logo: 'choreo-logo',
    logoAlt: 'Choreo Logo',
    bg: 'idevp-login',
  },
}

THEME_CONFIG.acrylicPurple = THEME_CONFIG.choreo // Alias

const Footer = () => (
  <Box component="footer" sx={{ mt: 8 }}>
    <Typography sx={{ textAlign: 'center' }}>© Copyright {new Date().getFullYear()}</Typography>
    <Stack direction="row" justifyContent="center" sx={{ mt: 2 }} spacing={1}>
      <Link>Privacy Policy</Link>
      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
      <Link>Terms of Use</Link>
    </Stack>
  </Box>
)

export default function Login(): JSX.Element {
  const content = useThemeContent({
    default: THEME_CONFIG.default,
    acrylicPurple: THEME_CONFIG.acrylicPurple,
    choreo: THEME_CONFIG.choreo,
  })

  const base = import.meta.env.BASE_URL

  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      <Grid container sx={{ flex: 1 }}>
        <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex', alignItems: 'top', justifyContent: 'left', padding: 18, textAlign: 'left', position: 'relative' }}>
          <Box>
            <Stack direction="column" alignItems="start" gap={2} maxWidth={580} display={{ xs: 'none', md: 'flex' }}>
              <Box sx={{ my: 3 }}>
                <ColorSchemeImage
                  src={{ light: `${base}assets/images/${content.logo}.svg`, dark: `${base}assets/images/${content.logo === 'logo' ? 'logo-inverted' : content.logo}.svg` }}
                  alt={{ light: `${content.logoAlt} (Light)`, dark: `${content.logoAlt} (Dark)` }}
                  height={content.logo === 'logo' ? 30 : 40}
                  width="auto"
                />
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 0 }}>{content.header}</Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>{content.sub}</Typography>
              <Stack sx={{ gap: 2 }}>
                {content.items.map((item) => (
                  <Stack key={item.title} direction="row" sx={{ gap: 2 }}>
                    {item.icon}
                    <div><Typography gutterBottom sx={{ fontWeight: 'medium' }}>{item.title}</Typography></div>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Box>
          <ColorSchemeImage
            src={{ light: `${base}assets/images/${content.bg}.svg`, dark: `${base}assets/images/${content.bg.replace('login', 'login-inverted')}.svg` }}
            alt={{ light: 'Login Screen', dark: 'Login Screen' }}
            height={450}
            width="auto"
            sx={{ position: 'absolute', bottom: 50, right: -100 }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ display: 'flex', padding: 4, width: '100%', height: '100%', flexDirection: 'column', position: 'relative', textAlign: 'left' }}>
            <Box sx={{ alignItems: 'center', justifyContent: 'center', padding: 4, width: '100%', maxWidth: 500, margin: 'auto' }}>
              <LoginForm />
              <Footer />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
