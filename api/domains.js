const http = require('../http');

const DOMAINS_API_PATH = `/cms/v3/domains`;

async function fetchDomains(accountId) {
  const result = await http.get(accountId, {
    uri: DOMAINS_API_PATH,
    json: true,
  });

  return result.results;
}

module.exports = {
  fetchDomains,
};
