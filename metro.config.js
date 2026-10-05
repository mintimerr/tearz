const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Shared assessment package (TS source) — single psychometric core for client.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(projectRoot, 'shared/assessment'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(projectRoot, 'shared/assessment/node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@tearz/assessment': path.resolve(projectRoot, 'shared/assessment'),
};

// Позволяет импортировать .riv (Rive) как ассет через require().
if (!config.resolver.assetExts.includes('riv')) {
  config.resolver.assetExts.push('riv');
}

module.exports = config;
