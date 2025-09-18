import React, { useState, useEffect } from 'react';
import { Typography, Grid, FormControl, InputLabel, Select, MenuItem, Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import {
  Header,
  Page,
  Content,
  HeaderLabel,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  environmentsApiRef,
  Environment,
} from '../../api/EnvironmentsApiService';
import {
  runtimesApiRef,
  Runtime,
} from '../../api/RuntimesApiService';
import { RuntimeFlowVisualization } from '../RuntimeFlowVisualization';

const useStyles = makeStyles((theme) => ({
  environmentSelector: {
    minWidth: 200,
    marginBottom: theme.spacing(2),
  },
  refreshButton: {
    marginLeft: theme.spacing(1),
    minWidth: 'auto',
  },
  selectorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  visualizationContainer: {
    height: 600,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    position: 'relative',
  },
}));

export const RuntimeOverviewComponent = () => {
  const classes = useStyles();
  const environmentsApi = useApi(environmentsApiRef);
  const runtimesApi = useApi(runtimesApiRef);

  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('');
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load environments on component mount
  useEffect(() => {
    const loadEnvironments = async () => {
      setLoading(true);
      try {
        const envs = await environmentsApi.getEnvironments();
        setEnvironments(envs);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadEnvironments();
  }, [environmentsApi]);

  // Load runtimes when environment changes
  useEffect(() => {
    if (!selectedEnvironment) {
      setRuntimes([]);
      return;
    }

    const loadRuntimes = async () => {
      setLoading(true);
      try {
        const runtimesData = await runtimesApi.getRuntimes(
          undefined, // status
          undefined, // runtimeType
          selectedEnvironment, // environmentId
          undefined, // projectId
          undefined  // componentId
        );
        setRuntimes(runtimesData);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadRuntimes();
  }, [selectedEnvironment, runtimesApi]);

  const handleEnvironmentChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedEnvironment(event.target.value as string);
  };

  const handleRefresh = async () => {
    if (!selectedEnvironment) return;

    setLoading(true);
    try {
      const runtimesData = await runtimesApi.getRuntimes(
        undefined, // status
        undefined, // runtimeType
        selectedEnvironment, // environmentId
        undefined, // projectId
        undefined  // componentId
      );
      setRuntimes(runtimesData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && environments.length === 0) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <Page themeId="tool">
      <Header title="Runtime Overview">
        <HeaderLabel label="Owner" value="Platform Team" />
        <HeaderLabel label="Lifecycle" value="Alpha" />
      </Header>
      <Content>
        <Grid container spacing={3} direction="column">
          <Grid item>
            <Box>
              <div className={classes.selectorContainer}>
                <FormControl className={classes.environmentSelector}>
                  <InputLabel id="environment-select-label">Environment </InputLabel>
                  <Select
                    labelId="environment-select-label"
                    value={selectedEnvironment}
                    onChange={handleEnvironmentChange}
                    displayEmpty
                  >
                    <MenuItem value=" ">
                      Select an environment
                    </MenuItem>
                    {environments.map((env) => (
                      <MenuItem key={env.environmentId} value={env.environmentId}>
                        {env.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedEnvironment && (
                  <Button
                    variant="outlined"
                    className={classes.refreshButton}
                    onClick={handleRefresh}
                    disabled={loading}
                    startIcon={<RefreshIcon />}
                  >
                    Refresh
                  </Button>
                )}
              </div>
              {selectedEnvironment && (
                <Box mt={1}>
                  <Typography variant="body2" color="textSecondary">
                    Selected: {environments.find(env => env.environmentId === selectedEnvironment)?.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Runtimes found: {runtimes.length}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
          <Grid item>

            <div className={classes.visualizationContainer}>
              {loading && selectedEnvironment ? (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Progress />
                </Box>
              ) : selectedEnvironment ? (
                <RuntimeFlowVisualization
                  runtimes={runtimes}
                />
              ) : (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Typography variant="body1" color="textSecondary">
                    Please select an environment to view runtime visualization
                  </Typography>
                </Box>
              )}
            </div>

          </Grid>
        </Grid>
      </Content>
    </Page >
  );
};
