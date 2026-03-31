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

import { Box, CircularProgress } from '@wso2/oxygen-ui';
import { Check, Clock, X } from '@wso2/oxygen-ui-icons-react';

interface StatusIconProps {
  size?: number;
}

export function InProgressIcon({ size = 20 }: StatusIconProps) {
  return <CircularProgress size={size} />;
}

export function SuccessIcon({ size = 20 }: StatusIconProps) {
  const iconSize = Math.round(size * 0.55);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: 'success.main',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      <Check size={iconSize} style={{ color: '#fff' }} />
    </Box>
  );
}

export function QueuedIcon({ size = 20 }: StatusIconProps) {
  const iconSize = Math.round(size * 0.55);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: 'action.disabledBackground',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      <Clock size={iconSize} style={{ color: '#757575' }} />
    </Box>
  );
}

export function FailedIcon({ size = 20 }: StatusIconProps) {
  const iconSize = Math.round(size * 0.55);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: 'error.main',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      <X size={iconSize} style={{ color: '#fff' }} />
    </Box>
  );
}
