"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const knowledge_controller_1 = require("./knowledge.controller");
const router = (0, express_1.Router)();
const controller = new knowledge_controller_1.KnowledgeController();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});
router.use(auth_middleware_1.requireAuth);
router.post('/upload', upload.single('file'), controller.upload);
router.get('/', controller.list);
router.get('/stats', controller.getStats);
router.get('/folders', controller.getFolders);
router.get('/search', controller.search);
router.get('/download/:id', controller.download);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.patch('/:id/archive', controller.archive);
router.patch('/:id/restore', controller.restore);
router.patch('/:id/retry', controller.retry);
router.post('/:id/replace', upload.single('file'), controller.replace);
router.delete('/:id', controller.remove);
exports.default = router;
