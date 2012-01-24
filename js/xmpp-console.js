$(function() {

  $('.btn').click(function(e) {
    e.preventDefault();
  });

  window.xmppconsole = {
    HTTPBIND_URL: "http://localhost:8000/xmpp-httpbind",

    parseXml: function(text) {
      var doc = null;
      if (window['DOMParser']) {
        var parser = new DOMParser();
        doc = parser.parseFromString(text, 'text/xml');
      } else if (window['ActiveXObject']) {
        var doc = new ActiveXObject("MSXML2.DOMDocument");
        doc.async = false;
        doc.loadXML(text);
      } else {
        throw {
          message: 'No DOMParser object found.'
        };
      }

      var elem = doc.documentElement;
      if (elem.getElementsByTagName('parsererror').length > 0) {
        return null;
      }
      return elem;
    },
  };

  xmppconsole.LoginView = Backbone.View.extend({
    el: $('#login-modal'),

    statusEl: $('#status-msg'),

    initialize: function() {
      this.el.modal({
        keyboard: false,
        backdrop: 'static',
        show: true,
      });
    },

    hide: function() {
      this.el.modal({
        keyboard: false,
        backdrop: 'static',
        show:false,
      });
    },

    show: function() {
      this.el.modal({
        keyboard: false,
        backdrop: 'static',
        show: true,
      });
    },

    filterOnEnter: function(e) {
      if (e.keyCode != 13) return;
      this.login();
    },

    events: {
      'click #login-btn': 'login',
      'keypress #jid': 'filterOnEnter',
      'keypress #password': 'filterOnEnter',
    },

    connListener: function(status) {
      console.log("status: " + status);
      switch (status) {
        case Strophe.Status.CONNECTING:
          this.statusEl.text("Connecting...");
          break;
        case Strophe.Status.CONNECTED:
          this.statusEl.text("");
          this.hide();
          this.trigger('connected', this.conn);
          break;
        case Strophe.Status.AUTHENTICATING:
          this.statusEl.text("Authenticating...");
          break;
        case Strophe.Status.AUTHFAIL:
          this.statusEl.text("Wrong username and password combination");
          break;
      }
    },

    login: function() {
      var jid = $('#jid').val();
      var password = $('#password').val();

      this.conn = new Strophe.Connection(xmppconsole.HTTPBIND_URL);
      this.conn.connect(jid, password, _.bind(this.connListener, this));
    },
  });

  xmppconsole.AppView = Backbone.View.extend({
    el: $('#main-content'),
    consoleEl: $('#console'),
    inputEl: $('#main-input'),
    msgTemplate: _.template('<div class="<%= type %>"><%= msg %></div><br />'),

    initialize: function() {
      // Show the login modal and wait for the connection
      this.loginView = new xmppconsole.LoginView;
      this.loginView.bind('connected', this.connected, this);
    },

    events: {
      'click #send-message': 'sendMessage',
      'click #disconnect': 'disconnect',
      'click #clear': 'clearConsole',
    },

    connected: function(conn) {
      console.log("connected");
      this.conn = conn;
      this.conn.xmlInput = _.bind(function(body) {
        this.addToConsole(Strophe.serialize(body), 'incoming');
      }, this);
      this.conn.xmlOutput = _.bind(function (body) {
        this.addToConsole(Strophe.serialize(body), 'outgoing');
      }, this);
    },

    formatXml: function(xml) {
      var formatted = '';
      var reg = /(>)(<)(\/*)/g;
      xml = xml.replace(reg, '$1\r\n$2$3');
      var pad = 0;
      _.each(xml.split('\r\n'), function(node, index) {
        var indent = 0;
        if (node.match( /.+<\/\w[^>]*>$/ )) {
          indent = 0;
        } else if (node.match( /^<\/\w/ )) {
          if (pad != 0) {
            pad -= 1;
          }
        } else if (node.match( /^<\w[^>]*[^\/]>.*$/ )) {
          indent = 1;
        } else {
          indent = 0;
        }
   
        var padding = '';
        for (var i = 0; i < pad; i++) {
          padding += '  ';
        }
   
        formatted += padding + node + '\r\n';
        pad += indent;
      });
 
      return _.escape(formatted);
    },

    addToConsole: function(msg, type) {
      var formatted = this.formatXml(msg);
 
      // Prettify the new message
      // TODO: not working, missing indentation
      //var prettified = window.prettyPrintOne(formatted, 'xml');

      this.consoleEl.append(this.msgTemplate({type: type, msg: formatted}));

      // Keep scrolling to bottom
      this.consoleEl.scrollTop(this.consoleEl[0].scrollHeight);
    },

    sendMessage: function() {
      var msg = this.inputEl.val();
      var error = false;

      if (msg[0] === '<') {
        // assume raw XML message
        var xml = xmppconsole.parseXml(msg);
        if (xml) {
          this.conn.send(xml);
          this.inputEl.val('');
        } else {
          error = true;
        }
      } else {
        // else the message is javascript
        try {
          var builder = eval(msg);
          this.conn.send(builder);
          this.inputEl.val('');
        } catch (e) {
          console.log(e);
          error = true;
        }
      }

      if (error) {
        this.inputEl.parent().parent().addClass('error');
      } else {
        this.inputEl.parent().parent().removeClass('error');
      }
    },

    clearConsole: function() {
      this.consoleEl.text("");
    },

    disconnect: function() {
      this.conn.disconnect();
      this.clearConsole();
      this.loginView.show();
    },
  });

  // Start the main view
  var appview = new xmppconsole.AppView;
});
