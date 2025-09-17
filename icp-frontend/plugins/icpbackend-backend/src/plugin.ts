import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { createICPApiService } from './services/ICPApiService';

/**
 * icpbackendPlugin backend plugin
 *
 * @public
 */
export const icpbackendPlugin = createBackendPlugin({
  pluginId: 'icpbackend',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
      },
      async init({ logger, httpAuth, httpRouter, config }) {
        const icpApiService = await createICPApiService({
          logger,
          config,
        });

        httpRouter.use(
          await createRouter({
            httpAuth,
            icpApiService,
          }),
        );
      },
    });
  },
});
