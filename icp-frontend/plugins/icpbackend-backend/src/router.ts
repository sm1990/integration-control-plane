import { HttpAuthService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { z } from 'zod';
import express from 'express';
import Router from 'express-promise-router';
import { ICPApiService } from './services/ICPApiService/types';

export async function createRouter({
  httpAuth,
  icpApiService,
}: {
  httpAuth: HttpAuthService;
  icpApiService: ICPApiService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // Validation schemas
  const environmentSchema = z.object({
    name: z.string(),
    description: z.string(),
  });

  const updateEnvironmentSchema = z.object({
    environmentId: z.string(),
    name: z.string(),
    description: z.string(),
  });

  const projectSchema = z.object({
    name: z.string(),
    description: z.string(),
  });

  const updateProjectSchema = z.object({
    projectId: z.string(),
    name: z.string(),
    description: z.string(),
  });

  const componentSchema = z.object({
    name: z.string(),
    description: z.string(),
    projectId: z.string(),
  });

  const updateComponentSchema = z.object({
    componentId: z.string(),
    name: z.string(),
    description: z.string(),
  });

  // Environment endpoints
  router.get('/environments', async (_req, res) => {
    res.json(await icpApiService.getEnvironments());
  });

  router.post('/environments', async (req, res) => {
    const parsed = environmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await icpApiService.createEnvironment(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(201).json(result);
  });

  router.put('/environments/:id', async (req, res) => {
    const requestData = { ...req.body, environmentId: req.params.id };
    const parsed = updateEnvironmentSchema.safeParse(requestData);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await icpApiService.updateEnvironment(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.json(result);
  });

  router.delete('/environments/:id', async (req, res) => {
    await icpApiService.deleteEnvironment(req.params.id, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(204).send();
  });

  // Project endpoints
  router.get('/projects', async (_req, res) => {
    res.json(await icpApiService.getProjects());
  });

  router.post('/projects', async (req, res) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await icpApiService.createProject(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(201).json(result);
  });

  router.put('/projects/:id', async (req, res) => {
    const requestData = { ...req.body, projectId: req.params.id };
    const parsed = updateProjectSchema.safeParse(requestData);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await icpApiService.updateProject(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.json(result);
  });

  router.delete('/projects/:id', async (req, res) => {
    await icpApiService.deleteProject(req.params.id, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(204).send();
  });

  // Component endpoints
  router.get('/components', async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    res.json(await icpApiService.getComponents(projectId));
  });

  router.post('/components', async (req, res) => {
    const parsed = componentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await icpApiService.createComponent(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(201).json(result);
  });

  router.put('/components/:id', async (req, res) => {
    const requestData = { ...req.body, componentId: req.params.id };
    const parsed = updateComponentSchema.safeParse(requestData);
    if (!parsed.success) {
      throw new InputError(parsed.error.toString());
    }

    const result = await icpApiService.updateComponent(parsed.data, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.json(result);
  });

  router.delete('/components/:id', async (req, res) => {
    await icpApiService.deleteComponent(req.params.id, {
      credentials: await httpAuth.credentials(req, { allow: ['user'] }),
    });

    res.status(204).send();
  });

  // Runtime endpoints
  router.get('/runtimes', async (req, res) => {
    const filters = {
      status: req.query.status as string | undefined,
      runtimeType: req.query.runtimeType as string | undefined,
      environment: req.query.environment as string | undefined,
      projectId: req.query.projectId as string | undefined,
      componentId: req.query.componentId as string | undefined,
    };

    // Remove undefined values
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined)
    );

    res.json(await icpApiService.getRuntimes(Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined));
  });

  router.get('/runtimes/:id', async (req, res) => {
    res.json(await icpApiService.getRuntime(req.params.id));
  });

  return router;
}
