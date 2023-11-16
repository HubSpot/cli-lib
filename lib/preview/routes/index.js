const {
  hidePreviewInDest,
  trackPreviewEvent,
} = require('../previewUtils');
const {
  fetchTemplatesPathStartsWith,
  fetchModulesPathStartsWith
} = require('../../../api/designManager');
const { parse: pathParse } = require('path');

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
          ${ domains ? getSiteList(domains, PORT) : '<p>No domains found</p>' }
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
  const { portalId, dest } = sessionInfo;
  try {
    const res = await fetchModulesPathStartsWith(portalId, dest);
    const modulePaths = res
      .objects
      .map(moduleObj => moduleObj.path);
    const filesGroupedByFolder = groupByFolder(modulePaths)
    const htmlToRender = renderFilesGroupedByFolder(filesGroupedByFolder, 'module')
    return htmlToRender;
  } catch (err) {
    console.log(`Failed to fetch modules for index page: ${err}`);
    return undefined;
  }
}

const getTemplatesForDisplayToUser = async (sessionInfo) => {
  const { portalId, dest } = sessionInfo;
  try {
    const res = await fetchTemplatesPathStartsWith(portalId, dest);
    const templatePaths = res
      .objects
      .filter(templateObj => templateObj.filename.endsWith('html'))
      .map(templateObj => templateObj.path);
    const filesGroupedByFolder = groupByFolder(templatePaths)
    const htmlToRender = renderFilesGroupedByFolder(filesGroupedByFolder, 'template')
    return htmlToRender;
  } catch (err) {
    console.log(`Failed to fetch templates for index page: ${err}`);
    return undefined;
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
      + '</b><ul>'
      + filesGroupedByFolder[folder].reduce((acc, cur) => {
          const newListItem = `<li><a href="/${endpoint}/${fakeDest}/${cur}">${cur}</a></li>`
          acc += newListItem;
          return acc;
        }, '')
      + '</ul>';
    outer_acc += folderDisplay;
    return outer_acc;
  }, '');
}


module.exports = {
  buildIndexRouteHandler
}
