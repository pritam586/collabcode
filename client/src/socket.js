import { io } from 'socket.io-client';
import { SERVER_URL } from './lib/serverUrl.js';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket'],
});
