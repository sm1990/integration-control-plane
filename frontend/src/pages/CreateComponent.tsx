import { Alert, Button, Grid, IconButton, MenuItem, PageContent, Stack, TextField, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft, Edit } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX } from 'react';
import { useNavigate, Link } from 'react-router';
import { useCreateComponent, type CreateComponentInput } from '../api/mutations';
import { resourceUrl, narrow, type ProjectScope } from '../nav';

function toHandler(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CreateComponent(scope: ProjectScope): JSX.Element {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [handler, setHandler] = useState('');
  const [handlerEdited, setHandlerEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [componentType, setComponentType] = useState<'MI' | 'BI'>('MI');
  const mutation = useCreateComponent();

  const effectiveHandler = handlerEdited ? handler : toHandler(displayName);

  const submit = () => {
    const input: CreateComponentInput = {
      displayName,
      name: effectiveHandler,
      description,
      orgHandler: scope.org,
      projectId: scope.project,
      componentType,
    };
    mutation.mutate(input, {
      onSuccess: (component) => navigate(resourceUrl(narrow(scope, component.handler), 'overview')),
    });
  };

  return (
    <PageContent>
      <Link to={resourceUrl(scope, 'overview')} style={{ textDecoration: 'none', color: 'inherit' }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
          <ArrowLeft size={18} />
          <Typography variant="body2">Back to Project Home</Typography>
        </Stack>
      </Link>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
        Create New Integration
      </Typography>

      {mutation.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {mutation.error.message || 'Failed to create integration. Please try again.'}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField label="Display Name" placeholder="Enter display name here" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth slotProps={{ htmlInput: { 'aria-label': 'Display Name' } }} />
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
          <TextField label="Integration Type" select value={componentType} onChange={(e) => setComponentType(e.target.value as 'MI' | 'BI')} fullWidth slotProps={{ htmlInput: { 'aria-label': 'Integration Type' } }}>
            <MenuItem value="MI">MI</MenuItem>
            <MenuItem value="BI">BI</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      <TextField
        label="Description"
        placeholder="Enter description here"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        sx={{ mb: 4, maxWidth: 720 }}
        slotProps={{ htmlInput: { 'aria-label': 'Description' } }}
      />

      <Stack direction="row" gap={2}>
        <Button variant="outlined" onClick={() => navigate(resourceUrl(scope, 'overview'))}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!displayName.trim() || !effectiveHandler || mutation.isPending}>
          Create
        </Button>
      </Stack>
    </PageContent>
  );
}
