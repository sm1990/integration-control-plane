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

import { Box } from '@wso2/oxygen-ui';
import type { JSX, ReactNode } from 'react';

export interface BusyFieldsProps {
  /** True while the form's action is in flight. */
  busy: boolean;
  children: ReactNode;
}

/**
 * Locks a form's editable region while its action runs, so the values being submitted
 * cannot change underneath the request.
 *
 * Wrap the fields only — keep the submit/cancel row outside, since the submit button
 * carries its own progress state.
 *
 * `inert` rather than `pointer-events: none`: the latter still lets an already-focused
 * input take keystrokes, and leaves a Select openable by keyboard. `inert` blocks
 * pointer and keyboard both, and drops the subtree from the accessibility tree.
 */
export default function BusyFields({ busy, children }: BusyFieldsProps): JSX.Element {
  return (
    <Box aria-busy={busy} sx={{ opacity: busy ? 0.6 : 1, transition: 'opacity 120ms ease' }}>
      {/* inert drops its own element from the accessibility tree too, so aria-busy has to
          sit on an ancestor of it to still be announced. */}
      <Box inert={busy}>{children}</Box>
    </Box>
  );
}
