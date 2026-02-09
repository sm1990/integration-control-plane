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

import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  IconButton,
  Divider,
  Grid,
  Avatar,
  SearchBar,
  PageTitle,
  PageContent,
  ListingTable,
  Chip,
} from '@wso2/oxygen-ui'
import { LineChart } from '@wso2/oxygen-ui-charts-react'
import { Clock, Plus, RefreshCw, Info, Link as LinkIcon } from '@wso2/oxygen-ui-icons-react'
import type { JSX, ReactNode } from 'react'
import { Link as NavigateLink, useNavigate, useParams } from 'react-router'
import { mockProjects } from '../mock-data/mockProjects'
import { mockComponents } from '../mock-data/mockComponents'
import { mockMcpServers } from '../mock-data/mockMcpServers'

const chartData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((name, i) => ({
  name,
  uData: [4000, 3000, 2000, 2780, 1890, 2390, 3490][i],
  pData: [2400, 1398, 9800, 3908, 4800, 3800, 4300][i],
}))

const LastUpdatedCell = ({ value }: { value: string }) => (
  <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, minWidth: 0 }}>
    <Clock size={16} />
    <Typography variant="caption" color="text.secondary" noWrap>{value}</Typography>
  </Box>
)

const ResourceList = <T,>({ title, headers, items, renderRow }: { title: string, headers: string[], items: T[], renderRow: (item: T) => ReactNode }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
    <ListingTable.Container sx={{ width: '100%' }} disablePaper>
      <ListingTable variant="card" density="standard">
        <ListingTable.Head>
          <ListingTable.Row>
            {headers.map((h, i) => (
              <ListingTable.Cell key={i} align={h === 'Last Updated' ? 'right' : 'left'}>{h}</ListingTable.Cell>
            ))}
          </ListingTable.Row>
        </ListingTable.Head>
        <ListingTable.Body>{items.map(renderRow)}</ListingTable.Body>
      </ListingTable>
    </ListingTable.Container>
  </Box>
)

const SummaryCard = ({ title, children, action }: { title: string, children: ReactNode, action?: ReactNode }) => (
  <Card variant="outlined" sx={{ borderRadius: 0.8 }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        {action}
      </Box>
      {children}
    </CardContent>
  </Card>
)

export default function ProjectOverview(): JSX.Element {
  const navigate = useNavigate()
  const { id, orgId } = useParams<{ id: string; orgId: string }>()
  const project = mockProjects.find(p => p.id === id) || mockProjects[0]

  return (
    <PageContent>
      <Box sx={{ mb: 3 }}>
        <PageTitle>
          <PageTitle.BackButton component={<NavigateLink to={`/o/${orgId}/projects`} />} />
          <PageTitle.Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            {(project.name?.trim()?.[0] ?? 'P').toUpperCase()}
          </PageTitle.Avatar>
          <PageTitle.Header>{project.name}</PageTitle.Header>
          <PageTitle.SubHeader>{project.description || 'No description available'}</PageTitle.SubHeader>
          <PageTitle.Link href="#" icon={<LinkIcon size={14} />}>Link a Repository</PageTitle.Link>
        </PageTitle>

        <Divider sx={{ mt: 2 }} />

        <Grid container spacing={3} mt={2}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 10 }}><SearchBar fullWidth /></Grid>
              <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button fullWidth variant="contained" startIcon={<Plus size={18} />} sx={{ height: 40 }} onClick={() => navigate(`/o/${orgId}/projects/${id}/components/new`)}>Create</Button>
              </Grid>
            </Grid>

            <ResourceList
              title="API Proxies"
              headers={['Name', 'Description', 'Type', 'Last Updated']}
              items={mockComponents}
              renderRow={(component) => (
                <ListingTable.Row key={component.id} variant="card" hover clickable onClick={() => navigate(`components/${component.id}`)}>
                  <ListingTable.Cell>
                    <ListingTable.CellIcon
                      icon={<Avatar sx={{ width: 28, height: 28, bgcolor: 'action.hover', color: 'text.primary' }}>{(component.name?.trim()?.[0] ?? 'A').toUpperCase()}</Avatar>}
                      primary={component.name}
                    />
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 420 }}>
                      This is a sample proxy that manages a list of reading items.
                    </Typography>
                  </ListingTable.Cell>
                  <ListingTable.Cell><Chip label={component.type ?? 'HTTP'} size="small" variant="outlined" /></ListingTable.Cell>
                  <ListingTable.Cell align="right"><LastUpdatedCell value={component.lastModified} /></ListingTable.Cell>
                </ListingTable.Row>
              )}
            />

            <ResourceList
              title="MCP Servers"
              headers={['Name', 'Description', 'Last Updated']}
              items={mockMcpServers.slice(0, 3)}
              renderRow={(server) => (
                <ListingTable.Row key={server.id} variant="card" hover clickable onClick={() => navigate(`components/${server.id}`)}>
                  <ListingTable.Cell>
                    <ListingTable.CellIcon
                      icon={<Avatar sx={{ width: 28, height: 28, bgcolor: 'action.hover', color: 'text.primary' }}>{(server.action?.trim()?.[0] ?? 'M').toUpperCase()}</Avatar>}
                      primary={server.action}
                    />
                  </ListingTable.Cell>
                  <ListingTable.Cell>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 420 }}>
                      This is a sample proxy that manages a list of reading items.
                    </Typography>
                  </ListingTable.Cell>
                  <ListingTable.Cell><Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><LastUpdatedCell value={server.timestamp} /></Box></ListingTable.Cell>
                </ListingTable.Row>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Stack spacing={2}>
              <SummaryCard title="Analytics" action={<IconButton size="small"><RefreshCw size={18} /></IconButton>}>
                <Box sx={{ height: 260, borderRadius: 0.8, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
                  <LineChart data={chartData} xAxisDataKey="name" lines={[{ dataKey: 'pData', name: 'Product A' }, { dataKey: 'uData', name: 'Product B' }]} legend={{ show: true, align: 'center', verticalAlign: 'top' }} height={260} grid={{ show: false }} />
                </Box>
              </SummaryCard>

              <SummaryCard title="API Proxies">
                <Stack spacing={1}>
                  {[
                    { label: 'HTTP', value: 4 },
                    { label: 'Service', value: 1, divider: true },
                    { title: 'MCP Servers', label: 'MCP Servers', value: 3, divider: true },
                    { title: 'Total', value: 8, divider: true, isTotal: true }
                  ].map((item, i) => (
                    <Box key={i}>
                      {item.title && <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: item.title === 'Total' ? 0 : 0.5 }}>{item.title}</Typography>}
                      {item.label && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant={item.isTotal ? "subtitle2" : "caption"} color={item.isTotal ? "text.primary" : "text.secondary"} sx={{ fontWeight: item.isTotal ? 700 : 400 }}>{item.label}</Typography>
                          <Typography variant={item.isTotal ? "subtitle2" : "caption"} sx={{ fontWeight: item.isTotal ? 700 : 400 }}>{item.value}</Typography>
                        </Box>
                      )}
                      {item.divider && <Divider sx={{ my: 0.5 }} />}
                    </Box>
                  ))}
                </Stack>
              </SummaryCard>

              <SummaryCard title="Contributors" action={<Info size={16} />}>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}><Avatar sx={{ width: 32, height: 32 }}>J</Avatar></Box>
              </SummaryCard>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </PageContent>
  )
}
