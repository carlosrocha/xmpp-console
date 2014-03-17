(function() {
  'use strict';

  var httpBindUrl = '/xmpp-httpbind';

  var formatXml = function(xml) {
    xml = xml.replace(/></g, '>\n<');
    var indent = 0;
    return _.reduce(xml.split('\n'), function(memo, node) {
      if (node.match(/^<\/\w/)) indent -= 1;

      var padding = Array(indent + 1).join('  ');

      if (node.match(/^<\w[^>]*[^\/]>.*$/)) indent += 1;

      return memo + padding + node + '\n';
    }, '');
  };

  var parseXml = function(val) {
    var result = new window.DOMParser().parseFromString(val, 'text/xml');

    if (result.getElementsByTagName('parsererror').length > 0) {
      return false;
    } else {
      return result.firstChild;
    }
  };

  var connCallback = function(view) {
    return function(status) {
      switch (status) {
        case Strophe.Status.CONNECTING:
          view.updateStatus('Connecting&#x2026;');
          break;
        case Strophe.Status.CONNECTED:
          view.connected(this);
          break;
        case Strophe.Status.AUTHENTICATING:
          view.updateStatus('Authenticating&#x2026;');
          break;
        case Strophe.Status.AUTHFAIL:
          view.updateStatus('Authentication failed', true);
          view.enable();
          break;
        case Strophe.Status.DISCONNECTED:
          view.updateStatus('Server unavailable', true);
          view.enable();
          break;
      }
    }
  };

  var LoginView = Backbone.View.extend({
    id: 'login',

    template: _.template($('#login-template').html()),

    events: {
      'submit form': 'login'
    },

    render: function() {
      this.$el.html(this.template());
      return this;
    },

    login: function() {
      var jid = this.$('#jid').val();
      var password = this.$('#password').val();

      if (!jid || !password) {
        this.updateStatus('Jid and password are required', true);
        return false;
      }

      var conn = new Strophe.Connection(httpBindUrl);
      conn.connect(jid, password, connCallback(this));
      this.$('fieldset').prop('disabled', true);

      return false;
    },

    updateStatus: function(message, error) {
      this.$('p').html(message).toggleClass('error', !!error);
    },

    enable: function() {
      this.$('fieldset').prop('disabled', false);
    },

    connected: function(connection) {
      this.trigger('connected', connection);
    }
  });

  var ConsoleView = Backbone.View.extend({
    template: _.template($('#console-template').html()),

    events: {
      'click #disconnect': 'disconnect',
      'click #clear': 'clear',
      'click #send': 'send'
    },

    initialize: function(options) {
      this.conn = options.connection;

      var incoming = _.bind(_.partial(this.appendToConsole, 'incoming'), this);
      this.conn.xmlInput = incoming;

      var outgoing = _.bind(_.partial(this.appendToConsole, 'outgoing'), this);
      this.conn.xmlOutput = outgoing;
    },

    render: function() {
      this.$el.html(this.template());
      return this;
    },

    appendToConsole: function(type, element) {
      var consoleEl = this.$('pre');
      var msg = Strophe.serialize(element);
      var formatted = formatXml(msg);
      var newEntry = $('<div>', { 'class': type }).text(formatted);
      consoleEl.append(newEntry);
      hljs.highlightBlock(newEntry.get(0));

      consoleEl.scrollTop(consoleEl[0].scrollHeight);
    },

    disconnect: function() {
    },

    clear: function() {
      this.$('pre').html('');
    },

    send: function() {
      var val = this.$('textarea').val(),
          message,
          error;

      if (!val) return;

      if (val[0] === '<') {
        message = parseXml(val);
        if (message === false) error = 'XML error';
      } else {
        try {
          message = eval(val);
        } catch(e) {
          error = e.message;
        }
      }

      if (!message) {
        this.$('#error-message').text(error);
        return;
      }

      this.$('#error-message').text('');
      this.conn.send(message);
    }
  });

  var AppView = Backbone.View.extend({
    el: '#main',
    
    render: function() {
      this.loginView = new LoginView();
      this.$el.append(this.loginView.render().el);
      this.listenTo(this.loginView, 'connected', this.showConsole);

      return this;
    },

    showConsole: function(connection) {
      this.loginView.remove();
      this.$el.append(new ConsoleView({ connection: connection }).render().el);
    }
  });

  new AppView().render();
})();
