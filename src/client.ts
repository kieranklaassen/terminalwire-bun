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
  const debug = process.env.TERMINALWIRE_DEBUG === "1";

  return new Promise((resolve, reject) => {
    if (debug) console.error(`[DEBUG] Connecting to ${url}`);

    // Terminalwire requires the 'ws' subprotocol
    const socket = new WebSocket(url, ["ws"]);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      if (debug) console.error("[DEBUG] WebSocket connected");
      // Return send function on successful connection
      resolve((data: Message) => {
        if (debug) console.error(`[DEBUG] Sending: ${JSON.stringify(data).slice(0, 200)}`);
        socket.send(encode(data));
      });
    };

    socket.onerror = (err) => {
      if (debug) console.error(`[DEBUG] WebSocket error: ${err}`);
      reject(new Error("Connection failed"));
    };

    socket.onmessage = async (event) => {
      const buffer = event.data as ArrayBuffer;
      if (debug) console.error(`[DEBUG] Received ${buffer.byteLength} bytes`);

      // Security: Reject oversized messages
      if (buffer.byteLength > MAX_MESSAGE_SIZE) {
        console.error("Message too large, ignoring");
        return;
      }

      try {
        const msg = decode(new Uint8Array(buffer)) as Message;
        if (debug) console.error(`[DEBUG] Decoded: ${JSON.stringify(msg).slice(0, 200)}`);
        await onMessage(msg);
      } catch (e) {
        if (debug) console.error(`[DEBUG] Error handling message: ${e}`);
      }
    };

    socket.onclose = (event) => {
      if (debug) console.error(`[DEBUG] WebSocket closed: code=${event.code}`);
      onClose(event.code);
    };
  });
}
