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

import { Button, Grid, IconButton, PageContent, Stack, TextField, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft, Edit } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router';
import { useCreateProject, type CreateProjectInput } from '../api/mutations';
import { resourceUrl, narrow, type OrgScope } from '../nav';

function toHandler(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CreateProject(scope: OrgScope): JSX.Element {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [handler, setHandler] = useState('');
  const [handlerEdited, setHandlerEdited] = useState(false);
  const [description, setDescription] = useState('');
  const mutation = useCreateProject();

  const effectiveHandler = handlerEdited ? handler : toHandler(displayName);

  const submit = () => {
    const input: CreateProjectInput = {
      name: displayName,
      handler: effectiveHandler,
      description,
      orgHandler: scope.org,
    };
    mutation.mutate(input, {
      onSuccess: (project) => navigate(resourceUrl(narrow(scope, project.handler), 'overview')),
    });
  };

  return (
    <PageContent>
      <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate(resourceUrl(scope, 'overview'))} sx={{ mb: 2 }}>
        Back to Home
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
        Create a Project
      </Typography>

      <Typography variant="subtitle2" component="p" sx={{ fontWeight: 600, mb: 2 }}>
        Project Details
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField label="Display Name" placeholder="Enter Project Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth slotProps={{ htmlInput: { 'aria-label': 'Display Name' } }} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Name"
            value={effectiveHandler}
            onChange={(e) => {
              setHandler(e.target.value);
              setHandlerEdited(true);
            }}
            fullWidth
            disabled={!handlerEdited}
            slotProps={{
              htmlInput: { 'aria-label': 'Name' },
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setHandlerEdited(!handlerEdited)}>
                    <Edit size={16} />
                  </IconButton>
                ),
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField label="Description (Optional)" placeholder="Enter Description here" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={1} slotProps={{ htmlInput: { 'aria-label': 'Description' } }} />
        </Grid>
      </Grid>

      <Stack direction="row" gap={2}>
        <Button variant="outlined" onClick={() => navigate(resourceUrl(scope, 'overview'))}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!displayName.trim() || mutation.isPending}>
          Create
        </Button>
      </Stack>
    </PageContent>
  );
}
