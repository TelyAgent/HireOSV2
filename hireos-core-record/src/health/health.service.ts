import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'hireos-core-record',
      phase: 'phase-0',
      timestamp: new Date().toISOString(),
    };
  }
}
