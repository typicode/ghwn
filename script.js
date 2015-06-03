var FormView = Backbone.View.extend({

  template: $('#form-template').html(),

  initialize: function (options) {
    this.router = options.router
    this.render()
  },

  render: function () {
    this.$el.html(this.template)
  },

  events: {
    'submit form': 'submit'
  },

  submit: function (e) {
    e.preventDefault()
    var name = this.$('[name=name]').val()
    this.router.navigate(name, {trigger: true});
  }

})

var ListView = Backbone.View.extend({

  template: _.template($('#list-template').html()),

  initialize: function () {
    this.listenTo(this.collection, 'add reset', this.render)
  },

  render: function () {
    this.$el.html(this.template({
      collection: this.collection.toJSON()
    }))
  }

})

var NotificationView = Backbone.View.extend({

  initialize: function () {
    this.listenTo(this.collection, 'add', this.notify)
  },

  notify: function (model) {
    var attr = model.attributes
    var title = attr.type
    var body = [
      'on', attr.repo.name,
      'by', attr.actor.login,
      'at', new Date(attr.created_at).toLocaleTimeString()
    ].join(' ')
    var notification = new Notification(title, { body: body })
    setTimeout(notification.close.bind(notification), 5000)
  },

})

var Router = Backbone.Router.extend({

  routes: {
    ':name': 'watch',
    '': 'index'
  },

  watch: function (name) {
    // Ask permission first
    Notification.requestPermission(function () {
      // Clear interval if any
      clearInterval(this.intervalId)

      // Hide index view
      $('#index').hide()

      // Create a collection to fetch events
      var remote = new Backbone.Collection

      // See https://developer.github.com/v3/activity/events/#list-events-that-a-user-has-received
      remote.url = 'https:api.github.com/users/' + name + '/received_events'

      // Create an empty collection that will be used in views
      var local = new Backbone.Collection

      // Create views
      this.listView = new ListView({ el: $('#list'), collection: local })
      this.notificationView = new NotificationView({ collection: local })

      // Poll every minute and save intervalId
      this.intervalId = setInterval(function () {
        remote.fetch()
      }, 60 * 1000)

      // First fetch
      remote.fetch({
        success: function () {
          // Add first remote item to the local collection
          local.unshift(remote.first())

          // Add new remote item to the local collection
          remote.on('add', function (model) {
            local.unshift(model)
          })
        }
      })

      // On add, update bubble
      var counter = 0

      ifvisible.on('focus', function () {
        counter = 0
        Tinycon.setBubble(counter)
      })

      remote.on('add', function () {
        if (ifvisible.now()) {
          counter = 0
        } else {
          ++counter
        }
        Tinycon.setBubble(counter)
      })
    }.bind(this))
  },

  index: function () {
    // Clear interval if any
    clearInterval(this.intervalId)

    // Remove events views
    if (this.listView) this.listView.remove()
    if (this.notificationView) this.notificationView.remove()

    // Show index view again
    $('#index').show()
  }

})

$(function () {
  var router = new Router()
  new FormView({ el: $('#form'), router: router })
  Backbone.history.start()
})
