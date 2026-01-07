/**
 * WebSocket client for Terminalwire protocol
 *
 * Handles WebSocket connection and MessagePack encoding/decoding.
 * Uses a simple callback-based approach for message handling.
 */

import { encode, decode } from "@msgpack/msgpack";

// Security: Limit message size to 1MB
const MAX_MESSAGE_SIZE = 1024 * 1024;

export interface Message {
  event: string;
  [key: string]: unknown;
}

type MessageHandler = (msg: Message) => void;
type CloseHandler = (code: number) => void;
type SendFunction = (data: Message) => void;

/**
 * Connect to a Terminalwire server.
 *
 * @param url - WebSocket URL to connect to
 * @param onMessage - Callback for incoming messages
 * @param onClose - Callback when connection closes
 * @returns Promise resolving to a send function
 */
export async function connect(
  url: string,
  onMessage: MessageHandler,
  onClose: CloseHandler
): Promise<SendFunction> {
  return new Promise((resolve, reject) => {
    // Terminalwire requires the 'ws' subprotocol
    const socket = new WebSocket(url, ["ws"]);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      // Return send function on successful connection
      resolve((data: Message) => {
        socket.send(encode(data));
      });
    };

    socket.onerror = () => {
      reject(new Error("Connection failed"));
    };

    socket.onmessage = (event) => {
      const buffer = event.data as ArrayBuffer;

      // Security: Reject oversized messages
      if (buffer.byteLength > MAX_MESSAGE_SIZE) {
        console.error("Message too large, ignoring");
        return;
      }

      const msg = decode(new Uint8Array(buffer)) as Message;
      onMessage(msg);
    };

    socket.onclose = (event) => {
      onClose(event.code);
    };
  });
}
