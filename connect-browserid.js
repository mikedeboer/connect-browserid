var events = require('events'),
    https = require('https'),
    qs = require('querystring'),
    util = require('util');

/* TODOs:
 * automagically register the route POST /auth and GET /logout ???
 * get ride of global audience */

var audience = null;
module.exports.events = new events.EventEmitter();
/**
 * Gets email out of the session.
 *
 * For user's who have previously authenticated
 * via BrowserID, they have a verified email. This
 * middleware will populate the req.user with an
 * email address.
 */
exports.authUser = function authUser(options){
  /* Here we could support:
   * verifier - (node-browserid|https://browserid.org/verify)
   */
  options = options || {};
  if (options.audience) {
    audience = options.audience;
  }
  return function authUser(req, res, next) {
    if (req.user) return next();
    /* Complecting authentication with a User object is
     * a bad idea. Just doing email for now. */
    req.user = null;

    /* TODO how do we do error handling? */
    var no_sess = 'Error: connect-browserid requires session middleware!';
    if (!req.session) return next(no_sess);

    if (req.session.verifiedEmail) {
      req.user = req.session.verifiedEmail;
      res.local('user', req.user);
    } else {
      res.local('user', null);
    }
    return next();
  };
};
/**
 * TODO ... rename?
 * Purpose - enforce login
   middleware design...
   try {
     next();
   } catch (x) {
     //is this a no auth exception? if so redirect
   }
 */
exports.enforceLogIn = function (req, resp) {
  if (! req.user) {
    // TODO should be powered by authUser options
    resp.redirect('/?login-required=true');
    return true;
  }
  return false;
};

/**
 * Ensures that the current use is logged into the app
 * with a verified email.
 * 
 * Returns true if the user was not logged in and response
 * has been redirected to '/'.
 * 
 * Returns false if everything is in order. ``req.user`` will
 * contain the user's email address.
 * 
 * Example:
 * app.get('/dashboard', function (req, resp) {
 *   if (enforceLogIn(req, resp) return;
 *   var data = load(req.user);
 *   ...
 * };
 * 
 * TODO: this still feels ackward... maybe have it be a function that wraps a route or ...?
 */
exports.enforceLogIn = function enforceLogIn(req, res) {
  if (!req.session || !req.session.verifiedEmail ||
       req.session.verifiedEmail == null) {
    console.warn('No session or no user in session, bailing');
    res.redirect('/');
    return true;
  }
  return false;
};

function get_audience(req) {
  if (audience) {
    return audience;
  } else {
    return "TODO form audience from req";
  }
};

/**
 * We'll assume CSRF etc is handled orthoganally to this route?
 *
 * /auth is an AJAX request that returns a 200 and JSON with
 * an email element or a
 * 403 with a reason element as to why verification failed.
 *
 * A side effect is that this starts a user's session and subsequent
 * requests will have req.user set to the user's email address.
 * 
 * options:
 * next - path to redirect to after sucessful auth
 */
exports.auth = function (options) {
  options = options || {};
  if (!options.next) {
    options.next = '/';
  }
  return  function(req, res){
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
          req.session.verifiedEmail = verified.email;
          module.exports.events.emit('login', verified.email, req, res);
        } else {
          console.error(verified.reason);
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
        audience: get_audience(req)
      });
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
      console.error("Expected POST got " + req.method);
    }
  };
};

/**
 * We'll assume CSRF etc is handled orthoganally to this route?
 *
 * /auth is an AJAX request that returns a 200 and JSON with
 * an email element or a
 * 403 with a reason element as to why verification failed.
 *
 * A side effect is that this starts a user's session and subsequent
 * requests will have req.user set to the user's email address.
 */
exports.logout = function (options) {
  // Is there a better name for functions that create routes?
  // like createLogout or whatever...
  options = options || {};
  if (!options.next) {
    options.next = '/';
  }
  return function(req, res){
    req.session.destroy(function (err) {
      if (err) console.error(err);
      res.redirect(options.next);
    });

  };
};