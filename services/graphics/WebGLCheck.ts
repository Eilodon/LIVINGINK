// EIDOLON-V: WebGL Support Detection

let _webglSupported: boolean | null = null;

export const isWebGLSupported = (): boolean => {
  if (_webglSupported !== null) return _webglSupported;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    _webglSupported = gl !== null;
  } catch (e) {
    _webglSupported = false;
  }

  return _webglSupported;
};

export const getWebGLVersion = (): number => {
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext('webgl2')) return 2;
    if (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) return 1;
  } catch (e) {
    // Ignore
  }
  return 0;
};
