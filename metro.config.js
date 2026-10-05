const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Shared assessment package (TS source) — single psychometric core for client.
const assessmentRoot = path.resolve(projectRoot, 'shared/assessment');
config.watchFolders = [...(config.watchFolders ?? []), assessmentRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(assessmentRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@tearz/assessment': assessmentRoot,
};
config.resolver.unstable_enablePackageExports = true;

// Assessment sources use ESM `.js` import specifiers that map to `.ts` files.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve =
    upstreamResolveRequest ??
    ((ctx, name, plat) => ctx.resolveRequest(ctx, name, plat));

  if (
    typeof moduleName === 'string' &&
    moduleName.endsWith('.js')
  ) {
    const origin = context.originModulePath || '';
    if (origin.includes(`${path.sep}shared${path.sep}assessment${path.sep}`)) {
      try {
        return resolve(context, moduleName.replace(/\.js$/, '.ts'), platform);
      } catch {
        /* fall through */
      }
    }
  }

  return resolve(context, moduleName, platform);
};

// Позволяет импортировать .riv (Rive) как ассет через require().
if (!config.resolver.assetExts.includes('riv')) {
  config.resolver.assetExts.push('riv');
}

module.exports = config;
