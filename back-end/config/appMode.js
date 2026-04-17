const fs = require('fs');
const path = require('path');

const APP_MODE_FILE_PATH = path.resolve(__dirname, '../../front-end/src/assets/app-mode.json');

const readAppMode = () => {
  try {
    const raw = fs.readFileSync(APP_MODE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      production: Boolean(parsed.production),
    };
  } catch (error) {
    return { production: false };
  }
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
};

const applyEnvironmentMode = (env = process.env) => {
  const appMode = readAppMode();
  const explicitProduction = parseBoolean(env.APP_PRODUCTION);
  const explicitNodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const hasExplicitMongoMode = Boolean(String(env.MONGO_MODE || '').trim());

  const production = explicitProduction !== undefined
    ? explicitProduction
    : explicitNodeEnv
      ? explicitNodeEnv === 'production'
      : appMode.production;

  env.APP_PRODUCTION = String(production);

  if (!explicitNodeEnv) {
    env.NODE_ENV = production ? 'production' : 'development';
  }

  if (!hasExplicitMongoMode) {
    env.MONGO_MODE = production ? 'cloud' : 'local';
  }

  return {
    production,
  };
};

module.exports = {
  APP_MODE_FILE_PATH,
  readAppMode,
  applyEnvironmentMode,
};