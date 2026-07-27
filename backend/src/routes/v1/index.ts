import { Router } from 'express';
import healthRoute from './health.route';

const router = Router();

import authRoute from './auth.route';
import gmailRoute from '../../modules/gmail/gmail.route';

import draftRoute from '../../modules/draft/draft.route';
import knowledgeRoute from '../../modules/knowledge/knowledge.route';
import contactRoute from '../../modules/contact/contact.route';
import { analyticsRouter } from '../../modules/analytics/analytics.route';
import internalRoute from './internal.route';

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
    path: '/analytics',
    route: analyticsRouter,
  },
  {
    path: '/drafts',
    route: draftRoute,
  },
  {
    path: '/knowledge',
    route: knowledgeRoute,
  },
  {
    path: '/contacts',
    route: contactRoute,
  },
  {
    path: '/internal',
    route: internalRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
