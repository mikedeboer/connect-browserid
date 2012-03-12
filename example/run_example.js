var browserid = require('connect-browserid'),
    express = require('express');
var app = express.createServer();

app.set('views', __dirname + '/views');
app.use(express.cookieParser());
app.use(express.session({ secret: "keyboard cat" }));
app.use(express.bodyParser());
app.use(express.csrf());
app.use(function (req, resp, next) {
    resp.local('csrf', req.session._csrf);
    next();
});

app.use(browserid.authUser({
    debug: true,
    audience: "http://127.0.0.1:3030"}));
app.post('/auth', browserid.auth({next: '/'}));
app.post('/logout', browserid.logout({next: '/'}));

app.get('/', function (req, resp) {
    if (req.email) {
      resp.render('authenticated.ejs');
    } else {
      resp.render('anonymous.ejs');
    }
});

app.get('/sekrit', function (req, resp) {
    if (browserid.enforceLogIn(req, resp)) return;
    // Only logged in users get past this point
    var user = backend.getUserByEmail(req.email);
    // ...
    resp.render('sekrit.ejs', {user: user});
});

var getUserByEmail = function (email) {
  // ... This would talk to your real backend
  return {};
};

app.listen(3030);
console.log("Express server listening on http://127.0.0.1:3030");