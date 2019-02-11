const axios = require('axios');

const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_APPS_MEDIA_TYPE = 'application/vnd.github.machine-man-preview+json';
const GITHUB_URL = 'https://github.com';

// Fetch OAuth access token for a given installation.
const getInstallationAccessToken = (installationId, jwt, appName) => axios.request({
  method: 'POST',
  baseURL: GITHUB_API_URL,
  url: `/app/installations/${installationId}/access_tokens`,
  headers: {
    Accept: GITHUB_APPS_MEDIA_TYPE,
    Authorization: `Bearer ${jwt}`,
    'User-Agent': appName,
  },
});

// Exchange code for OAuth access token.
const getAccessToken = (clientId, clientSecret, code) => axios.request({
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
});

module.exports = {
  getAccessToken,
  getInstallationAccessToken,
  GITHUB_API_URL,
  GITHUB_APPS_MEDIA_TYPE,
  GITHUB_URL,
};
