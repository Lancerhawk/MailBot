"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDraftSchema = void 0;
const zod_1 = require("zod");
exports.updateDraftSchema = zod_1.z.object({
    body: zod_1.z.object({
        editedText: zod_1.z.string({
            required_error: 'editedText is required and must be a string',
            invalid_type_error: 'editedText is required and must be a string',
        }),
    }),
});
