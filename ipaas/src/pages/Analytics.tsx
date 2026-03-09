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

import { Box, Button, Card, CardContent, Typography, Tabs, Tab, Chip, Divider, List, ListItem, ListItemText, Grid, PageContent, StatCard, PageTitle } from '@wso2/oxygen-ui';
import { LineChart, BarChart, PieChart } from '@wso2/oxygen-ui-charts-react';
import { Activity, FileText, Users, Clock, Logs } from '@wso2/oxygen-ui-icons-react';
import { useNavigate, useParams } from 'react-router';
import { orgAnalyticsLogsUrl } from '../paths';
import { useState, type JSX, type ReactNode } from 'react';

type Stat = {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: 'primary' | 'success' | 'info' | 'warning';
};
type ActivityItem = { id: string; action: string; user: string; time: string };

const stats: Stat[] = [
  {
    label: 'Components',
    value: 4,
    icon: <FileText size={24} />,
    color: 'primary',
  },
  { label: 'Active', value: 3, icon: <Activity size={24} />, color: 'success' },
  { label: 'Contributors', value: 3, icon: <Users size={24} />, color: 'info' },
  {
    label: 'Last Updated',
    value: '2h',
    icon: <Clock size={24} />,
    color: 'warning',
  },
];

const recentActivity: ActivityItem[] = [
  {
    id: '1',
    action: 'Updated Login Flow',
    user: 'John Doe',
    time: '2 hours ago',
  },
  {
    id: '2',
    action: 'Created Sign Up Flow',
    user: 'Jane Smith',
    time: '1 day ago',
  },
  {
    id: '3',
    action: 'Modified MFA settings',
    user: 'John Doe',
    time: '2 days ago',
  },
  {
    id: '4',
    action: 'Added Password Reset',
    user: 'Mike Johnson',
    time: '3 days ago',
  },
];

const userGrowth = [
  { month: 'Jan', users: 120 },
  { month: 'Feb', users: 180 },
  { month: 'Mar', users: 240 },
  { month: 'Apr', users: 320 },
  { month: 'May', users: 420 },
  { month: 'Jun', users: 580 },
];

const statusDist = [
  { status: 'Active', count: 3 },
  { status: 'Inactive', count: 1 },
  { status: 'Pending', count: 2 },
];

const traffic = [
  { name: 'Direct', value: 45 },
  { name: 'Organic', value: 30 },
  { name: 'Social', value: 15 },
  { name: 'Referral', value: 10 },
];

const revenue = [
  { month: 'Jan', r: 4500 },
  { month: 'Feb', r: 5200 },
  { month: 'Mar', r: 6100 },
  { month: 'Apr', r: 7300 },
  { month: 'May', r: 8400 },
  { month: 'Jun', r: 9800 },
];

const ChartContainer = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="h6">{title}</Typography>
      {children}
    </CardContent>
  </Card>
);

export default function AnalyticsDashboard(): JSX.Element {
  const navigate = useNavigate();
  const { orgId } = useParams<{ orgId: string }>();
  const [tab, setTab] = useState(0);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>
          Analytics <Chip label="Active" size="small" color="success" />
        </PageTitle.Header>
        <PageTitle.SubHeader>Dashboard of activities</PageTitle.SubHeader>
        <PageTitle.Actions>
          <Button variant="outlined" startIcon={<Logs size={18} />} onClick={() => navigate(orgAnalyticsLogsUrl(orgId ?? ''))}>
            View logs
          </Button>
        </PageTitle.Actions>
      </PageTitle>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((s, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 6, lg: 3 }}>
            <StatCard value={s.value} label={s.label} icon={s.icon} iconColor={s.color} />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Charts" />
          <Tab label="Activity" />
        </Tabs>
      </Box>

      {tab === 0 ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartContainer title="User Growth">
              <LineChart data={userGrowth} xAxisDataKey="month" lines={[{ dataKey: 'users', name: 'Users' }]} legend={{ show: true, align: 'center', verticalAlign: 'top' }} height={400} grid={{ show: false }} />
            </ChartContainer>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartContainer title="Status">
              <BarChart data={statusDist} xAxisDataKey="status" bars={[{ dataKey: 'count', name: 'Count' }]} legend={{ show: true, align: 'center', verticalAlign: 'top' }} height={400} grid={{ show: false }} />
            </ChartContainer>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartContainer title="Traffic">
              <PieChart data={traffic} pies={[{ dataKey: 'value', nameKey: 'name' }]} legend={{ show: true, align: 'center', verticalAlign: 'top' }} height={400} />
            </ChartContainer>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartContainer title="Revenue">
              <BarChart data={revenue} xAxisDataKey="month" bars={[{ dataKey: 'r', name: 'Revenue ($)' }]} legend={{ show: true, align: 'center', verticalAlign: 'top' }} height={400} grid={{ show: false }} />
            </ChartContainer>
          </Grid>
        </Grid>
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Recent Activity
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              {recentActivity.map((a, i) => (
                <Box key={a.id}>
                  <ListItem>
                    <ListItemText primary={a.action} secondary={`${a.user} • ${a.time}`} />
                  </ListItem>
                  {i < recentActivity.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </PageContent>
  );
}
