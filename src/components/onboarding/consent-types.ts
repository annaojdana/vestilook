export type ConsentErrorCode = "unauthorized" | "bad_request" | "conflict" | "server_error" | "network" | "validation";

export interface ConsentErrorState {
  code: ConsentErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConsentViewModel {
  requiredVersion: string;
  acceptedVersion?: string | null;
  acceptedAt?: string | null;
  isCompliant: boolean;
  policyContent: string;
  policyUrl: string;
  metadata: {
    updatedAt?: string;
    source: "gcp" | "internal";
  };
}

export interface ConsentSubmissionResult {
  acceptedVersion: string;
  acceptedAt: string;
  status: "created" | "updated";
}

export interface ConsentFormState {
  isCheckboxChecked: boolean;
  showValidationError: boolean;
}

export class ConsentApiError extends Error {
  constructor(
    message: string,
    public readonly options: {
      code: ConsentErrorCode;
      status?: number;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "ConsentApiError";
  }

  get code(): ConsentErrorCode {
    return this.options.code;
  }

  get status(): number | undefined {
    return this.options.status;
  }

  get details(): Record<string, unknown> | undefined {
    return this.options.details;
  }
}
