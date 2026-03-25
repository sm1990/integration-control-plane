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

import { Alert, Snackbar } from '@wso2/oxygen-ui';

interface EnvironmentCardFooterProps {
  triggerMessage: string | null;
  scheduleSavedMessage: string | null;
  onTriggerMessageClose: () => void;
  onScheduleSavedMessageClose: () => void;
}

export default function EnvironmentCardFooter({ triggerMessage, scheduleSavedMessage, onTriggerMessageClose, onScheduleSavedMessageClose }: EnvironmentCardFooterProps) {
  return (
    <>
      <Snackbar open={triggerMessage !== null} autoHideDuration={4000} onClose={onTriggerMessageClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={onTriggerMessageClose} severity="success" sx={{ width: '100%' }}>
          {triggerMessage}
        </Alert>
      </Snackbar>
      <Snackbar open={scheduleSavedMessage !== null} autoHideDuration={4000} onClose={onScheduleSavedMessageClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={onScheduleSavedMessageClose} severity="success" sx={{ width: '100%' }}>
          {scheduleSavedMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
