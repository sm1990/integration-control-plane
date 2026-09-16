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

import { useEffect, useRef } from 'react';

interface Removable {
  id: string;
  deleting?: boolean;
}

/**
 * Calls `onRemoved` once a deleting entry drops out of the list. A delete is only
 * accepted when the request returns, so confirming then would outrun the backend.
 * `scopeKey` identifies which list these entries belong to.
 */
export function useRemovalNotice<T extends Removable>(scopeKey: string, items: T[] | undefined, labelOf: (item: T) => string, onRemoved: (label: string) => void): void {
  const pending = useRef<Map<string, string>>(new Map());
  const scope = useRef(scopeKey);
  const notify = useRef(onRemoved);
  notify.current = onRemoved;

  useEffect(() => {
    // The list swaps wholesale on a scope change; ids pending from the old one are
    // absent from the new one and would read as removals.
    if (scope.current !== scopeKey) {
      scope.current = scopeKey;
      pending.current.clear();
    }
    if (!items) return;
    const present = new Set(items.map((item) => item.id));
    pending.current.forEach((label, id) => {
      if (present.has(id)) return;
      pending.current.delete(id);
      notify.current(label);
    });
    items.forEach((item) => {
      if (item.deleting) pending.current.set(item.id, labelOf(item));
    });
    // labelOf is a render-scoped closure; the effect keys off the list and scope alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, scopeKey]);
}
