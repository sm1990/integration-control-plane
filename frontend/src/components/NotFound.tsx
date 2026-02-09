import { Button, PageContent, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft } from '@wso2/oxygen-ui-icons-react';
import { Link } from 'react-router';

interface NotFoundProps {
  message: string;
  backTo: string;
  backLabel?: string;
}

export default function NotFound({ message, backTo, backLabel = 'Back' }: NotFoundProps) {
  return (
    <PageContent component="main" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 8 }}>
      <Typography variant="h6" gutterBottom>
        {message}
      </Typography>
      <Button variant="outlined" component={Link} to={backTo} startIcon={<ArrowLeft size={18} />}>
        {backLabel}
      </Button>
    </PageContent>
  );
}
