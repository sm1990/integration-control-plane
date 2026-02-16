import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@wso2/oxygen-ui';
import type { JSX } from 'react';

const cellSx = { borderBottom: '1px solid', borderColor: 'divider' };
const emptySx = { color: 'text.secondary', py: 2 };

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
