import { Button, Checkbox, FormControlLabel, PageContent, Stack, TextField, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX } from 'react';
import { useNavigate, Link } from 'react-router';
import { useCreateEnvironment } from '../api/mutations';
import { resourceUrl, type OrgScope } from '../nav';

export default function CreateEnvironment(scope: OrgScope): JSX.Element {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [critical, setCritical] = useState(false);
  const mutation = useCreateEnvironment();

  const submit = () => mutation.mutate({ name, description, critical }, { onSuccess: () => navigate(resourceUrl(scope, 'environments')) });

  return (
    <PageContent>
      <Link to={resourceUrl(scope, 'environments')} style={{ textDecoration: 'none', color: 'inherit' }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
          <ArrowLeft size={18} />
          <Typography variant="body2">Back to Environments</Typography>
        </Stack>
      </Link>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 4 }}>
        Create Environment
      </Typography>

      <Stack gap={3} sx={{ maxWidth: 600, mb: 4 }}>
        <TextField label="Name" placeholder="My-New-Environment" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
        <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
        <FormControlLabel control={<Checkbox checked={critical} onChange={(_, v) => setCritical(v)} />} label="Mark as Critical Environment" />
      </Stack>

      <Stack direction="row" gap={2}>
        <Button variant="outlined" onClick={() => navigate(resourceUrl(scope, 'environments'))}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!name.trim() || mutation.isPending}>
          Create
        </Button>
      </Stack>
    </PageContent>
  );
}
