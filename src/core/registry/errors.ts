export class CapabilityNotFoundError extends Error {
  readonly capabilityId: string;

  constructor(capabilityId: string, message?: string) {
    super(message ?? `capability not found: ${capabilityId}`);
    this.name = "CapabilityNotFoundError";
    this.capabilityId = capabilityId;
  }
}

export class CapabilityAlreadyRegisteredError extends Error {
  readonly capabilityId: string;

  constructor(capabilityId: string, message?: string) {
    super(message ?? `capability already registered: ${capabilityId}`);
    this.name = "CapabilityAlreadyRegisteredError";
    this.capabilityId = capabilityId;
  }
}

export class InvalidCapabilityProviderError extends Error {
  readonly capabilityId: string;

  constructor(capabilityId: string, message?: string) {
    super(message ?? `invalid capability provider: ${capabilityId}`);
    this.name = "InvalidCapabilityProviderError";
    this.capabilityId = capabilityId;
  }
}
