import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
