const { getModules, getTemplates } = require('../previewUtils');

const buildIndexRouteHandler = (sessionInfo) => {
  return async (req, res) => {
    const responseHTML = await buildIndexHtml(sessionInfo);
    res.status(200).set({ 'Content-Type': 'text/html' }).end(responseHTML);
  }
}

const buildIndexHtml = async (sessionInfo) => {
  const { domains, dest } = sessionInfo;
  const modules = await getModules(sessionInfo);
  const templates = await getTemplates(sessionInfo);

  return `
    <!DOCTYPE html>
    <head>
    </head>
		<body>
      <h1>Domains</h1>
      ${ domains ? getSiteList(domains) : p('No domains found') }
      <h1>Modules</h1>
      ${ modules ? getModuleList(modules) : p(`No modules found in ${dest}/modules`) }
      <h1>Templates</h1>
      ${ templates ? getTemplateList(templates) : p(`No modules found in ${dest}/templates`) }
		</body>
  `;
}

const p = (text) => {
  return `<p>${text}</p>`;
}

const getSiteList = (domains) => {
  return listify(
    domains,
    domainObj => `http://${domainObj.domain}.hslocal.net:3000`,
    domainObj => domainObj.domain
  );
}

const getModuleList = (modules) => {
  return listify(
    modules.map(module => module.split('.')[0]),
    moduleName => `http://hslocal.net:3000/module/${moduleName}`,
    moduleName => moduleName
  );
}

const getTemplateList = (templates) => {
  return listify(
    templates,
    templateName => `http://hslocal.net:3000/template/${templateName}`,
    templateName => templateName
  )
}

const listify = (objects, hrefBuilder, labelBuilder) => {
  return '<ul>'
    + objects.reduce((x,y) => x += `<li><a href="${hrefBuilder(y)}">${labelBuilder(y)}</a></li>`, '')
    + '</ul>';
}

module.exports = {
  buildIndexRouteHandler
}
