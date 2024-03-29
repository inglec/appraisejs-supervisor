const axios = require('axios');

const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_APPS_MEDIA_TYPE = 'application/vnd.github.machine-man-preview+json';
const GITHUB_URL = 'https://github.com';

// Exchange code for OAuth access token
const fetchClientAccessToken = (clientId, clientSecret, code) => (
  axios({
    method: 'POST',
    baseURL: GITHUB_URL,
    url: '/login/oauth/access_token',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    data: {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    },
  })
);

// Fetch OAuth access token for a given installation
const fetchInstallationAccessToken = (installationId, jwt, appName) => (
  axios({
    method: 'POST',
    baseURL: GITHUB_API_URL,
    url: `/app/installations/${installationId}/access_tokens`,
    headers: {
      Accept: GITHUB_APPS_MEDIA_TYPE,
      Authorization: `Bearer ${jwt}`,
      'User-Agent': appName,
    },
  })
);

module.exports = {
  GITHUB_API_URL,
  GITHUB_APPS_MEDIA_TYPE,
  GITHUB_URL,
  fetchClientAccessToken,
  fetchInstallationAccessToken,
};
