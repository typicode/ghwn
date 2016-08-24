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
  },

  setName: function (name) {
    this.$('[name=name]').val(name)
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

var eventURL = function(event) {
  if (event.type == 'PullRequestEvent') {
    return event.payload.pull_request.html_url
  } else if (event.type == 'PushEvent') {
    return 'https://github.com/'+event.repo.name+'/compare/'+event.payload.before+'...'+event.payload.head
  } else if (event.type == 'IssuesEvent') {
    return event.payload.issue.html_url
  } else if (event.type == 'IssueCommentEvent') {
    return event.payload.comment.html_url
  } else if (event.type == 'ForkEvent') {
    return event.payload.forkee.html_url
  } else {
    return 'https://github.com/'+event.repo.name
  }
}

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
    var icon = attr.actor.avatar_url
    var notification = new Notification(title, { body: body, icon: icon })
    var url = eventURL(attr)
    notification.onclick = function(event) {
      event.preventDefault();
      window.open(eventURL(attr), '_blank');
    }
    setTimeout(notification.close.bind(notification), 5000)
  },

})

var Router = Backbone.Router.extend({

  routes: {
    ':name': 'watch',
    '': 'index'
  },

  watch: function (name) {
    // Show username in formView
    App.formView.setName(name)

    // Ask permission first
    Notification.requestPermission(function () {
      // Clear interval if any
      clearInterval(this.intervalId)

      // Hide index view
      $('#index').hide()

      // Create a collection to fetch events
      var remote = new Backbone.Collection

      // See https://developer.github.com/v3/activity/events/#list-events-that-a-user-has-received
      remote.url = 'https://api.github.com/users/' + name + '/received_events'

      // Create an empty collection that will be used in views
      var local = new Backbone.Collection

      // Create views
      App.listView = new ListView({ collection: local })
      App.notificationView = new NotificationView({ collection: local })

      // Show listView
      $('#list').html(App.listView.el)

      // Poll every minute and save intervalId
      App.intervalId = setInterval(function () {
        console.log('fetch')
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
        },
        error: function (collection, response) {
          if (response.status === 404) alert('Can\'t find user ' + name)
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
    clearInterval(App.intervalId)

    // Remove events views
    if (App.listView) App.listView.remove()
    if (App.notificationView) App.notificationView.remove()

    // Reset form view
    App.formView.setName('')

    // Set focus on desktop
    if ("Notification" in window) $('#input').focus()

    // Show index view again
    $('#index').show()
  }

})

var App = {}

$(function () {
  if (!("Notification" in window)) $('#alert').removeClass('hidden')
  var router = new Router()
  App.formView = new FormView({ el: $('#form'), router: router })
  Backbone.history.start()
})
