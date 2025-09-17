import { Typography, Grid } from '@material-ui/core';
import {
  Header,
  Page,
  Content,
  HeaderLabel,
  SupportButton,
} from '@backstage/core-components';
import { IComponentFetchComponent } from '../IComponentFetchComponent';

export const IComponentComponent = ({ projectId }: { projectId?: string }) => (
  <Page themeId="tool">
    <Header title="Components" subtitle={projectId ? `Project ID: ${projectId}` : undefined}>
      <HeaderLabel label="Owner" value="Team X" />
      <HeaderLabel label="Lifecycle" value="Alpha" />
    </Header>
    <Content>
      <SupportButton>Components for the project {projectId}</SupportButton>
      <Grid container spacing={3} direction="column">
        <Grid item>
          <IComponentFetchComponent projectId={projectId} />
        </Grid>
      </Grid>
    </Content>
  </Page>
);
