import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/ws',
  transports: ['websocket'],
  cors: {
    origin: (() => {
      const raw = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173';
      if (raw.includes(',')) {
        return raw.split(',').map((o) => o.trim().replace(/\/$/, ''));
      }
      return raw.trim().replace(/\/$/, '');
    })(),
    credentials: true
  }
})
@Injectable()
export class RealtimeGateway implements OnModuleInit {
  @WebSocketServer() server: Server;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    // no-op
  }

  handleConnection(client: Socket) {
    // Optionally join rooms by query param e.g., role
    const role = (client.handshake.query?.role as string) || '';
    if (role) client.join(`role:${role}`);
  }

  handleDisconnect(_client: Socket) {}

  emit(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }

  emitToRole(role: string, event: string, payload: unknown) {
    this.server.to(`role:${role}`).emit(event, payload);
  }

  @SubscribeMessage('ping')
  onPing(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    client.emit('pong', { ts: Date.now(), data });
  }
}
