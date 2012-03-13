var browserid_init = require('../../connect-browserid').init,
    express = require('express');
var app = express.createServer();

var browserid = browserid_init({
    //audience: 'http://127.0.0.1:3030',
    audience: 'http://haskwhal:3030',
    debug: true,
    auth_next: '/',
    logout_next: '/'
});
console.log('1');
app.set('views', __dirname + '/views');
app.use(express.cookieParser());
app.use(express.session({ secret: "keyboard cat" }));
app.use(express.bodyParser());
app.use(express.csrf());
app.use(function (req, resp, next) {
    resp.local('csrf', req.session._csrf);
    next();
});
console.log('2');
app.use(browserid.authUser);
console.log('after auth');
app.post('/auth', browserid.auth);
// Optional - use events to de-couple your app
browserid.events.on('login', function (email, req, resp) {
  console.log('User', email, 'logged in');
});
console.log('after login');
app.post('/logout', browserid.logout);

app.configure('development', function(){
    // A common error when developing locally is hitting your server as
    // http://127.0.0.1:3000 but setting up your audience as
    // http://dev.example.com:3000
    app.use(browserid.guarantee_audience);
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.get('/', function (req, resp) {
    if (req.email) {
      resp.render('authenticated.ejs');
    } else {
      resp.render('anonymous.ejs');
    }
});

app.get('/sekrit', function (req, resp) {
    if (browserid.enforceAuth(req, resp)) return;
    // Only logged in users get past this point
    var user = backend.getUserByEmail(req.email);
    // ...
    resp.render('sekrit.ejs', {user: user});
});

var backend = {
  getUserByEmail: function (email) {
    // ... This would talk to your real backend
    return {};
  }
};

app.listen(3030);
console.log("Visit http://127.0.0.1:3030 to test connect-browserid");