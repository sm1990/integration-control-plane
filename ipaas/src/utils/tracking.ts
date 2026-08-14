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

// @ts-expect-error: moesif-browser-js does not ship types
import moesif from 'moesif-browser-js';
import { IS_CLOUD, IS_WIP } from '../features';
import { isStrictlyNecessaryCookiesAllowed } from './oneTrustCookiePro';

declare global {
  interface Window {
    dataLayer?: unknown[];
    OptanonWrapper?: () => void;
  }
}

// Ported from choreo-console's index.html + public/js/cookieProInject.<date>.js, which hardcode
// these same two IDs per deployment tier. Microsoft Clarity is not a separate snippet — it's wired
// in as a tag inside the GTM container itself (configured in GTM's own console), so loading GTM is
// sufficient to bring Clarity along; there is nothing else to add for it here.
const WIP_GTM_CONTAINER_ID: Record<'dev' | 'stage' | 'prod', string> = {
  dev: 'GTM-MW3T7S9W',
  stage: 'GTM-MW3T7S9W',
  prod: 'GTM-58TBJFHN',
};

const WIP_COOKIEPRO_DOMAIN_SCRIPT_ID: Record<'dev' | 'stage' | 'prod', string> = {
  dev: '01956090-3b3e-72fc-8434-dd70c76c43d2-test',
  stage: '01956090-3b3e-72fc-8434-dd70c76c43d2-test',
  prod: '01956090-3b3e-72fc-8434-dd70c76c43d2',
};

// Cloud has no tracking codes of its own yet — replace these before Cloud ships with tracking enabled.
const CLOUD_GTM_CONTAINER_ID = 'GTM-XXXXXXX';
const CLOUD_COOKIEPRO_DOMAIN_SCRIPT_ID = 'REPLACE_WITH_CLOUD_COOKIEPRO_DOMAIN_SCRIPT_ID';
const CLOUD_MOESIF_APP_API_KEY = 'REPLACE_WITH_CLOUD_MOESIF_APP_API_KEY';

function injectGtm(containerId: string): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
  // Exempts this tag from OneTrust's script-blocking scanner, matching choreo-console's setup.
  script.setAttribute('data-ot-ignore', '');
  document.head.appendChild(script);

  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${containerId}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.appendChild(iframe);
  document.body.prepend(noscript);
}

// `onReady` runs once OneTrust's own script finishes initializing consent categories — that's
// when it calls window.OptanonWrapper. Checking consent any earlier would see
// `OnetrustActiveGroups` as still undefined, since OneTrust hasn't populated it yet.
function injectCookiePro(domainScriptId: string, onReady: () => void): void {
  window.OptanonWrapper = onReady;

  const script = document.createElement('script');
  script.src = 'https://cookie-cdn.cookiepro.com/scripttemplates/otSDKStub.js';
  script.type = 'text/javascript';
  script.charset = 'UTF-8';
  script.setAttribute('data-domain-script', domainScriptId);
  document.head.appendChild(script);
}

// Bootstraps the Moesif SDK, which auto-instruments fetch/XHR to capture API traffic — mirrors
// choreo-console's getMoesifClient(), minus the org-registration/identify calls that depend on
// this app's auth context (out of scope for just wiring up the tracking codes themselves).
function initMoesif(applicationId: string | undefined): void {
  if (!applicationId || !isStrictlyNecessaryCookiesAllowed()) return;
  moesif.init({ applicationId, batchEnabled: true, batchSize: 20, batchMaxTime: 5000 }).start();
}

/**
 * Loads the product's tracking scripts: GTM (which also carries Clarity as a GTM tag), CookiePro,
 * and Moesif. WIP uses choreo-console's real codes; Cloud uses placeholders until it has its own;
 * ICP loads nothing.
 */
export function initTracking(): void {
  if (IS_WIP) {
    const env = window.API_CONFIG?.trackingEnv ?? 'dev';
    injectGtm(WIP_GTM_CONTAINER_ID[env]);
    injectCookiePro(WIP_COOKIEPRO_DOMAIN_SCRIPT_ID[env], () => initMoesif(window.API_CONFIG?.moesifAppApiKey));
    return;
  }

  if (IS_CLOUD) {
    injectGtm(CLOUD_GTM_CONTAINER_ID);
    injectCookiePro(CLOUD_COOKIEPRO_DOMAIN_SCRIPT_ID, () => initMoesif(CLOUD_MOESIF_APP_API_KEY));
  }

  // ICP: no tracking.
}
