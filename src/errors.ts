export class NetworkError extends Error {
  readonly code = 'NETWORK_ERROR';
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  readonly code = 'TIMEOUT_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UserCancelledError extends Error {
  readonly code = 'USER_CANCELLED';
  constructor(message = 'User cancelled') {
    super(message);
    this.name = 'UserCancelledError';
  }
}
