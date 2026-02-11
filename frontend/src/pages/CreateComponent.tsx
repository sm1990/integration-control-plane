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

import { Button, PageContent, Stack, TextField, Select, MenuItem, IconButton, InputAdornment, Typography, FormHelperText, Box, CircularProgress, Backdrop } from '@wso2/oxygen-ui';
import { useState, type JSX } from 'react';
import { useNavigate, useParams } from 'react-router';
import { componentUrl, projectUrl } from '../paths';
import { PencilIcon, ArrowLeft } from '@wso2/oxygen-ui-icons-react';
import { useProject, useComponents } from '../api/queries';
import { useCreateComponent } from '../api/mutations';

export default function CreateComponent(): JSX.Element {
  const navigate = useNavigate();
  const { orgHandler = 'default', projectId = '' } = useParams<{ orgHandler: string; projectId: string }>();
  
  // Fetch project and components data on page load
  useProject(projectId);
  useComponents(orgHandler, projectId);

  const createComponent = useCreateComponent();

  const [displayName, setDisplayName] = useState('');
  const [name, setName] = useState('');
  const [integrationType, setIntegrationType] = useState('MI');
  const [description, setDescription] = useState('');
  const [isNameEditable, setIsNameEditable] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');

  // Remove useEffect: auto-generate name directly in handler

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!value) {
      setDisplayNameError('Enter the display name here');
    } else if (value.length < 3) {
      setDisplayNameError('Display name must be at least 3 characters');
    } else {
      setDisplayNameError('');
    }
    if (!isNameEditable) {
      const generatedName = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setName(generatedName);
    }
  };

  const handleCreate = async () => {
    if (!displayName) {
      setDisplayNameError('Enter the display name here');
      return;
    }
    if (displayName.length < 3) {
      setDisplayNameError('Display name must be at least 3 characters');
      return;
    }

    try {
      const result = await createComponent.mutateAsync({
        displayName,
        name,
        componentType: integrationType,
        description,
        projectId,
        orgHandler,
      });

      // Redirect to component overview page
      navigate(componentUrl(orgHandler, projectId, result.handler));
    } catch (error) {
      console.error('Failed to create component:', error);
      // TODO: Show error notification
    }
  };

  const handleCancel = () => {
    navigate(projectUrl(orgHandler, projectId));
  };

  return (
    <PageContent>
      <Backdrop open={createComponent.isPending} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: 'rgba(0, 0, 0, 0.5)' }}>
        <CircularProgress />
      </Backdrop>
      
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Back button and title */}
        <Button
          variant="text"
          startIcon={<ArrowLeft size={16} />}
          onClick={handleCancel}
          sx={{ mb: 3, color: 'text.secondary' }}
          disabled={createComponent.isPending}>
          Back to Project Home
        </Button>

        <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
          Create New Integration
        </Typography>

        {/* Form */}
        <Stack spacing={3} sx={{ maxWidth: 800 }}>
          {/* Display Name and Name Row */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, height: 32, display: 'flex', alignItems: 'center' }}>
                Display Name
              </Typography>
              <TextField
                fullWidth
                placeholder="Enter display name here"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                error={!!displayNameError}
                disabled={createComponent.isPending}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.paper',
                  },
                }}
              />
              {displayNameError && (
                <FormHelperText error sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <span>⚠</span> {displayNameError}
                </FormHelperText>
              )}
            </Box>

            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1, height: 32 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Name
                </Typography>
                <IconButton size="small" sx={{ color: 'text.secondary', p: 0.25 }} disabled={createComponent.isPending}>
                  <Box component="span" sx={{ fontSize: 14, fontWeight: 400 }}>
                    ?
                  </Box>
                </IconButton>
              </Stack>
              <TextField
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isNameEditable || createComponent.isPending}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setIsNameEditable(!isNameEditable)}
                        sx={{ color: 'text.secondary' }}
                        disabled={createComponent.isPending}>
                        <PencilIcon size={16} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isNameEditable ? 'background.paper' : 'action.hover',
                  },
                }}
              />
            </Box>

            <Box sx={{ width: 200 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, height: 32, display: 'flex', alignItems: 'center' }}>
                Integration Type
              </Typography>
              <Select
                fullWidth
                value={integrationType}
                onChange={(e) => setIntegrationType(e.target.value as string)}
                disabled={createComponent.isPending}
                sx={{
                  bgcolor: 'background.paper',
                }}>
                <MenuItem value="MI">MI</MenuItem>
                <MenuItem value="BI">BI</MenuItem>
              </Select>
            </Box>
          </Stack>

          {/* Description */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              Description
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="Enter description here"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createComponent.isPending}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                },
              }}
            />
          </Box>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
            <Button variant="outlined" onClick={handleCancel} disabled={createComponent.isPending}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleCreate} 
              disabled={!displayName || displayName.length < 3 || createComponent.isPending}
              startIcon={createComponent.isPending ? <CircularProgress size={16} /> : undefined}>
              {createComponent.isPending ? 'Creating...' : 'Create'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </PageContent>
  );
}
