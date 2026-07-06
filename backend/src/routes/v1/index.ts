import { Router } from 'express';
import healthRoute from './health.route';

const router = Router();

import authRoute from './auth.route';

const defaultRoutes = [
  {
    path: '/health',
    route: healthRoute,
  },
  {
    path: '/auth',
    route: authRoute,
  }
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
