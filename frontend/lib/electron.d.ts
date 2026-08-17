export {};

declare global {
  type UpdateState = {
    currentVersion: string;
    available: boolean;
    checking: boolean;
    downloading: boolean;
    downloaded: boolean;
    version: string;
    releaseNotes: string;
    progress: number;
    error: string;
  };

  interface Window {
    fig?: {
      isElectron?: boolean;
      platform?: string;
      runtime?: {
        get: () => Promise<{ mode: "local" | "hosted"; hostedUrl: string }>;
        set: (cfg: { mode: "local" | "hosted"; hostedUrl: string }) => Promise<unknown>;
      };
      theme?: {
        get: () => Promise<string>;
        set: (theme: string) => Promise<string>;
      };
      report?: {
        get: () => Promise<{ enabled: boolean; backendUrl: string; hasSecret: boolean }>;
        set: (cfg: { enabled: boolean }) => Promise<{
          enabled: boolean;
          backendUrl: string;
          hasSecret: boolean;
        }>;
      };
      logs?: {
        get: () => Promise<string[]>;
        open: () => Promise<boolean>;
      };
      dialog?: {
        pickDirectory: () => Promise<string | null>;
      };
      update?: {
        status: () => Promise<UpdateState>;
        check: () => Promise<UpdateState>;
        download: () => Promise<UpdateState>;
        install: () => Promise<UpdateState>;
        openChangelog: () => Promise<boolean>;
        onStatus: (cb: (state: UpdateState) => void) => () => void;
      };
      error?: {
        get: () => Promise<string>;
        copy: (text: string) => Promise<boolean>;
      };
      about?: {
        open: () => Promise<unknown>;
        close: () => Promise<boolean>;
        info: () => Promise<{ version: string; runtime: string; channel: string }>;
      };
    };
  }
}