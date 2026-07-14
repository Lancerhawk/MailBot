"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    success;
    message;
    data;
    constructor(data, message = 'Success') {
        this.success = true;
        this.message = message;
        this.data = data;
    }
}
exports.ApiResponse = ApiResponse;
