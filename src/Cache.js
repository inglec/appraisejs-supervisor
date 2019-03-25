const { forEach } = require('lodash/collection');
const { get } = require('lodash/object');

class Cache {
  constructor() {
    this.accessTokens = {};
    this.jwt = null;
  }

  getAccessToken(installationId, timestamp) {
    if (installationId in this.accessTokens) {
      const { expiry, token } = this.accessTokens[installationId];
      if (timestamp < expiry) {
        return token;
      }

      // Token is expired
      delete this.accessTokens[installationId];
    }

    return null;
  }

  getJwt(timestamp) {
    if (this.jwt) {
      const { expiry, token } = this.jwt;
      if (timestamp < expiry) {
        return token;
      }

      this.jwt = null;
    }

    return null;
  }

  storeAccessToken(installationId, token, timestamp) {
    this.accessTokens[installationId] = {
      expiry: new Date(timestamp),
      token,
    };
  }

  storeJWT(token, timestamp) {
    this.jwt = {
      expiry: new Date(timestamp),
      token,
    };
  }

  clear(timestamp) {
    // Clear expired access tokens
    forEach(this.accessTokens, (accessToken, installationId) => {
      if (timestamp > accessToken.expiry) {
        delete this.accessTokens[installationId];
      }
    });

    // Clear expired JSON Web Token
    if (get(this.jwt, 'expiry') < timestamp) {
      this.jwt = null;
    }
  }
}

module.exports = Cache;
