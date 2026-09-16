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

export const CARD_HOVER_SX = {
  boxShadow: 'none',
  transition: 'all 0.2s ease-in-out',
  cursor: 'pointer',
  '&:hover': {
    boxShadow: (theme: { palette: { primary: { main: string } } }) => `0px 0px 0px 1.5px ${theme.palette.primary.main}`,
  },
} as const;

export const PROVIDER_ICON_SX = {
  width: 40,
  height: 40,
  color: 'text.secondary',
  '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
} as const;

/**
 * GitHub's brand guidelines require its mark to stay black/white — never
 * recolored on hover — so this omits PROVIDER_ICON_SX's hover color swap.
 */
export const GITHUB_ICON_SX = {
  width: 40,
  height: 40,
  color: 'text.primary',
  '&:hover': { bgcolor: 'action.hover' },
} as const;

/** Colors a required TextField's asterisk red. */
export const REQUIRED_FIELD_SX = { '& .MuiFormLabel-asterisk': { color: 'error.main' } } as const;

/** Label sitting above a card, outside it — the option's name in the create flows. */
export const SECTION_LABEL_SX = {
  color: 'text.secondary',
  fontWeight: 500,
} as const;

/**
 * Compact pill-shaped Select used in page headers and toolbars (environment picker,
 * deployment track, API/endpoint pickers).
 *
 * `borderRadius` is set on the root as well as the outline: oxygen's theme gives
 * MuiOutlinedInput a `background.acrylic` fill at radius 8, so rounding only the
 * notched outline leaves the root's square corners showing past the border.
 */
export const PILL_SELECT_SX = {
  fontSize: '0.8125rem',
  borderRadius: 5,
  '& .MuiOutlinedInput-notchedOutline': { borderRadius: 5 },
  '& .MuiSelect-select': { py: 0.5, px: 1.5 },
} as const;

/**
 * Cancels oxygen's `top: -7px` nudge on a resting select label. That correction is
 * calibrated for size="medium" (MUI rests those at translate(14px, 16px) versus
 * small's 9px), so on a small select it double-corrects and the label floats above
 * centre. Apply to any small Select/TextField that carries a label.
 */
export const SMALL_SELECT_LABEL_SX = {
  '& .MuiInputLabel-root:not(.MuiInputLabel-shrink)': { top: 0 },
} as const;
