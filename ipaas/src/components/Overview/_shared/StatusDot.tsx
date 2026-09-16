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

import { Box, Stack, Typography } from '@wso2/oxygen-ui';
import type { ReactNode } from 'react';
import { DEPLOYMENT_STATUS_DOT } from '../../../constants/deploymentStatusDot';

/**
 * Presentational deployment-status dot + label. Renders nothing for an unknown
 * or absent status. Composed by the types that surface a deployment status
 * (e.g. integration-as-api); types without a status concept simply don't use it.
 */
export default function StatusDot({ status }: { status?: string | null }): ReactNode {
  const dot = status ? DEPLOYMENT_STATUS_DOT[status] : null;
  if (!dot) return null;
  return (
    <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexShrink: 0 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dot.dotColor, flexShrink: 0 }} />
      <Typography variant="body2" color="text.secondary">
        {dot.label}
      </Typography>
    </Stack>
  );
}
