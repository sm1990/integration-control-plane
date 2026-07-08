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

import { Box, MenuItem, Select, Typography } from '@wso2/oxygen-ui';
import { useMemo } from 'react';
import type { JSX } from 'react';

const FLAG_EMOJI: Record<string, string> = {
  US: '🇺🇸',
  EU: '🇪🇺',
};

interface RegionSelectorProps {
  /** The page to land on after switching regions. */
  currentPage: 'login' | 'signup';
}

/**
 * Parses AVAILABLE_LOGIN_REGIONS ("US::https://...,EU::https://...") and renders
 * a dropdown that redirects to the selected region's domain, preserving query params.
 * Renders nothing when fewer than 2 regions are configured.
 */
export default function RegionSelector({ currentPage }: RegionSelectorProps): JSX.Element | null {
  const raw = window.API_CONFIG.availableLoginRegions;

  const regionDomainMap = useMemo(() => {
    const map = new Map<string, string>();
    raw?.split(',').forEach((entry) => {
      const [key, value] = entry.split('::');
      if (key?.trim() && value?.trim()) map.set(key.trim(), value.trim());
    });
    return map;
  }, [raw]);

  const selectedRegion = useMemo(() => {
    const match = Array.from(regionDomainMap.entries()).find(([, domain]) => domain === window.location.origin);
    return match ? match[0] : (Array.from(regionDomainMap.keys())[0] ?? '');
  }, [regionDomainMap]);

  if (regionDomainMap.size < 2) return null;

  const handleChange = (e: { target: { value: string } }) => {
    const region = e.target.value;
    const domain = regionDomainMap.get(region);
    if (!domain) return;

    const currentUrl = new URL(window.location.href);
    const newUrl = new URL(`${domain}/${currentPage}`);

    // Preserve all query params (e.g. state, method, returnToUrl)
    currentUrl.searchParams.forEach((value, key) => {
      newUrl.searchParams.set(key, value);
    });

    window.location.href = newUrl.toString();
  };

  return (
    <Select
      value={selectedRegion}
      onChange={handleChange}
      size="small"
      variant="outlined"
      inputProps={{ 'aria-label': 'Select region' }}
      sx={{ minWidth: 110, borderRadius: '8px', fontSize: '0.875rem' }}>
      {Array.from(regionDomainMap.keys()).map((region) => (
        <MenuItem key={region} value={region}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {FLAG_EMOJI[region] && (
              <span role="img" aria-label={`${region} flag`} style={{ fontSize: '1.1rem', lineHeight: 1 }}>
                {FLAG_EMOJI[region]}
              </span>
            )}
            <Typography variant="body2">{region}</Typography>
          </Box>
        </MenuItem>
      ))}
    </Select>
  );
}
