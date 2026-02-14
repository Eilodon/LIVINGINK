
export const CONFIG = {
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost:2567',
    WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:2567',
    IS_DEV: import.meta.env.DEV,
};
