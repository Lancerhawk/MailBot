export class ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;

  constructor(data: T | null, message = 'Success') {
    this.success = true;
    this.message = message;
    this.data = data;
  }
}
