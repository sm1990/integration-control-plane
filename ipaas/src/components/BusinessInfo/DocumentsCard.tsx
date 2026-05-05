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

import { Box, Button, Card, CardContent, Divider, Stack, Tooltip, Typography } from '@wso2/oxygen-ui';
import { ExternalLink, FileText } from '@wso2/oxygen-ui-icons-react';
import { useNavigate } from 'react-router';
import { useApiDocuments } from '../../api/marketplace';
import CenteredLoader from '../CenteredLoader';

interface Props {
  apimId: string | null;
  docsPath?: string;
}

export default function DocumentsCard({ apimId, docsPath }: Props) {
  const navigate = useNavigate();
  const { data: documents = [], isLoading } = useApiDocuments(apimId);

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="h6" component="h3">
          Documents
        </Typography>
      </Stack>
      <Divider />
      <CardContent sx={{ flexGrow: 1, pb: (theme) => `${theme.spacing(2)} !important` }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : documents.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, gap: 1 }}>
            <FileText size={32} style={{ opacity: 0.3 }} />
            <Typography variant="body2" color="text.secondary">
              No documents available
            </Typography>
          </Box>
        ) : (
          <Stack gap={1} sx={{ mt: 0.5 }}>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {documents.map((doc) => (
                <Tooltip key={doc.documentId} title={doc.name}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    sx={{
                      px: 1.5,
                      py: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      cursor: 'default',
                      minWidth: 0,
                      maxWidth: '48%',
                    }}>
                    <FileText size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <Typography variant="body2" noWrap>
                      {doc.name}
                    </Typography>
                  </Stack>
                </Tooltip>
              ))}
            </Stack>
            {docsPath && (
              <Box>
                <Button variant="text" size="small" startIcon={<ExternalLink size={14} />} onClick={() => navigate(docsPath)}>
                  View More
                </Button>
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
