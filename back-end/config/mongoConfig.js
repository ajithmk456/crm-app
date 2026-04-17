const DEFAULT_LOCAL_URI = 'mongodb://127.0.0.1:27017/mukundha-associates-crm';

const normalizeMode = (mode, nodeEnv) => {
  if (mode) {
    return mode.toLowerCase();
  }

  return nodeEnv === 'production' ? 'cloud' : 'auto';
};

const getMongoCandidates = (env = process.env) => {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const mode = normalizeMode(env.MONGO_MODE, nodeEnv);
  const localUri = env.MONGO_URI_LOCAL || DEFAULT_LOCAL_URI;
  const cloudUri = env.MONGO_URI_CLOUD || env.MONGO_URI;

  const options = {
    serverSelectionTimeoutMS: Number(env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
  };

  const byMode = {
    local: [{ label: 'local', uri: localUri }],
    cloud: cloudUri ? [{ label: 'cloud', uri: cloudUri }] : [],
    auto: [
      { label: 'local', uri: localUri },
      ...(cloudUri ? [{ label: 'cloud', uri: cloudUri }] : []),
    ],
  };

  const candidates = (byMode[mode] || byMode.auto).filter((candidate) => Boolean(candidate.uri));

  return {
    mode,
    options,
    candidates,
  };
};

module.exports = {
  DEFAULT_LOCAL_URI,
  getMongoCandidates,
};