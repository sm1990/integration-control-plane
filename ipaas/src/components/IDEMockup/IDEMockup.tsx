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

import { Box, Button, Typography } from '@wso2/oxygen-ui';
import { ExternalLink, Network, PenTool, Rocket } from '@wso2/oxygen-ui-icons-react';
import React, { type JSX, type ReactNode } from 'react';
import { activityBarSx, antLineSx, canvasSx, frameSx, nodeGlowSx, nodeLabelSx, nodeRowSx, nodeTileSx, titleBarSx, trafficLightSx } from './IDEMockup.styles';

function NodeTile({ children, label, active = false }: { children: ReactNode; label: string; active?: boolean }): JSX.Element {
  return (
    <Box sx={{ position: 'relative', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
      {active && <Box sx={nodeGlowSx} />}
      <Box sx={nodeTileSx(active)}>{children}</Box>
      <Typography sx={nodeLabelSx(active)}>{label}</Typography>
    </Box>
  );
}

/** Dashed connector whose dashes crawl between the nodes — the "marching ants" of a live flow. */
function AntLine(): JSX.Element {
  return <Box aria-hidden sx={antLineSx} />;
}

export interface IDEMockupProps {
  onOpenClick?: () => void;
}

export default function IDEMockup({ onOpenClick }: IDEMockupProps): JSX.Element {
  return (
    <Box sx={frameSx}>
      {/* Title bar */}
      <Box sx={titleBarSx}>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={trafficLightSx} />
          ))}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: 128, height: 8, bgcolor: 'action.selected', borderRadius: 0.5 }} />
        </Box>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Activity bar */}
        <Box sx={activityBarSx}>
          <Box sx={{ width: 20, height: 20, borderRadius: 0.5, bgcolor: 'action.selected' }} />
          <Box sx={{ width: 20, height: 20, borderRadius: 0.5, bgcolor: 'primary.main' }} />
          <Box sx={{ width: 20, height: 20, borderRadius: 0.5, bgcolor: 'action.selected' }} />
        </Box>

        {/* Canvas area with dot-grid */}
        <Box sx={canvasSx}>
          {/* Top toolbar skeleton */}
          <Box sx={{ position: 'absolute', top: 8, left: 16, display: 'flex', gap: 1 }}>
            <Box sx={{ width: 48, height: 6, bgcolor: 'action.selected', borderRadius: 0.5 }} />
            <Box sx={{ width: 32, height: 6, bgcolor: 'action.selected', borderRadius: 0.5 }} />
          </Box>

          {/* Node flow */}
          <Box sx={nodeRowSx}>
            <NodeTile label="design">
              <PenTool size={24} />
            </NodeTile>
            <AntLine />
            <NodeTile label="develop" active>
              <Network size={26} />
            </NodeTile>
            <AntLine />
            <NodeTile label="deploy">
              <Rocket size={24} />
            </NodeTile>
          </Box>

          <Box sx={{ mt: 3, position: 'relative', zIndex: 10 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<ExternalLink size={16} />}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onOpenClick?.();
              }}>
              Open Cloud Editor
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
