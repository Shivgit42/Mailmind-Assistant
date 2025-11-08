export class ApiError extends Error {
  public statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export const handleApiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
};

export const createErrorMessage = (error: unknown): string => {
  const errorMessage = handleApiError(error);
  return `${errorMessage}. Please try again.`;
};
