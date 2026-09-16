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

import type { JSX } from 'react';
import type { Step, StepStatus } from '../../types/stepper';
import HorizontalStepper from '../HorizontalStepper';
import { executionPhase } from '../../utils/executionStatus';

interface TestStepperProps {
  /** True once a run has been triggered (a runId exists). */
  hasTriggered: boolean;
  /** Raw execution status of the tracked run, if found yet. */
  status: string | undefined;
}

/** Triggered → Processing → Result, rendered with the shared resizable stepper. */
export default function TestStepper({ hasTriggered, status }: TestStepperProps): JSX.Element {
  const phase = executionPhase(status);
  const hasExecution = status !== undefined;
  const isTerminal = hasTriggered && (phase === 'succeeded' || phase === 'failed' || phase === 'terminated');

  const processStatus: StepStatus = !hasTriggered ? 'notStarted' : !hasExecution ? 'queued' : phase === 'queued' ? 'queued' : phase === 'inProgress' ? 'inProgress' : 'success';
  const resultStatus: StepStatus = !isTerminal ? 'notStarted' : phase === 'succeeded' ? 'success' : phase === 'terminated' ? 'terminated' : 'failed';

  const steps: Step[] = [
    { id: 'trigger', label: 'Triggered', status: hasTriggered ? 'success' : 'notStarted' },
    { id: 'process', label: 'Processing', status: processStatus },
    { id: 'result', label: 'Result', status: resultStatus },
  ];

  // -1 keeps every step idle until a run is triggered, so "Triggered" isn't lit on load.
  const currentStepIndex = !hasTriggered ? -1 : isTerminal ? 2 : 1;

  return <HorizontalStepper steps={steps} currentStepIndex={currentStepIndex} size="m" paddingY={8} />;
}
