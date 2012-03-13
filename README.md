# THIS ISN'T REAL, YET.  RUN AWAY.

## BrowserID Authenticated Sessions for Connect

BrowserID allows you to implement incredibly convenient
website authentication without any storage requirements.

Signed cookies allow you to implement sessions without any
server storage requirments.

The connect framework let's zap together web applications
with redonkulous efficiency.

**connect-browserid** puts the first two together in a way
that's crazy easy to use in the third.  It's magic.

## How you use it

### install connect-browserid

    npm install connect-browserid

### put the middleware in your server

    var browserid = require('connect-browserid').init({
      audience: "https://example.com"
    });
    app.use(express.session);
    app.use(browserid.authUser);
    app.use(app.router);

This middleware must come after session but before router middlewares.

### throughout your code req.email is the authenticated user's verified email address

    if (req.email) res.send('hi ' + req.email);
    else res.send('I don't know you.');

    app.post('/auth', browserid.auth);

### post an assertion to `/auth` to authenticate

    navigator.id.getVerifiedEmail(function(assertion) {
        if (assertion) {
            $.post("/auth", {assertion: assertion}, function(res) {
                if (res.success) alert("now you're logged in as: " + res.user);
                else alert("log in failure: " + res.reason);
            });
        }
    });

See example directory for more details.