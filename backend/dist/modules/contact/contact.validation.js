"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeContactSchema = void 0;
const zod_1 = require("zod");
exports.mergeContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        secondaryId: zod_1.z.string({
            required_error: 'secondaryId is required',
            invalid_type_error: 'secondaryId must be a string',
        }),
    }),
});
