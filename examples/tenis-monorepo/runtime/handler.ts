import { createRouter } from './router.js';

export function createHandler() {
  const router = createRouter();

  return {
    async handle(request: Parameters<typeof router.handle>[0]) {
      return router.handle(request);
    },
  };
}
