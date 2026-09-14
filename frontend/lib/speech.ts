/** Web Speech API helpers for pt-BR voice input. */

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export type ListenResult = {
  transcript: string;
  error?: string;
};

/** Starts listening until stop() is called or recognition ends. */
export function createVoiceSession(opts: {
  onInterim?: (text: string) => void;
  onFinalChunk?: (text: string) => void;
}): { start: () => void; stop: () => Promise<ListenResult>; abort: () => void } {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return {
      start: () => undefined,
      stop: async () => ({ transcript: "", error: "unsupported" }),
      abort: () => undefined,
    };
  }

  let recognition: SpeechRecognitionLike | null = null;
  let finalText = "";
  let interimText = "";
  let lastError: string | undefined;
  let resolveStop: ((result: ListenResult) => void) | null = null;
  let stopping = false;

  const finish = () => {
    if (!resolveStop) return;
    const resolve = resolveStop;
    resolveStop = null;
    const transcript = `${finalText} ${interimText}`.replace(/\s+/g, " ").trim();
    resolve({ transcript, error: lastError });
  };

  return {
    start() {
      finalText = "";
      interimText = "";
      lastError = undefined;
      stopping = false;
      recognition = new Ctor();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText = `${finalText} ${piece}`.trim();
            opts.onFinalChunk?.(piece);
          } else {
            interim += piece;
          }
        }
        interimText = interim;
        opts.onInterim?.(`${finalText} ${interim}`.replace(/\s+/g, " ").trim());
      };

      recognition.onerror = (event) => {
        // "aborted" / "no-speech" are common when stopping; keep soft
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          lastError = "not-allowed";
        } else if (event.error === "audio-capture") {
          lastError = "audio-capture";
        } else if (event.error !== "aborted" && event.error !== "no-speech") {
          lastError = event.error;
        }
      };

      recognition.onend = () => {
        if (stopping || resolveStop) finish();
      };

      recognition.start();
    },

    stop() {
      stopping = true;
      return new Promise<ListenResult>((resolve) => {
        resolveStop = resolve;
        try {
          recognition?.stop();
        } catch {
          finish();
        }
        // Fallback if onend never fires
        setTimeout(finish, 1500);
      });
    },

    abort() {
      stopping = true;
      try {
        recognition?.abort();
      } catch {
        /* ignore */
      }
      finish();
    },
  };
}
