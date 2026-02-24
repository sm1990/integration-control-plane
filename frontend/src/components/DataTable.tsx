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

import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@wso2/oxygen-ui';
import type { JSX } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const cellSx = { borderBottom: '1px solid', borderColor: 'divider' };
// eslint-disable-next-line react-refresh/only-export-components
export const emptySx = { color: 'text.secondary', py: 2 };

export default function DataTable({ headers, rows, emptyMsg }: { headers?: string[]; rows: (string | JSX.Element)[][]; emptyMsg?: string }) {
  if (rows.length === 0) return <Typography sx={emptySx}>{emptyMsg ?? 'No data available.'}</Typography>;
  return (
    <Table size="small">
      {headers && (
        <TableHead>
          <TableRow>
            {headers.map((h) => (
              <TableCell key={h} sx={{ fontWeight: 600 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
      )}
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j} sx={headers ? undefined : cellSx}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
