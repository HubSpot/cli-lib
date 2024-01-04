const findup = require('findup-sync');
const { getEnv } = require('@hubspot/local-dev-lib/config');

const { getHubSpotWebsiteOrigin } = require('./urls');
const { ENVIRONMENTS } = require('./constants');

/**
 * @deprecated
 * Use the corresponding export from local-dev-lib (renamed to @hubspot/local-dev-lib/cms/themes)
 * https://github.com/HubSpot/hubspot-local-dev-lib
 */
const getThemeJSONPath = path =>
  findup('theme.json', {
    cwd: path,
    nocase: true,
  });

const getThemeNameFromPath = filePath => {
  const themeJSONPath = getThemeJSONPath(filePath);
  if (!themeJSONPath) return;
  const pathParts = themeJSONPath.split('/');
  if (pathParts.length < 2) return;
  return pathParts[pathParts.length - 2];
};

/**
 * @deprecated
 * Use the corresponding export from local-dev-lib (renamed to @hubspot/local-dev-lib/cms/themes)
 * https://github.com/HubSpot/hubspot-local-dev-lib
 */
const getThemePreviewUrl = (filePath, accountId) => {
  const themeName = getThemeNameFromPath(filePath);
  if (!themeName) return;

  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/theme-previewer/${accountId}/edit/${encodeURIComponent(
    themeName
  )}`;
};

module.exports = { getThemeJSONPath, getThemeNameFromPath, getThemePreviewUrl };
