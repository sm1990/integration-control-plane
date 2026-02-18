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

import { Box, Button, PageContent, PageTitle, Typography, Chip, IconButton, SearchBarWithAdvancedFilter, ListingTable, Tooltip, Card, Grid, Link, type AdvancedFilterState } from '@wso2/oxygen-ui';
import { Plus, Folder, ExternalLink, Info, Edit, Trash2, SlidersHorizontal, Building2, ArrowRight } from '@wso2/oxygen-ui-icons-react';
import { useNavigate } from 'react-router';
import { useMemo, useState, type JSX } from 'react';
import { newOrgUrl, editOrgUrl, orgProjectsUrl, external } from '../paths';
import { mockOrganizations } from '../mock-data/mockOrganizations';
import { mockExploreMoreSections } from '../mock-data/mockExploreMoreSections';
import type { Organization, ExploreMoreSection } from '../mock-data/types';
import EmptyListing from '../components/EmptyListing';

const ExploreSection = ({ icon: Icon, title, items }: ExploreMoreSection) => (
  <Box display="flex" alignItems="flex-start" gap={2}>
    <Box sx={{ color: 'primary.main', mt: 0.25 }}>
      <Icon size={34} />
    </Box>
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box display="flex" flexDirection="column">
        {items.map((item) => (
          <Button key={item.id} variant="text" size="small" startIcon={<ArrowRight size={16} />} sx={{ justifyContent: 'flex-start' }} onClick={() => console.log('Explore item:', item.label)}>
            {item.label}
          </Button>
        ))}
      </Box>
    </Box>
  </Box>
);

export default function Organizations(): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AdvancedFilterState>({} as AdvancedFilterState);

  const organizations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? mockOrganizations : mockOrganizations.filter((o) => o.name.toLowerCase().includes(q) || o.orgId.toLowerCase().includes(q));
  }, [query]);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Organizations</PageTitle.Header>
        <PageTitle.SubHeader>
          Create and manage organizations
          <Link href={external.wso2} target="_blank" rel="noopener noreferrer" sx={{ ml: 1 }}>
            <ExternalLink size={16} /> Learn More
          </Link>
        </PageTitle.SubHeader>
        <PageTitle.Actions>
          <Button variant="contained" startIcon={<Plus size={20} />} onClick={() => navigate(newOrgUrl())}>
            New Organization
          </Button>
        </PageTitle.Actions>
      </PageTitle>

      <Box sx={{ mb: 3 }}>
        <SearchBarWithAdvancedFilter value={query} onChange={setQuery} advancedFilter={filter} onAdvancedFilterChange={setFilter} attributeOptions={[]} conditionOptions={[]} fullWidth />
      </Box>

      {organizations.length === 0 ? (
        <EmptyListing
          icon={<Folder size={48} />}
          title="No organizations found"
          description={query ? 'Try adjusting your search' : 'Create your first organization to get started'}
          showAction={!query}
          actionLabel="Create Organization"
          onAction={() => navigate(newOrgUrl())}
        />
      ) : (
        <ListingTable.Container sx={{ width: '100%' }} disablePaper>
          <ListingTable variant="card" density="standard">
            <ListingTable.Body>
              {organizations.map((org: Organization) => (
                <ListingTable.Row key={org.id} variant="card" hover clickable onClick={() => navigate(orgProjectsUrl(org.orgId))}>
                  <ListingTable.Cell>
                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                      <Box display="flex" alignItems="center" gap={2} minWidth={0}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                            flexShrink: 0,
                          }}>
                          <Building2 size={22} />
                        </Box>
                        <Box minWidth={0}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6" sx={{ lineHeight: 1.2 }} noWrap>
                              {org.name}
                            </Typography>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: org.status === 'active' ? 'success.main' : 'text.disabled',
                                flexShrink: 0,
                              }}
                            />
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Typography variant="body2" color="text.secondary">
                              Organization Id:
                            </Typography>
                            <Chip label={org.orgId} size="small" variant="outlined" />
                          </Box>
                        </Box>
                      </Box>

                      <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
                        {[
                          {
                            title: 'Info',
                            icon: <Info size={18} />,
                            action: () => console.log('Info:', org.id),
                          },
                          {
                            title: 'Settings',
                            icon: <SlidersHorizontal size={18} />,
                            action: () => console.log('Settings:', org.id),
                          },
                          {
                            title: 'Edit',
                            icon: <Edit size={18} />,
                            action: () => navigate(editOrgUrl(org.id)),
                          },
                          {
                            title: 'Delete',
                            icon: <Trash2 size={18} />,
                            color: 'error',
                            action: () => console.log('Delete:', org.id),
                          },
                        ].map(({ title, icon, color, action }) => (
                          <Tooltip title={title} key={title}>
                            <IconButton
                              size="small"
                              color={color as 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                              onClick={(e) => {
                                e.stopPropagation();
                                action();
                              }}>
                              {icon}
                            </IconButton>
                          </Tooltip>
                        ))}
                      </Box>
                    </Box>
                  </ListingTable.Cell>
                </ListingTable.Row>
              ))}
            </ListingTable.Body>
          </ListingTable>
        </ListingTable.Container>
      )}

      <Box sx={{ mt: 5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Explore More
        </Typography>
        <Card variant="outlined" sx={{ p: 3 }}>
          <Grid container spacing={6}>
            {mockExploreMoreSections.map((section) => (
              <Grid key={section.id} size={{ xs: 12, md: 4 }}>
                <ExploreSection {...section} />
              </Grid>
            ))}
          </Grid>
        </Card>
      </Box>
    </PageContent>
  );
}
