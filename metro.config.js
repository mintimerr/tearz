const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Позволяет импортировать .riv (Rive) как ассет через require().
if (!config.resolver.assetExts.includes('riv')) {
  config.resolver.assetExts.push('riv');
}

module.exports = config;
