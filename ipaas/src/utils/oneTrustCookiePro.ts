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

// Ported from choreo-console's src/utils/oneTrustCookiePro — trimmed to the one category this app
// actually gates on (Moesif requires Strictly Necessary consent). Add the other categories back
// here if another tracker needs to check them.

declare global {
  const OnetrustActiveGroups: string;
}

enum CookieProCategory {
  StrictlyNecessary = 'Strictly Necessary Cookies',
}

// OneTrust's own script populates `OnetrustActiveGroups` (a comma-joined list of consented
// category codes, e.g. "C0001,C0003") once it finishes initializing — see the OptanonWrapper
// callback in tracking.ts, which only calls this after that has happened.
function getUserAllowedCategories(): CookieProCategory[] | null {
  if (typeof OnetrustActiveGroups === 'undefined') return null;
  const categoryLabels: Record<string, CookieProCategory> = { C0001: CookieProCategory.StrictlyNecessary };
  return OnetrustActiveGroups.split(',')
    .filter(Boolean)
    .map((code) => categoryLabels[code])
    .filter((category): category is CookieProCategory => category !== undefined);
}

export function isStrictlyNecessaryCookiesAllowed(): boolean {
  return getUserAllowedCategories()?.includes(CookieProCategory.StrictlyNecessary) ?? false;
}
