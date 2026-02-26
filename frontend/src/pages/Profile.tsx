import { useState } from 'react';
import type { JSX } from 'react';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, IconButton, InputAdornment, InputLabel, OutlinedInput, Stack, Typography } from '@wso2/oxygen-ui';
import { Eye, EyeOff } from '@wso2/oxygen-ui-icons-react';
import { useAuth } from '../auth/AuthContext';
import { useCurrentUser, useChangePassword } from '../api/authQueries';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Profile(): JSX.Element {
  const { userId, username, displayName, isOidcUser } = useAuth();
  const { data: user, isLoading } = useCurrentUser('default', userId);

  if (isLoading) {
    return <CircularProgress sx={{ display: 'block', mx: 'auto', my: 8 }} />;
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: 4, px: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>
        Profile
      </Typography>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={3} alignItems="center">
            <Avatar sx={{ width: 72, height: 72, fontSize: 28, bgcolor: 'primary.main' }}>{getInitials(displayName)}</Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                @{username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {userId}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Groups
          </Typography>
          {user?.groups.length ? (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {user.groups.map((g) => (
                <Chip key={g.groupId} label={g.groupName} variant="outlined" />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not a member of any groups.
            </Typography>
          )}
        </CardContent>
      </Card>

      {!isOidcUser && <ChangePasswordSection />}
    </Box>
  );
}

function ChangePasswordSection(): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [success, setSuccess] = useState(false);

  const mutation = useChangePassword();

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword.trim().length > 0 && newPassword.trim().length > 0 && newPassword === confirmPassword && !mutation.isPending;

  const handleSubmit = () => {
    setSuccess(false);
    mutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setSuccess(true);
          setExpanded(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
      },
    );
  };

  const handleCancel = () => {
    setExpanded(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    mutation.reset();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Password
          </Typography>
          {!expanded && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSuccess(false);
                setExpanded(true);
              }}>
              Change Password
            </Button>
          )}
        </Stack>

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Password changed successfully.
          </Alert>
        )}

        {expanded && (
          <Stack spacing={2} sx={{ maxWidth: 400, mt: 2 }}>
            {mutation.isError && <Alert severity="error">{mutation.error instanceof Error ? mutation.error.message : 'Failed to change password.'}</Alert>}

            <Box>
              <InputLabel>Current Password</InputLabel>
              <OutlinedInput
                fullWidth
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton aria-label={showCurrent ? 'Hide current password' : 'Show current password'} onClick={() => setShowCurrent((s) => !s)} onMouseDown={(e) => e.preventDefault()} edge="end" size="small">
                      {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                }
              />
            </Box>

            <Box>
              <InputLabel>New Password</InputLabel>
              <OutlinedInput
                fullWidth
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton aria-label={showNew ? 'Hide new password' : 'Show new password'} onClick={() => setShowNew((s) => !s)} onMouseDown={(e) => e.preventDefault()} edge="end" size="small">
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                }
              />
            </Box>

            <Box>
              <InputLabel>Confirm New Password</InputLabel>
              <OutlinedInput fullWidth type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={passwordMismatch} />
              {passwordMismatch && (
                <Typography variant="caption" color="error">
                  Passwords do not match.
                </Typography>
              )}
            </Box>

            <Divider />

            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={!canSubmit} onClick={handleSubmit}>
                {mutation.isPending ? <CircularProgress size={20} /> : 'Save'}
              </Button>
              <Button variant="outlined" onClick={handleCancel} disabled={mutation.isPending}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
