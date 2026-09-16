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

import type { ReactNode } from 'react';
import type { OverviewHeaderActionsProps } from '../../../types/integration';
import SharedOverviewHeaderActions from '../_shared/OverviewHeaderActions';
import GenerateMcpButton from './GenerateMcpButton';
import { IS_CLOUD } from '../../../features';

/**
 * Integration-as-API's Overview-header actions slot: the shared default block
 * (Configure Security / Lifecycle / Dev Portal) **plus** the Generate MCP
 * button — which is specific to this type. Plugged into the generic
 * `HeaderShell` like any other module slot (EnvCardBody pattern), so MCP never
 * appears for other types.
 */
export default function OverviewHeaderActions({ component, apimId, orgHandler, projectHandler }: OverviewHeaderActionsProps): ReactNode {
  return (
    <SharedOverviewHeaderActions
      component={component}
      apimId={apimId}
      orgHandler={orgHandler}
      projectHandler={projectHandler}
      extra={IS_CLOUD ? undefined : <GenerateMcpButton apimId={apimId} sourceHandler={component.handler} orgHandler={orgHandler} projectHandler={projectHandler} />}
    />
  );
}
