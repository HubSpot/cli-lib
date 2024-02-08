const {
  hidePreviewInDest,
  trackPreviewEvent,
} = require('../previewUtils');
const {
  fetchPreviewTemplates,
  fetchPreviewModules
} = require('../../../api/designManager');
const { parse: pathParse } = require('path');
const { logger } = require('./../../../logger');
const { isCodedFile } = require('./../../../templates');

const buildIndexRouteHandler = (sessionInfo) => {
  return async (req, res) => {
    trackPreviewEvent('view-index-route');

    const responseHTML = await buildIndexHtml(sessionInfo);
    res.status(200).set({ 'Content-Type': 'text/html' }).end(responseHTML);
  }
}

const buildIndexHtml = async (sessionInfo) => {
  const { domains, dest, PORT } = sessionInfo;
  const fakeDest = hidePreviewInDest(dest);
  const modulesHtml = await getModulesForDisplayToUser(sessionInfo);
  const templatesHtml = await getTemplatesForDisplayToUser(sessionInfo);
  return `
    <!DOCTYPE html>
    <html style="height:100%">
      <head>
      </head>
      <body style="height:100%;display:flex;flex-direction:column;align-items:center;">
        <div>
          <h1>Domains</h1>
          ${ domains.length ?
            getSiteList(domains, PORT) :
            "<p>No domains found. You either don't have any domains set up in your portal or your personal access key is missing a scope 'cms.domains.read' required for this feature.</p>"
          }
        </div>
        <div style="width:100%;display:flex;flex-direction:row;justify-content:space-evenly">
          <div>
            <h1>Modules</h1>
            ${ modulesHtml ? modulesHtml : `<p>No modules found in ${fakeDest}</p>` }
          </div>
          <div>
            <h1>Templates</h1>
            ${ templatesHtml ? templatesHtml : `<p>No templates found in ${fakeDest}</p>` }
          </div>
        </div>
      </body>
    </html>
  `;
}

const getSiteList = (domains, PORT) => {
  return listify(
    domains,
    domainObj => `http://${domainObj.domain}.hslocal.net:${PORT}`,
    domainObj => domainObj.domain
  );
}

const listify = (objects, hrefBuilder, labelBuilder) => {
  return '<ul>'
    + objects.reduce((x,y) => x += `<li><a href="${hrefBuilder(y)}">${labelBuilder(y)}</a></li>`, '')
    + '</ul>';
}

const getModulesForDisplayToUser = async (sessionInfo) => {
  const { accountId, sessionToken } = sessionInfo;
  try {
    const res = await fetchPreviewModules(accountId, sessionToken);
    const modulePaths = res
      .objects
      .map(moduleObj => moduleObj.path);
    const filesGroupedByFolder = groupByFolder(modulePaths)
    const htmlToRender = renderFilesGroupedByFolder(filesGroupedByFolder, 'module')
    return htmlToRender;
  } catch (err) {
    logger.error(`Failed to fetch modules for index page: ${err}`);
    return undefined;
  }
}

const getTemplatesForDisplayToUser = async (sessionInfo) => {
  const { accountId, sessionToken } = sessionInfo;
  try {
    const res = await fetchPreviewTemplates(accountId, sessionToken);
    const templatePaths = res
      .objects
      .filter(templateObj => isCodedFile(templateObj.filename))
      .map(templateObj => templateObj.path);
    const filesGroupedByFolder = groupByFolder(templatePaths)
    const htmlToRender = renderFilesGroupedByFolder(filesGroupedByFolder, 'template')
    return htmlToRender;
  } catch (err) {
    logger.error(`Failed to fetch templates for index page: ${err}`);
  }
}

const groupByFolder = (paths) => {
  return paths.reduce((acc, cur) => {
    const { dir, base } = pathParse(cur);
    if (Object.keys(acc).includes(dir)) {
      acc[dir].push(base);
    } else {
      acc[dir] = [base];
    }
    return acc;
  }, {})
}

const renderFilesGroupedByFolder = (filesGroupedByFolder, endpoint) => {
  const folders = Object.keys(filesGroupedByFolder);
  return folders.reduce((outer_acc, folder) => {
    const fakeDest = hidePreviewInDest(folder);
    const folderDisplay = '<b>'
      + fakeDest
      + '</b>'
      + listify(
          filesGroupedByFolder[folder],
          x => `/${endpoint}/${fakeDest}/${x}`,
          x => x
        );
    outer_acc += folderDisplay;
    return outer_acc;
  }, '');
}


module.exports = {
  buildIndexRouteHandler
}
