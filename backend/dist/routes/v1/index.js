"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_route_1 = __importDefault(require("./health.route"));
const router = (0, express_1.Router)();
const auth_route_1 = __importDefault(require("./auth.route"));
const gmail_route_1 = __importDefault(require("../../modules/gmail/gmail.route"));
const draft_route_1 = __importDefault(require("../../modules/draft/draft.route"));
const knowledge_route_1 = __importDefault(require("../../modules/knowledge/knowledge.route"));
const defaultRoutes = [
    {
        path: '/health',
        route: health_route_1.default,
    },
    {
        path: '/auth',
        route: auth_route_1.default,
    },
    {
        path: '/gmail',
        route: gmail_route_1.default,
    },
    {
        path: '/drafts',
        route: draft_route_1.default,
    },
    {
        path: '/knowledge',
        route: knowledge_route_1.default,
    }
];
defaultRoutes.forEach((route) => {
    router.use(route.path, route.route);
});
exports.default = router;
