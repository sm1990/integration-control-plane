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

import { Box, Button, Chip, Divider, MenuItem, Select, Stack, Tooltip, Typography } from '@wso2/oxygen-ui';
import { GitBranch, HelpCircle, Plus } from '@wso2/oxygen-ui-icons-react';
import type { ReactNode } from 'react';
import { useAppNavigate } from '../hooks/useAppNavigate';
import type { DeploymentTrack } from '../types/component';
import { IS_CLOUD } from '../features';
import { PILL_SELECT_SX } from '../constants/styles';
import { apiVersionChipSx, bandSx, barCaptionSx, barSx, menuActionButtonSx, menuActionsRowSx, tooltipAnchorSx, trackLabelSx } from './DeploymentTrackBar.styles';

interface DeploymentTrackBarProps {
  tracks: DeploymentTrack[];
  selectedId: string;
  onChange: (id: string) => void;
  orgHandler: string;
  projectHandler: string;
  componentHandler: string;
  /** When true, renders the selected track as just the API version string (e.g. "v1.0") */
  versionView?: boolean;
  extra?: ReactNode;
}

const TOOLTIP_TEXT = 'Deployment tracks control the release path of your component versions through different environments.';

function normalizeVersion(v: string): string {
  return /^v/i.test(v) ? v : `v${v}`;
}

function TrackLabel({ track, versionView }: { track: DeploymentTrack; versionView?: boolean }) {
  if (versionView) {
    return (
      <Typography variant="body2" sx={trackLabelSx}>
        {track.apiVersion ? normalizeVersion(track.apiVersion) : track.id}
      </Typography>
    );
  }
  return (
    <Stack direction="row" alignItems="center" gap={0.75}>
      {track.branch && <GitBranch size={13} />}
      <Typography variant="body2" sx={trackLabelSx}>
        {track.branch || 'None'}
      </Typography>
      {track.apiVersion && <Chip label={`API ${normalizeVersion(track.apiVersion)}`} size="small" variant="outlined" color="primary" sx={apiVersionChipSx} />}
    </Stack>
  );
}

export default function DeploymentTrackBar({ tracks, selectedId, onChange, orgHandler, projectHandler, componentHandler, versionView, extra }: DeploymentTrackBarProps) {
  const navigate = useAppNavigate();

  // Cloud has one implicit track, so the track picker has nothing to offer — but this bar is
  // where every ComponentScope page puts its environment selector, so keep it for that alone.
  if (IS_CLOUD)
    return extra ? (
      <Box sx={bandSx}>
        <Box sx={barSx}>{extra}</Box>
      </Box>
    ) : null;

  const basePath = `/organizations/${orgHandler}/projects/${projectHandler}/components/${componentHandler}/settings/deployment-tracks`;

  return (
    <Box sx={bandSx}>
      <Box sx={barSx}>
        {/* Label + tooltip */}
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Typography variant="body2" color="text.secondary" sx={barCaptionSx}>
            Deployment Track
          </Typography>
          <Tooltip title={TOOLTIP_TEXT} placement="right">
            <Box role="img" aria-label={TOOLTIP_TEXT} sx={tooltipAnchorSx}>
              <HelpCircle size={13} aria-hidden="true" />
            </Box>
          </Tooltip>
        </Stack>

        {/* Track selector */}
        <Select
          size="small"
          value={selectedId}
          onChange={(e) => onChange(e.target.value as string)}
          renderValue={(value) => {
            const track = tracks.find((t) => t.id === value);
            if (!track) return null;
            return <TrackLabel track={track} versionView={versionView} />;
          }}
          inputProps={{ 'aria-label': 'Deployment Track' }}
          sx={{ ...PILL_SELECT_SX, minWidth: 160 }}>
          {/* Create New / View All actions */}
          <Box sx={menuActionsRowSx} onKeyDown={(e) => e.stopPropagation()}>
            <Button
              size="small"
              startIcon={<Plus size={13} />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`${basePath}/new`);
              }}
              sx={menuActionButtonSx}>
              Create New
            </Button>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(basePath);
              }}
              sx={menuActionButtonSx}>
              View All
            </Button>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          {tracks.map((track) => (
            <MenuItem key={track.id} value={track.id}>
              <TrackLabel track={track} versionView={versionView} />
            </MenuItem>
          ))}
        </Select>
        {extra}
      </Box>
    </Box>
  );
}
