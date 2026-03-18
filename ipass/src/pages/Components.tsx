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

import { useState, useMemo, type JSX } from 'react';
import { Box, Button, Card, CardContent, Chip, IconButton, ListingTable, Menu, MenuItem, Select, FormControl, FormLabel, TablePagination, PageContent, PageTitle, type ListingTableDensity, CircularProgress } from '@wso2/oxygen-ui';
import { Plus, MoreVertical, Filter, Download, FileText, Key, Shield, RefreshCw, Lock, Inbox } from '@wso2/oxygen-ui-icons-react';
import { useNavigate, useParams, Link as NavigateLink } from 'react-router';
import { useComponents } from '../api/queries';
import { projectUrl, newComponentUrl, componentUrl, editComponentUrl } from '../paths';
import { getStatusColor } from '../config/statusColors';
import { capitalize } from '../utils/string';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Authentication: Key,
  Authorization: Shield,
  Registration: FileText,
  Recovery: RefreshCw,
  'Multi-Factor Authentication': Lock,
};

type Filters = { type: string; status: string; query: string };

const FilterBar = ({ filters, onChange }: { filters: Filters; onChange: (f: Partial<Filters>) => void }) => (
  <Card variant="outlined" sx={{ mb: 3 }}>
    <CardContent>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'end' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <FormLabel>Type</FormLabel>
          <Select value={filters.type} onChange={(e) => onChange({ type: e.target.value as string })}>
            <MenuItem value="all">All Types</MenuItem>
            {['Authentication', 'Authorization', 'Registration', 'Recovery', 'Multi-Factor Authentication'].map((t) => (
              <MenuItem key={t} value={t}>
                {t === 'Multi-Factor Authentication' ? 'MFA' : t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <FormLabel>Status</FormLabel>
          <Select value={filters.status} onChange={(e) => onChange({ status: e.target.value as string })}>
            <MenuItem value="all">All Status</MenuItem>
            {['active', 'inactive', 'draft'].map((s) => (
              <MenuItem key={s} value={s}>
                {capitalize(s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="outlined" startIcon={<Filter size={18} />}>
          More Filters
        </Button>
      </Box>
    </CardContent>
  </Card>
);

const ActionMenu = ({ anchor, onClose, onView, onEdit }: { anchor: HTMLElement | null; onClose: () => void; onView: () => void; onEdit: () => void }) => (
  <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={onClose}>
    <MenuItem onClick={onView}>View Details</MenuItem>
    <MenuItem onClick={onEdit}>Edit</MenuItem>
    <MenuItem onClick={onClose}>Duplicate</MenuItem>
    <MenuItem onClick={onClose}>Export</MenuItem>
    <MenuItem onClick={onClose} sx={{ color: 'error.main' }}>
      Delete
    </MenuItem>
  </Menu>
);

export default function Components(): JSX.Element {
  const navigate = useNavigate();
  const { id, orgId } = useParams<{ id: string; orgId: string }>();
  const { data: components = [], isLoading, refetch, isFetching } = useComponents(orgId ?? '', id ?? '');
  const [filters, setFilters] = useState<Filters>({
    type: 'all',
    status: 'all',
    query: '',
  });
  const [density, setDensity] = useState<ListingTableDensity>('standard');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(5);
  const [menu, setMenu] = useState<{
    el: HTMLElement | null;
    handler: string | null;
  }>({ el: null, handler: null });

  const list = useMemo(() => {
    const q = filters.query.toLowerCase();
    return components.filter(
      (c) => (filters.type === 'all' || c.componentType === filters.type) && (filters.status === 'all' || c.status === filters.status) && (!q || [c.name, c.displayName, c.componentType, c.description].some((s) => s?.toLowerCase().includes(q))),
    );
  }, [filters, components]);

  const maxPage = Math.max(0, Math.ceil(list.length / rows) - 1);
  const safePage = Math.min(page, maxPage);
  const paginated = list.slice(safePage * rows, (safePage + 1) * rows);
  const Icon = (type: string) => ICONS[type] || FileText;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <PageContent>
        <PageTitle>
          <PageTitle.BackButton component={<NavigateLink to={orgId && id ? projectUrl(orgId, id) : '#'} />} />
          <PageTitle.Header>Components</PageTitle.Header>
          <PageTitle.SubHeader>Manage authentication components</PageTitle.SubHeader>
          <PageTitle.Actions>
            <IconButton size="small" onClick={() => refetch()} disabled={isFetching} sx={{ mr: 1 }}>
              <RefreshCw size={18} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
            <Button variant="outlined" startIcon={<Download size={18} />}>
              Export
            </Button>
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => orgId && id && navigate(newComponentUrl(orgId, id))}>
              New Component
            </Button>
          </PageTitle.Actions>
        </PageTitle>

        <FilterBar filters={filters} onChange={(f) => setFilters((p) => ({ ...p, ...f }))} />

        <ListingTable.Provider searchValue={filters.query} onSearchChange={(q) => setFilters((p) => ({ ...p, query: q }))} density={density} onDensityChange={setDensity}>
          <ListingTable.Container disablePaper>
            <ListingTable.Toolbar showSearch searchPlaceholder="Search components..." actions={<ListingTable.DensityControl />} />
            <ListingTable variant="card" density={density}>
              <ListingTable.Head>
                <ListingTable.Row>
                  {['name', 'type', 'category', 'status', 'createdAt', 'lastBuildDate'].map((f) => (
                    <ListingTable.Cell key={f}>
                      <ListingTable.SortLabel field={f}>{f === 'createdAt' ? 'Created' : f === 'lastBuildDate' ? 'Last build' : capitalize(f)}</ListingTable.SortLabel>
                    </ListingTable.Cell>
                  ))}
                  <ListingTable.Cell align="right">Actions</ListingTable.Cell>
                </ListingTable.Row>
              </ListingTable.Head>
              <ListingTable.Body>
                {isLoading ? (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={7} align="center">
                      <CircularProgress size={32} sx={{ my: 4 }} />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ) : paginated.length === 0 ? (
                  <ListingTable.Row>
                    <ListingTable.Cell colSpan={7}>
                      <ListingTable.EmptyState
                        illustration={<Inbox size={64} />}
                        title="No components found"
                        description="Try adjusting your filters"
                        action={
                          !filters.query && filters.type === 'all' ? (
                            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => orgId && id && navigate(newComponentUrl(orgId, id))}>
                              Create Component
                            </Button>
                          ) : undefined
                        }
                      />
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ) : (
                  paginated.map((c) => {
                    const TI = Icon(c.componentType);
                    return (
                      <ListingTable.Row key={c.id} variant="card" hover clickable onClick={() => orgId && id && navigate(componentUrl(orgId, id, c.handler))}>
                        <ListingTable.Cell>
                          <ListingTable.CellIcon icon={<TI size={20} />} primary={c.displayName || c.name} secondary={c.description} />
                        </ListingTable.Cell>
                        <ListingTable.Cell>
                          <Chip label={c.componentType} size="small" variant="outlined" />
                        </ListingTable.Cell>
                        <ListingTable.Cell>{c.componentSubType || '—'}</ListingTable.Cell>
                        <ListingTable.Cell>
                          <Chip label={c.status} size="small" color={getStatusColor(c.status)} />
                        </ListingTable.Cell>
                        <ListingTable.Cell>{c.createdAt || '—'}</ListingTable.Cell>
                        <ListingTable.Cell>{c.lastBuildDate || '—'}</ListingTable.Cell>
                        <ListingTable.Cell align="right">
                          <ListingTable.RowActions visibility="hover">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenu({ el: e.currentTarget, handler: c.handler });
                              }}>
                              <MoreVertical size={18} />
                            </IconButton>
                          </ListingTable.RowActions>
                        </ListingTable.Cell>
                      </ListingTable.Row>
                    );
                  })
                )}
              </ListingTable.Body>
            </ListingTable>
            <TablePagination
              component="div"
              count={list.length}
              rowsPerPage={rows}
              page={safePage}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => {
                setRows(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </ListingTable.Container>
        </ListingTable.Provider>

        <ActionMenu
          anchor={menu.el}
          onClose={() => setMenu({ el: null, handler: null })}
          onView={() => {
            if (orgId && id && menu.handler) navigate(componentUrl(orgId, id, menu.handler));
            setMenu({ el: null, handler: null });
          }}
          onEdit={() => {
            if (orgId && id && menu.handler) navigate(editComponentUrl(orgId, id, menu.handler));
            setMenu({ el: null, handler: null });
          }}
        />
      </PageContent>
    </>
  );
}
