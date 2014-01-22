(function() {
  'use strict';
  
  var HTTPBIND_URL = 'http://localhost:8000/xmpp-httpbind';

  var parseXml = function(text) {
    var doc = null;
    if (window.DOMParser) {
      var parser = new window.DOMParser();
      doc = parser.parseFromString(text, 'text/xml');
    } else if (window.ActiveXObject) {
      doc = new window.ActiveXObject('MSXML2.DOMDocument');
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
  };

  var formatXml = function(xml) {
    var formatted = '';
    var reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\r\n$2$3');
    var pad = 0;
    _.each(xml.split('\r\n'), function(node, index) {
      var indent = 0;
      if (node.match( /.+<\/\w[^>]*>$/ )) {
        indent = 0;
      } else if (node.match( /^<\/\w/ )) {
        if (pad !== 0) {
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
  };

  var LoginView = Backbone.View.extend({
    el: $('#login-modal'),

    show: function() {
      this.$el.modal('show');
    },

    filterOnEnter: function(e) {
      if (e.keyCode !== 13) {
        return;
      }
      this.login();
    },

    events: {
      'click #login-btn': 'login',
      'keypress #jid': 'filterOnEnter',
      'keypress #password': 'filterOnEnter'
    },

    connListener: function(status) {
      var statusMsg = $('#status-msg');
      switch (status) {
        case Strophe.Status.CONNECTING:
          statusMsg.text('Connecting...');
          break;
        case Strophe.Status.CONNECTED:
          statusMsg.text('');
          this.$el.modal('hide');
          this.trigger('connected', this.conn);
          break;
        case Strophe.Status.AUTHENTICATING:
          statusMsg.text('Authenticating...');
          break;
        case Strophe.Status.AUTHFAIL:
          statusMsg.text('Wrong username and password combination');
          break;
      }
    },

    login: function() {
      var jid = $('#jid').val();
      var password = $('#password').val();

      this.conn = new Strophe.Connection(HTTPBIND_URL);
      this.conn.connect(jid, password, _.bind(this.connListener, this));
    }
  });

  var AppView = Backbone.View.extend({
    id: 'main-content',
    consoleEl: $('#console'),
    inputEl: $('#main-input'),
    msgTemplate: _.template('<div class="<%= type %>"><%= msg %></div>'),

    initialize: function() {
      this.loginView = new LoginView();
      this.loginView.bind('connected', this.connected, this);
      this.loginView.show();
    },

    events: {
      'click #send-message': 'sendMessage',
      'click #disconnect': 'disconnect',
      'click #clear': 'clearConsole'
    },

    connected: function(conn) {
      this.conn = conn;
      var incoming = _.bind(_.partial(this.addToConsole, 'incoming'), this);
      var outgoing = _.bind(_.partial(this.addToConsole, 'outgoing'), this);
      conn.xmlInput = incoming;
      conn.xmlOutput = outgoing;
    },

    addToConsole: function(type, element) {
      var msg = Strophe.serialize(element);
      var formatted = formatXml(msg);
 
      var newEntry = $(this.msgTemplate({type: type, msg: formatted}));
      this.consoleEl.append(newEntry);
      hljs.highlightBlock(newEntry.get(0));

      // Keep scrolling to bottom
      this.consoleEl.scrollTop(this.consoleEl[0].scrollHeight);
    },

    sendMessage: function() {
      var msg = this.inputEl.val();
      var error = false;

      if (msg[0] === '<') {
        // assume raw XML message
        var xml = parseXml(msg);
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
      this.consoleEl.text('');
    },

    disconnect: function() {
      this.conn.disconnect();
      this.clearConsole();
      this.loginView.show();
    }
  });

  new AppView();
})();
