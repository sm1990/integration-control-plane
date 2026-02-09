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

import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  ListingTable,
  Menu,
  MenuItem,
  Select,
  FormControl,
  FormLabel,
  TablePagination,
  PageContent,
  PageTitle,
  type ListingTableDensity,
  type ListingTableSortDirection,
} from '@wso2/oxygen-ui'
import {
  Plus,
  MoreVertical,
  Filter,
  Download,
  FileText,
  Key,
  Shield,
  RefreshCw,
  Lock,
  Inbox,
} from '@wso2/oxygen-ui-icons-react'
import { useNavigate, useParams, Link as NavigateLink } from 'react-router'
import type { JSX } from 'react'
import { mockComponents } from '../mock-data/mockComponents'
import type { Component } from '../mock-data/types'

const TYPE_ICONS: Record<string, any> = {
  Authentication: Key,
  Authorization: Shield,
  Registration: FileText,
  Recovery: RefreshCw,
  'Multi-Factor Authentication': Lock,
}

const STATUS_Map: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success',
  inactive: 'default',
  draft: 'warning',
}

export default function ComponentList(): JSX.Element {
  const navigate = useNavigate()
  const { id, orgId } = useParams<{ id: string; orgId: string }>()

  // Table state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [density, setDensity] = useState<ListingTableDensity>('standard')
  const [sortField, setSortField] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<ListingTableSortDirection>('asc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(5)

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedComponent(null)
  }

  const filteredComponents = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return mockComponents
      .filter(c =>
        (filterType === 'all' || c.type === filterType) &&
        (filterStatus === 'all' || c.status === filterStatus) &&
        (c.name.toLowerCase().includes(q) ||
          c.type.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const aVal = String(a[sortField as keyof Component])
        const bVal = String(b[sortField as keyof Component])
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
  }, [searchQuery, filterType, filterStatus, sortField, sortDirection])

  const paginatedComponents = useMemo(
    () => filteredComponents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredComponents, page, rowsPerPage]
  )

  return (
    <PageContent>
      {/* Header */}
      <PageTitle>
        <PageTitle.BackButton component={<NavigateLink to={`/o/${orgId}/projects/${id}`} />} />
        <PageTitle.Header>Components</PageTitle.Header>
        <PageTitle.SubHeader>Manage authentication components for your project</PageTitle.SubHeader>
        <PageTitle.Actions>
          <Button variant="outlined" startIcon={<Download size={18} />}>
            Export
          </Button>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => navigate(`/projects/${id}/components/new`)}>
            New Component
          </Button>
        </PageTitle.Actions>
      </PageTitle>

      {/* Filters */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'end' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <FormLabel>Type</FormLabel>
              <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="Authentication">Authentication</MenuItem>
                <MenuItem value="Authorization">Authorization</MenuItem>
                <MenuItem value="Registration">Registration</MenuItem>
                <MenuItem value="Recovery">Recovery</MenuItem>
                <MenuItem value="Multi-Factor Authentication">MFA</MenuItem>
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 200 }}>
              <FormLabel>Status</FormLabel>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" startIcon={<Filter size={18} />}>
              More Filters
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Components Table using ListingTable with Provider */}
      <ListingTable.Provider
        searchValue={searchQuery}
        onSearchChange={(val) => { setSearchQuery(val); setPage(0) }}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(f, d) => { setSortField(f); setSortDirection(d) }}
        density={density}
        onDensityChange={setDensity}
      >
        <ListingTable.Container disablePaper>
          <ListingTable.Toolbar
            showSearch
            searchPlaceholder="Search components..."
            actions={<ListingTable.DensityControl />}
          />
          <ListingTable variant="card" density={density}>
            <ListingTable.Head>
              <ListingTable.Row>
                {['name', 'type', 'category', 'status', 'author', 'lastModified'].map((field) => (
                  <ListingTable.Cell key={field}>
                    <ListingTable.SortLabel field={field}>
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                    </ListingTable.SortLabel>
                  </ListingTable.Cell>
                ))}
                <ListingTable.Cell align="right">Actions</ListingTable.Cell>
              </ListingTable.Row>
            </ListingTable.Head>
            <ListingTable.Body>
              {paginatedComponents.length === 0 ? (
                <ListingTable.Row>
                  <ListingTable.Cell colSpan={7}>
                    <ListingTable.EmptyState
                      illustration={<Inbox size={64} />}
                      title="No components found"
                      description={
                        searchQuery || filterType !== 'all' || filterStatus !== 'all'
                          ? 'Try adjusting your search or filter criteria'
                          : 'Get started by creating your first authentication component'
                      }
                      action={
                        !searchQuery && filterType === 'all' && filterStatus === 'all' ? (
                          <Button
                            variant="contained"
                            startIcon={<Plus size={16} />}
                            onClick={() => navigate(`/projects/${id}/components/new`)}
                          >
                            Create Component
                          </Button>
                        ) : undefined
                      }
                    />
                  </ListingTable.Cell>
                </ListingTable.Row>
              ) : (
                paginatedComponents.map((component) => (
                  <ListingTable.Row
                    key={component.id}
                    variant="card"
                    hover
                    clickable
                    onClick={() => navigate(`/projects/${id}/components/${component.id}`)}
                  >
                    <ListingTable.Cell>
                      <ListingTable.CellIcon
                        icon={(() => {
                          const Icon = TYPE_ICONS[component.type] || FileText
                          return <Icon size={20} />
                        })()}
                        primary={component.name}
                        secondary={component.description}
                      />
                    </ListingTable.Cell>
                    <ListingTable.Cell>
                      <Chip label={component.type} size="small" variant="outlined" />
                    </ListingTable.Cell>
                    <ListingTable.Cell>{component.category}</ListingTable.Cell>
                    <ListingTable.Cell>
                      <Chip label={component.status} size="small" color={STATUS_Map[component.status] || 'default'} />
                    </ListingTable.Cell>
                    <ListingTable.Cell>{component.author}</ListingTable.Cell>
                    <ListingTable.Cell>{component.lastModified}</ListingTable.Cell>
                    <ListingTable.Cell align="right">
                      <ListingTable.RowActions visibility="hover">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAnchorEl(e.currentTarget)
                            setSelectedComponent(component.id)
                          }}
                        >
                          <MoreVertical size={18} />
                        </IconButton>
                      </ListingTable.RowActions>
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ))
              )}
            </ListingTable.Body>
          </ListingTable>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredComponents.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
          />
        </ListingTable.Container>
      </ListingTable.Provider>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => { navigate(`/projects/${id}/components/${selectedComponent}`); handleMenuClose() }}>
          View Details
        </MenuItem>
        <MenuItem onClick={() => { navigate(`/projects/${id}/components/${selectedComponent}/edit`); handleMenuClose() }}>
          Edit
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>Duplicate</MenuItem>
        <MenuItem onClick={handleMenuClose}>Export</MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>
    </PageContent>
  )
}
