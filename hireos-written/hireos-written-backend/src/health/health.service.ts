import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'hireos-written',
      phase: 'phase-0',
      timestamp: new Date().toISOString(),
    };
  }
}
