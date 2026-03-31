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

import { Button, Tooltip } from '@wso2/oxygen-ui';
import { ArrowDown } from '@wso2/oxygen-ui-icons-react';
import { useComponentDeployment } from '../../api/queries';
import { usePromote } from '../../api/mutations';
import { getOrgUuidFromToken } from '../../auth/tokenManager';
import Authorized from '../Authorized';
import { Permissions } from '../../constants/permissions';

interface PromoteButtonProps {
  orgHandler: string;
  componentId: string;
  versionId: string;
  deploymentPipelineId: string;
  sourceEnvId: string;
  targetEnvId: string;
}

export default function PromoteButton({ orgHandler, componentId, versionId, deploymentPipelineId, sourceEnvId, targetEnvId }: PromoteButtonProps) {
  const orgUuid = getOrgUuidFromToken() ?? '';
  const { data: sourceDeployment } = useComponentDeployment(orgHandler, orgUuid, componentId, versionId, sourceEnvId);
  const { data: targetDeployment } = useComponentDeployment(orgHandler, orgUuid, componentId, versionId, targetEnvId);
  const promote = usePromote();

  const buildId = sourceDeployment?.build?.buildId;
  const sourceReleaseId = sourceDeployment?.releaseId;
  const alreadyPromoted = !!buildId && buildId === targetDeployment?.build?.buildId;

  const handlePromote = () => {
    if (!buildId || !sourceReleaseId || alreadyPromoted) return;
    promote.mutate({
      componentId,
      apiVersionId: versionId,
      sourceReleaseId,
      targetEnvironmentId: targetEnvId,
      deploymentPipelineId,
    });
  };

  const tooltipTitle = !buildId ? 'No build available to promote' : alreadyPromoted ? 'Already deployed in target environment' : '';

  return (
    <Authorized permissions={Permissions.ENVIRONMENT_MANAGE}>
      <Tooltip title={tooltipTitle}>
        <span>
          <Button variant="outlined" size="small" startIcon={<ArrowDown size={14} />} disabled={!buildId || !sourceReleaseId || alreadyPromoted || promote.isPending} onClick={handlePromote}>
            {promote.isPending ? 'Promoting…' : 'Promote'}
          </Button>
        </span>
      </Tooltip>
    </Authorized>
  );
}
