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

import type { Theme } from '@wso2/oxygen-ui';

export const frameSx = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 1,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  fontFamily: 'monospace',
  position: 'relative',
} as const;

export const titleBarSx = {
  height: 20,
  bgcolor: 'action.hover',
  borderBottom: '1px solid',
  borderColor: 'divider',
  display: 'flex',
  alignItems: 'center',
  px: 1,
  flexShrink: 0,
} as const;

export const trafficLightSx = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  bgcolor: 'action.disabled',
  border: '1px solid',
  borderColor: 'divider',
} as const;

export const activityBarSx = {
  width: 24,
  bgcolor: 'action.hover',
  borderRight: '1px solid',
  borderColor: 'divider',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  pt: 2,
  gap: 1.5,
  flexShrink: 0,
} as const;

export const canvasSx = {
  flex: 1,
  bgcolor: 'background.paper',
  // `theme.palette` holds the default scheme's literal colours; only `theme.vars` follows the
  // active one, so anything interpolated into a string has to read through it.
  backgroundImage: (theme: Theme) => `radial-gradient(${(theme.vars ?? theme).palette.divider} 1.5px, transparent 1.5px)`,
  backgroundSize: '20px 20px',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
} as const;

export const nodeRowSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  width: '100%',
  px: 3,
  position: 'relative',
  zIndex: 10,
} as const;

export const nodeGlowSx = {
  position: 'absolute',
  top: -6,
  left: -6,
  right: -6,
  height: 74,
  borderRadius: 3,
  bgcolor: 'primary.main',
  opacity: 0.09,
  filter: 'blur(4px)',
} as const;

export const nodeTileSx = (active: boolean) =>
  ({
    position: 'relative',
    width: active ? 72 : 62,
    height: active ? 62 : 52,
    borderRadius: 1.2,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: active ? 'primary.main' : 'action.disabled',
    color: active ? 'primary.main' : 'text.primary',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }) as const;

export const nodeLabelSx = (active: boolean) =>
  ({
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: '0.04em',
    color: active ? 'primary.main' : 'text.secondary',
  }) as const;

/** One shift of a whole dash period, so the loop is seamless. */
export const antLineSx = {
  flex: 1,
  maxWidth: 64,
  height: '2px',
  mb: 2.5,
  backgroundImage: (theme: Theme) => `repeating-linear-gradient(90deg, ${(theme.vars ?? theme).palette.text.disabled} 0 7px, transparent 7px 14px)`,
  backgroundSize: '14px 2px',
  '@keyframes ideMockupAntMarch': { to: { backgroundPosition: '14px 0' } },
  animation: 'ideMockupAntMarch 0.7s linear infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
} as const;
