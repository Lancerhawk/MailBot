import { Router } from 'express';
import healthRoute from './health.route';

const router = Router();

const defaultRoutes = [
  {
    path: '/health',
    route: healthRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
