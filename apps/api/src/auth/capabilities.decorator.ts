import { SetMetadata } from '@nestjs/common';
import type { AppCapability } from '@ltl-shop/shared';

export const CAPABILITIES_KEY = 'capabilities';
export const Capabilities = (...capabilities: AppCapability[]) =>
  SetMetadata(CAPABILITIES_KEY, capabilities);
