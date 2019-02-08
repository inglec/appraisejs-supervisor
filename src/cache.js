const _ = require('lodash');

class Cache {
  constructor() {
    this.accessTokens = {};
    this.jwt = null;
  }

  getAccessToken(installationId, timestamp) {
    if (installationId in this.accessTokens) {
      const {
        expiry,
        token,
      } = this.accessTokens[installationId];

      if (timestamp < expiry) {
        return token;
      }
      delete this.accessTokens[installationId];
    }

    return null;
  }

  getJWT(timestamp) {
    if (this.jwt !== null) {
      const {
        expiry,
        token,
      } = this.jwt;

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
    // Clear expired access tokens.
    _.forEach(this.accessTokens, (accessToken, installationId) => {
      if (timestamp > accessToken.expiry) {
        delete this.accessTokens[installationId];
      }
    });

    // Clear expired JSON Web Token.
    if (_.get(this.jwt, 'expiry') < timestamp) {
      this.jwt = null;
    }
  }
}

module.exports = Cache;
