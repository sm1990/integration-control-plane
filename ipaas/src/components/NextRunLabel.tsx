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

import { Stack, Typography } from '@wso2/oxygen-ui';
import { Clock } from '@wso2/oxygen-ui-icons-react';
import { useEffect, useState, type JSX } from 'react';
import { formatTimeUntil, nextCronRunMs } from '../utils/cronUtils';

export interface NextRunLabelProps {
  /** Cron expression of the active schedule; an empty value renders nothing. */
  cron: string;
  /** IANA zone the cron fields are written in. Falls back to the browser's zone. */
  timeZone?: string;
  sx?: object;
}

/** Live "Next run in 1m 22s" countdown for an active schedule. */
export default function NextRunLabel({ cron, timeZone, sx }: NextRunLabelProps): JSX.Element | null {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!cron) {
      setRemaining(null);
      return;
    }
    // Resolving the cron scans minute by minute, so hold the target and only re-resolve once it passes.
    let target = nextCronRunMs(cron, timeZone || undefined);
    const tick = () => {
      if (target !== null && Date.now() >= target) target = nextCronRunMs(cron, timeZone || undefined);
      setRemaining(target === null ? null : formatTimeUntil(target));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cron, timeZone]);

  if (remaining === null) return null;

  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ color: 'success.main', ...sx }}>
      <Clock size={14} />
      <Typography variant="body2" color="text.secondary">
        Next run in {remaining}
      </Typography>
    </Stack>
  );
}
