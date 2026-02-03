import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { WS_EVENTS } from '@verdantia/shared';
import type { ClientCommandPayload } from '@verdantia/shared';

@WebSocketGateway({
  cors: {
    origin: process.env.SERVER_CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Validate invite code if configured
    const requiredCode = process.env.INVITE_CODE;
    if (requiredCode) {
      const providedCode = client.handshake.auth?.inviteCode;
      if (providedCode !== requiredCode) {
        this.logger.warn(`Client ${client.id} rejected: invalid invite code`);
        client.emit(WS_EVENTS.SERVER_ERROR, {
          code: 'INVALID_INVITE_CODE',
          message: 'Invalid or missing invite code.',
        });
        client.disconnect(true);
        return;
      }
    }

    this.gameService.createSession(client.id);

    client.emit(WS_EVENTS.SERVER_CONNECTED, {
      sessionId: client.id,
      hasSavedGame: false, // Will be implemented in Phase 5
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.gameService.removeSession(client.id);
  }

  @SubscribeMessage(WS_EVENTS.CLIENT_COMMAND)
  async handleCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ClientCommandPayload,
  ) {
    try {
      const state = await this.gameService.processCommand(client.id, payload.command);
      if (state) {
        client.emit(WS_EVENTS.SERVER_STATE_UPDATE, { state });
      } else {
        client.emit(WS_EVENTS.SERVER_ERROR, {
          code: 'NO_SESSION',
          message: 'No active game session. Please start a new game.',
        });
      }
    } catch (error) {
      this.logger.error(`Error processing command: ${error}`);
      client.emit(WS_EVENTS.SERVER_ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred processing your command.',
      });
    }
  }

  @SubscribeMessage(WS_EVENTS.CLIENT_REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    try {
      const state = this.gameService.getState(client.id);
      if (state) {
        client.emit(WS_EVENTS.SERVER_STATE_UPDATE, { state });
      }
    } catch (error) {
      this.logger.error(`Error getting state: ${error}`);
    }
  }
}
