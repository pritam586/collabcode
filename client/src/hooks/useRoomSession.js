import { useCallback, useEffect, useRef, useState } from 'react';
import { SocketYjsProvider } from '../collab/SocketYjsProvider.js';
import { useToast } from '../components/ui/useToast.js';
import { createId } from '../lib/storage.js';
import { socket } from '../socket.js';

const TOO_LARGE_MESSAGE = 'That change is too large to share (the limit is 100,000 characters), so your editor was reset to the shared version.';
const OFFLINE_TOAST_ID = 'connection';

// Connects to the server, joins `roomId` as `name`, and keeps everything about the live room:
// connection status, participants, language, chat, and the Yjs provider for code and tasks.
//
// status: 'connecting' -> 'joined' <-> 'reconnecting'; or 'failed' when the room refuses the
// join (for example, it is full). The socket reconnects on its own; every reconnect rejoins.
export function useRoomSession(roomId, name) {
  const toast = useToast();
  const [status, setStatus] = useState('connecting');
  const [failure, setFailure] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [provider, setProvider] = useState(null);
  const providerRef = useRef(null);
  const joinedRef = useRef(false);

  const replaceProvider = useCallback((nextRoomId) => {
    providerRef.current?.destroy();
    const next = nextRoomId ? new SocketYjsProvider(socket, nextRoomId) : null;
    providerRef.current = next;
    setProvider(next);
    return next;
  }, []);

  // Throws the local copy away and loads the shared document again.
  const resetProvider = useCallback(() => {
    if (providerRef.current) replaceProvider(roomId).start();
  }, [replaceProvider, roomId]);

  useEffect(() => {
    let hasConnected = false;
    const join = () => socket.emit('join-room', { roomId, name });

    function handleConnect() {
      if (hasConnected) toast.success('Reconnected. Your changes are syncing.', { id: OFFLINE_TOAST_ID });
      hasConnected = true;
      join();
    }

    function handleDisconnect(reason) {
      joinedRef.current = false;
      setStatus((current) => (current === 'failed' ? current : 'reconnecting'));
      setPendingMessages((current) => current.map((message) => ({ ...message, status: 'failed' })));
      // A deliberate disconnect (leaving the room) needs no warning.
      if (reason !== 'io client disconnect') {
        toast.warning('Connection lost. Keep typing; your changes will sync when you are back online.', { id: OFFLINE_TOAST_ID });
      }
    }

    function handleConnectError() {
      if (!hasConnected) toast.error('Cannot reach the CollabCode server. Retrying…', { id: OFFLINE_TOAST_ID });
    }

    function handleRoomSync(snapshot) {
      if (snapshot.roomId !== roomId) return;
      let current = providerRef.current;
      if (current?.roomId !== roomId) current = replaceProvider(roomId);

      setLanguage(snapshot.language);
      setParticipants(snapshot.participants);
      setMessages(snapshot.messages ?? []);
      setFailure('');
      setStatus('joined');
      joinedRef.current = true;
      current.start();
    }

    function handleRoomError({ message }) {
      if (joinedRef.current) {
        toast.error(message);
        return;
      }
      setFailure(message);
      setStatus('failed');
    }

    const handleParticipantJoined = (participant) => setParticipants((current) => [...current.filter((item) => item.socketId !== participant.socketId), participant]);
    const handleParticipantLeft = ({ socketId }) => setParticipants((current) => current.filter((item) => item.socketId !== socketId));
    const handleLanguageChanged = ({ language: next }) => setLanguage(next);
    const handleServerError = ({ message }) => toast.error(message);

    function handleDocumentError({ message, reset }) {
      toast.error(message);
      if (reset) resetProvider();
    }

    function handleChatMessage(message) {
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message].slice(-200)));
      if (message.clientId) setPendingMessages((current) => current.filter((item) => item.clientId !== message.clientId));
    }

    function handleChatError({ message, clientId }) {
      toast.error(message);
      if (clientId) setPendingMessages((current) => current.map((item) => (item.clientId === clientId ? { ...item, status: 'failed' } : item)));
    }

    const listeners = {
      connect: handleConnect,
      disconnect: handleDisconnect,
      connect_error: handleConnectError,
      'room-sync': handleRoomSync,
      'room-error': handleRoomError,
      'participant-joined': handleParticipantJoined,
      'participant-left': handleParticipantLeft,
      'language-changed': handleLanguageChanged,
      'server-error': handleServerError,
      'document-error': handleDocumentError,
      'chat-message': handleChatMessage,
      'chat-error': handleChatError,
    };
    for (const [event, listener] of Object.entries(listeners)) socket.on(event, listener);
    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      for (const [event, listener] of Object.entries(listeners)) socket.off(event, listener);
      socket.emit('leave-room');
      socket.disconnect();
      joinedRef.current = false;
      replaceProvider(null);
      toast.dismiss(OFFLINE_TOAST_ID);
    };
  }, [roomId, name, toast, replaceProvider, resetProvider]);

  useEffect(() => {
    if (!provider) return undefined;
    return provider.on('too-large', () => {
      toast.error(TOO_LARGE_MESSAGE);
      resetProvider();
    });
  }, [provider, toast, resetProvider]);

  const changeLanguage = useCallback((next) => {
    setLanguage(next);
    socket.emit('language-change', { roomId, language: next });
  }, [roomId]);

  const sendMessage = useCallback((body, existingClientId) => {
    const clientId = existingClientId ?? createId();
    const online = joinedRef.current && socket.connected;
    const pending = { clientId, body, createdAt: Date.now(), status: online ? 'sending' : 'failed' };
    setPendingMessages((current) => [...current.filter((item) => item.clientId !== clientId), pending]);
    if (online) socket.emit('chat-send', { roomId, body, clientId });
    else toast.warning('You are offline. Your message will be kept here so you can resend it.');
  }, [roomId, toast]);

  const discardMessage = useCallback((clientId) => {
    setPendingMessages((current) => current.filter((item) => item.clientId !== clientId));
  }, []);

  return {
    status,
    failure,
    language,
    participants,
    messages,
    pendingMessages,
    provider,
    selfSocketId: socket.id,
    changeLanguage,
    sendMessage,
    discardMessage,
  };
}
