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

const applyEnvironmentMode = (env = process.env) => {
  const appMode = readAppMode();
  env.APP_PRODUCTION = String(appMode.production);
  env.NODE_ENV = appMode.production ? 'production' : 'development';
  env.MONGO_MODE = appMode.production ? 'cloud' : 'local';
  return appMode;
};

module.exports = {
  APP_MODE_FILE_PATH,
  readAppMode,
  applyEnvironmentMode,
};