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
import { ExternalLink, FlaskConical, Network, Rocket } from '@wso2/oxygen-ui-icons-react';
import React, { Fragment, useEffect, useState, type JSX, type ReactNode } from 'react';
import { activityBarSx, antLineSx, canvasSx, frameSx, nodeGlowSx, nodeLabelSx, nodeRowSx, nodeTileSx, titleBarSx, trafficLightSx } from './IDEMockup.styles';

function NodeTile({ children, label, active = false }: { children: ReactNode; label: string; active?: boolean }): JSX.Element {
  return (
    <Box sx={{ position: 'relative', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
      <Box sx={nodeGlowSx(active)} />
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

const STAGES = [
  { label: 'Develop', Icon: Network },
  { label: 'Test', Icon: FlaskConical },
  { label: 'Deploy', Icon: Rocket },
] as const;

const STAGE_INTERVAL_MS = 1000;

export default function IDEMockup({ onOpenClick }: IDEMockupProps): JSX.Element {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActiveStage((stage) => (stage + 1) % STAGES.length), STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

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

          <Box sx={nodeRowSx}>
            {STAGES.map(({ label, Icon }, index) => (
              <Fragment key={label}>
                {index > 0 && <AntLine />}
                <NodeTile label={label} active={activeStage === index}>
                  <Icon size={26} />
                </NodeTile>
              </Fragment>
            ))}
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
