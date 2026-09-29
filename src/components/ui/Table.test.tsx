import { fireEvent, render, screen } from '@testing-library/react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from './Table';

describe('Table', () => {
  it('exposes sort state with aria-sort and reports sort requests', () => {
    const onSort = vi.fn();
    render(
      <TableContainer label="Applications">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell sortDirection="asc" onSort={onSort}>
                Deadline
              </TableHeaderCell>
              <TableHeaderCell sortDirection={null} onSort={onSort}>
                University
              </TableHeaderCell>
              <TableHeaderCell>Program</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>a</TableCell>
              <TableCell>b</TableCell>
              <TableCell>c</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>,
    );
    expect(screen.getByRole('region', { name: 'Applications' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('columnheader', { name: 'Deadline' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: 'University' })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    expect(screen.getByRole('columnheader', { name: 'Program' })).not.toHaveAttribute('aria-sort');
    fireEvent.click(screen.getByRole('button', { name: 'University' }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });
});
