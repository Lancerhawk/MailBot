import { Router } from 'express';
import healthRoute from './health.route';

const router = Router();

import authRoute from './auth.route';
import gmailRoute from '../../modules/gmail/gmail.route';

import draftRoute from '../../modules/draft/draft.route';
import knowledgeRoute from '../../modules/knowledge/knowledge.route';

const defaultRoutes = [
  {
    path: '/health',
    route: healthRoute,
  },
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/gmail',
    route: gmailRoute,
  },
  {
    path: '/drafts',
    route: draftRoute,
  },
  {
    path: '/knowledge',
    route: knowledgeRoute,
  }
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
