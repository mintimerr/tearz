import { WebSocket } from 'ws';

const REALTIME_MODEL = process.env.COMPANION_REALTIME_MODEL?.trim() || 'gpt-realtime-mini';
const REALTIME_VOICE = process.env.COMPANION_REALTIME_VOICE?.trim() || 'marin';

function buildRealtimeInstructions({ buildSystemPrompt, language, companionPersona, companionDisplayName }) {
  let instructions = buildSystemPrompt(language);
  if (typeof companionPersona === 'string' && companionPersona.trim()) {
    instructions +=
      '\n\nCHARACTER SHEET (stay in this persona on the call):\n' +
      companionPersona.trim().slice(0, 6000) +
      '\n\nEvery reply must read as this exact person on a phone call — same voice, education level, and attitude as above. Not a tutor.';
  }
  if (typeof companionDisplayName === 'string' && companionDisplayName.trim()) {
    instructions +=
      '\n\nYour display name in the app is "' +
      companionDisplayName.trim().slice(0, 80).replace(/"/g, "'") +
      '".';
  }
  instructions +=
    '\n\nVOICE CALL MODE:\n' +
    '- You are on a live voice call with the learner.\n' +
    '- Speak naturally and briefly — usually 1–3 short sentences.\n' +
    '- No markdown, no lists, no meta talk about being AI.\n' +
    '- Stay in the practice language for the session.\n' +
    '- React like a real person on the phone: warmth, pauses, follow-up questions when natural.';
  return instructions;
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function forwardUpstreamEvent(event, clientWs) {
  switch (event.type) {
    case 'input_audio_buffer.speech_started':
      sendJson(clientWs, { type: 'status', phase: 'listening' });
      break;
    case 'input_audio_buffer.speech_stopped':
      sendJson(clientWs, { type: 'status', phase: 'thinking' });
      break;
    case 'response.created':
      sendJson(clientWs, { type: 'status', phase: 'speaking' });
      break;
    case 'response.output_audio.delta':
    case 'response.audio.delta':
      if (typeof event.delta === 'string' && event.delta) {
        sendJson(clientWs, { type: 'assistant.audio', chunk: event.delta });
      }
      break;
    case 'response.output_audio.done':
    case 'response.audio.done':
      sendJson(clientWs, { type: 'assistant.audio.done' });
      break;
    case 'response.done':
      sendJson(clientWs, { type: 'status', phase: 'ready' });
      break;
    case 'response.cancelled':
      sendJson(clientWs, { type: 'assistant.interrupted' });
      sendJson(clientWs, { type: 'status', phase: 'listening' });
      break;
    case 'error':
      sendJson(clientWs, {
        type: 'error',
        message:
          typeof event.error?.message === 'string' ? event.error.message : 'Realtime API error',
      });
      break;
    default:
      break;
  }
}

export function attachCompanionRealtimeBridge(wss, { buildSystemPrompt, getApiKey }) {
  wss.on('connection', (clientWs) => {
    let upstream = null;
    let started = false;
    let greetingSent = false;
    let sessionReady = false;

    const closeAll = () => {
      try {
        upstream?.close();
      } catch {
        /* ignore */
      }
      upstream = null;
    };

    clientWs.on('close', closeAll);
    clientWs.on('error', closeAll);

    clientWs.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        sendJson(clientWs, { type: 'error', message: 'Invalid message' });
        return;
      }

      if (msg.type === 'call.end') {
        closeAll();
        clientWs.close();
        return;
      }

      if (msg.type === 'call.start') {
        if (started) return;
        started = true;

        const apiKey = getApiKey();
        if (!apiKey) {
          sendJson(clientWs, { type: 'error', message: 'Server misconfiguration: OPENAI_API_KEY' });
          clientWs.close();
          return;
        }

        const language =
          msg.language === 'chinese' ||
          msg.language === 'russian' ||
          msg.language === 'english' ||
          msg.language === 'german' ||
          msg.language === 'french'
            ? msg.language
            : 'english';

        const instructions = buildRealtimeInstructions({
          buildSystemPrompt,
          language,
          companionPersona: msg.companionPersona,
          companionDisplayName: msg.companionDisplayName,
        });

        sendJson(clientWs, { type: 'status', phase: 'connecting' });

        upstream = new WebSocket(`wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        upstream.on('open', () => {
          sendJson(clientWs, { type: 'status', phase: 'connecting' });
          upstream.send(
            JSON.stringify({
              type: 'session.update',
              session: {
                type: 'realtime',
                instructions,
                output_modalities: ['audio'],
                audio: {
                  input: {
                    format: { type: 'audio/pcm', rate: 24000 },
                    turn_detection: {
                      type: 'server_vad',
                      threshold: 0.4,
                      prefix_padding_ms: 300,
                      silence_duration_ms: 600,
                      interrupt_response: true,
                      create_response: true,
                    },
                  },
                  output: {
                    format: { type: 'audio/pcm', rate: 24000 },
                    voice: REALTIME_VOICE,
                  },
                },
              },
            }),
          );
        });

        upstream.on('message', (data) => {
          let event;
          try {
            event = JSON.parse(String(data));
          } catch {
            return;
          }

          if (event.type === 'error') {
            forwardUpstreamEvent(event, clientWs);
            return;
          }

          if (event.type === 'session.updated') {
            sessionReady = true;
            sendJson(clientWs, { type: 'status', phase: 'ready' });
            if (!greetingSent) {
              greetingSent = true;
              upstream.send(
                JSON.stringify({
                  type: 'response.create',
                  response: {
                    output_modalities: ['audio'],
                    instructions:
                      'Start the call with a brief, natural greeting in the practice language — one or two short sentences, like picking up a phone.',
                  },
                }),
              );
            }
          }

          forwardUpstreamEvent(event, clientWs);
        });

        upstream.on('error', () => {
          sendJson(clientWs, { type: 'error', message: 'Realtime connection error' });
        });

        upstream.on('close', () => {
          sendJson(clientWs, { type: 'status', phase: 'ended' });
        });

        return;
      }

      if (msg.type === 'user.audio') {
        const audio = typeof msg.audio === 'string' ? msg.audio : '';
        if (!audio || !sessionReady || !upstream || upstream.readyState !== WebSocket.OPEN) return;

        upstream.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio,
          }),
        );
      }
    });
  });
}
