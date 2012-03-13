var events = require('events'),
    https = require('https'),
    qs = require('querystring'),
    util = require('util');

exports.init = function (options) {
  var opts = options || {},
      self;
  if (! opts.audience) {
    console.warn("connect-browserid requires an audience in options to init. " +
      "Not providing one is a security issue.");
  }
  if (!opts.debug) {
    opts.debug = false;
  }

  if (!opts.auth_next) {
    opts.auth_next = '/';
  }

  if (!opts.need_auth_next) {
    opts.need_auth_next = '/';
  }

  if (!opts.logout_next) {
    opts.logout_next = '/';
  }

  self = {
    /**
     * Initializes browserid middlware.
     *
     * Gets email out of the session.
     *
     * For user's who have previously authenticated
     * via BrowserID, they have a verified email. This
     * middleware will populate the req.email with an
     * email address.
     */
     // TODO rename
    authUser: function(req, res, next) {
      if (req.email) {
        if (opts.debug) console.info('req.email exists, skipping authUser');
        return next();
      }
      req.email = null;

      /* TODO how do we do error handling? */
      var no_sess = 'Error: connect-browserid requires session middleware!';
      if (!req.session) return next(no_sess);

      if (req.session.verifiedEmail) {
        if (opts.debug) console.info("Pulling verifed email out of the session");
        req.email = req.session.verifiedEmail;
        res.local('email', req.email);
      } else {
        if (opts.debug) console.warn("No verfieid email in the session");
        res.local('email', null);
      }
      return next();
    },

    /**
     * Ensures that the current use is logged into the app
     * with a verified email.
     *
     * Returns true if the user was not logged in and response
     * has been redirected to '/'.
     *
     * Returns false if everything is in order. ``req.email`` will
     * contain the user's email address.
     *
     * Example:
     * app.get('/dashboard', function (req, resp) {
     *   if (enforceAuth(req, resp) return;
     *   var data = load(req.email);
     *   ...
     * };
     *
     */
    enforceAuth: function (req, res) {
      if (!req.session || !req.session.verifiedEmail ||
           req.session.verifiedEmail == null) {
        if (opts.debug) console.warn('No session or no user in session, bailing');
        res.redirect(opts.need_auth_next);
        return true;
      }
      return false;
    },

    // @private
    get_audience: function(req) {
      if (opts.audience) {
        return opts.audience;
      } else {
        return "TODO form audience from req";
      }
    },

    /**
     * We'll assume CSRF etc is handled orthoganally to this route?
     *
     * /auth is an AJAX request that returns a 200 and JSON with
     * an email element or a
     * 403 with a reason element as to why verification failed.
     *
     * A side effect is that this starts a user's session and subsequent
     * requests will have req.email set to the user's email address.
     *
     * options:
     * next - path to redirect to after sucessful auth
     */
    auth: function(req, res) {
        function onVerifyResp(bidRes) {
          var data = "";
          bidRes.setEncoding('utf8');
          bidRes.on('data', function (chunk) {
            data += chunk;
          });
          bidRes.on('end', function () {
            var verified = JSON.parse(data);
            res.contentType('application/json');
            if (verified.status == 'okay') {
              if (opts.debug) console.info('browserid auth successful, setting req.session.verifiedEmail');
              req.session.verifiedEmail = verified.email;
              self.events.emit('login', verified.email, req, res);
              if (opts.debug) console.info(verified);
            } else {
              if (opts.debug) console.error('audience', self.get_audience(req));
              if (opts.debug) console.error(verified.reason);
              res.writeHead(403);
            }
            res.write(data);
            res.end();
          });
        };
        if (req.method === 'POST') {
          var assertion = req.body.assertion;
          var body = qs.stringify({
            assertion: assertion,
            audience: self.get_audience(req)
          });
          if (opts.debug) console.info('verifying with browserid');
          var request = https.request({
            host: 'browserid.org',
            path: '/verify',
            method: 'POST',
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'content-length': body.length
            }
          }, onVerifyResp);
          request.write(body);
          request.end();
        } else {
          if (opts.debug) console.error("Expected POST got " + req.method);
        }

    },

    /**
     * We'll assume CSRF etc is handled orthoganally to this route?
     *
     * /auth is an AJAX request that returns a 200 and JSON with
     * an email element or a
     * 403 with a reason element as to why verification failed.
     *
     * A side effect is that this starts a user's session and subsequent
     * requests will have req.email set to the user's email address.
     */
    logout: function(req, resp){
      var finish = function (resp) {
        resp.redirect(opts.logout_next);
      };
      // connect-session API
      if (typeof req.session.destroy === 'function') {
        req.session.destroy(function (err) {
          if (opts.debug && err) console.error(err);
          finish(resp);
        });
      // client-session API
      } else if (typeof req.session.reset === 'function') {
        req.session.reset();
        finish(resp);
      } else {
        throw "Unsupported session backend";
      }
    },

    /**
     * Middleware for development environments which guarentees
     * your using the right hostname. Avoid subtle bugs and
     * headdesking with:
     *     var browserid = require('connect-browserid');
     *     ...
     *
     *     app.use(browserid.guarantee);
     */
    guarantee_audience: function (req, resp, next) {
      if (opts.audience != null) {
        if (opts.audience.indexOf(req.headers['host']) == -1) {
          console.error("Wrong hostname [", req.headers['host'], "] expected [",
                       opts.audience, "] ... fixing");
          return resp.redirect(opts.audience + req.url);
        }
      }
      next();
    },
    events: new events.EventEmitter()
  };
  return self;
} // init