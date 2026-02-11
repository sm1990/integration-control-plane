import { Button, Checkbox, FormControlLabel, PageContent, Stack, TextField, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useCreateEnvironment } from '../api/mutations';
import { environmentsUrl } from '../paths';

export default function CreateEnvironment(): JSX.Element {
  const navigate = useNavigate();
  const { orgHandler = 'default' } = useParams();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [critical, setCritical] = useState(false);
  const mutation = useCreateEnvironment();

  const submit = () =>
    mutation.mutate({ name, description, critical }, { onSuccess: () => navigate(environmentsUrl(orgHandler)) });

  return (
    <PageContent>
      <Link to={environmentsUrl(orgHandler)} style={{ textDecoration: 'none', color: 'inherit' }}>
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
        <FormControlLabel control={<Checkbox checked={critical} onChange={(_, v) => setCritical(v)} />} label="Mark environment as a Production environment" />
      </Stack>

      <Stack direction="row" gap={2}>
        <Button variant="outlined" onClick={() => navigate(environmentsUrl(orgHandler))}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!name.trim() || mutation.isPending}>
          Create
        </Button>
      </Stack>
    </PageContent>
  );
}
